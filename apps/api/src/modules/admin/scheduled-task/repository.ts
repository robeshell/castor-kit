/**
 * 定时任务 repository 层（含调度器的租约 SQL）
 */

import { and, asc, count, desc, eq, ilike, isNotNull, isNull, lte, ne, or, sql, type SQL } from 'drizzle-orm'
import { utcNow } from '@/db/schema/columns'
import type { Executor } from '@/db/client'
import { scheduled_task_runs, scheduled_tasks, type ScheduledTask, type ScheduledTaskRun } from '@/db/schema'

export type NewScheduledTask = typeof scheduled_tasks.$inferInsert
export type NewScheduledTaskRun = typeof scheduled_task_runs.$inferInsert
export type TaskChanges = Partial<Omit<NewScheduledTask, 'id' | 'created_at' | 'updated_at'>>

export interface TaskFilters {
  search: string
  isActive: boolean | null
  status: string
}

export interface RunFilters {
  taskId: number | null
  status: string
}

export interface RunWithTask {
  run: ScheduledTaskRun
  task: Pick<ScheduledTask, 'name' | 'task_code'>
}

/** 崩溃回收时的下次执行时间：cron 算出的时间 / 当前时间 / 当前时间 + 5 分钟 */
export type CrashNextRun = { at: string } | 'now' | 'now+5m'

export class ScheduledTaskRepository {
  constructor(private readonly db: Executor) {}

  /** 数据库当前 UTC 时间文本（等价 datetime.utcnow()；clock_timestamp 在事务里也取真实时间） */
  async utcNow(): Promise<string> {
    const res = await this.db.execute<{ now: string }>(sql`SELECT timezone('utc', clock_timestamp()) AS now`)
    return res.rows[0]!.now
  }

  private taskWhere({ search, isActive, status }: TaskFilters): SQL | undefined {
    const conds: SQL[] = []
    if (search) {
      conds.push(
        or(
          ilike(scheduled_tasks.name, `%${search}%`),
          ilike(scheduled_tasks.task_code, `%${search}%`),
          ilike(scheduled_tasks.request_url, `%${search}%`),
        )!,
      )
    }
    if (isActive !== null) conds.push(eq(scheduled_tasks.is_active, isActive))
    if (status) conds.push(eq(scheduled_tasks.last_status, status))
    return conds.length > 0 ? and(...conds) : undefined
  }

  async listTasks(page: number, perPage: number, filters: TaskFilters) {
    const where = this.taskWhere(filters)
    const [totalRow] = await this.db.select({ n: count() }).from(scheduled_tasks).where(where)
    const items = await this.db
      .select()
      .from(scheduled_tasks)
      .where(where)
      .orderBy(desc(scheduled_tasks.id))
      .limit(perPage)
      .offset((page - 1) * perPage)
    return { total: totalRow?.n ?? 0, items }
  }

  async listRuns(page: number, perPage: number, { taskId, status }: RunFilters) {
    const conds: SQL[] = []
    if (taskId) conds.push(eq(scheduled_task_runs.task_id, taskId))
    if (status) conds.push(eq(scheduled_task_runs.status, status))
    const where = conds.length > 0 ? and(...conds) : undefined

    const [totalRow] = await this.db
      .select({ n: count() })
      .from(scheduled_task_runs)
      .innerJoin(scheduled_tasks, eq(scheduled_tasks.id, scheduled_task_runs.task_id))
      .where(where)
    const rows = await this.db
      .select({ run: scheduled_task_runs, task: { name: scheduled_tasks.name, task_code: scheduled_tasks.task_code } })
      .from(scheduled_task_runs)
      .innerJoin(scheduled_tasks, eq(scheduled_tasks.id, scheduled_task_runs.task_id))
      .where(where)
      .orderBy(desc(scheduled_task_runs.id))
      .limit(perPage)
      .offset((page - 1) * perPage)
    return { total: totalRow?.n ?? 0, items: rows as RunWithTask[] }
  }

  async getTask(id: number): Promise<ScheduledTask | null> {
    const [row] = await this.db.select().from(scheduled_tasks).where(eq(scheduled_tasks.id, id)).limit(1)
    return row ?? null
  }

  async getTaskByCode(taskCode: string): Promise<ScheduledTask | null> {
    const [row] = await this.db.select().from(scheduled_tasks).where(eq(scheduled_tasks.task_code, taskCode)).limit(1)
    return row ?? null
  }

  async findOtherTaskByCode(taskCode: string, excludeId: number): Promise<ScheduledTask | null> {
    const [row] = await this.db
      .select()
      .from(scheduled_tasks)
      .where(and(eq(scheduled_tasks.task_code, taskCode), ne(scheduled_tasks.id, excludeId)))
      .limit(1)
    return row ?? null
  }

  async insertTask(values: NewScheduledTask): Promise<ScheduledTask> {
    const [row] = await this.db.insert(scheduled_tasks).values(values).returning()
    return row!
  }

  /** 只写有变化的列（updated_at 由 schema 的 $onUpdateFn 刷新） */
  async updateTask(id: number, changes: TaskChanges): Promise<ScheduledTask | null> {
    const [row] = await this.db.update(scheduled_tasks).set(changes).where(eq(scheduled_tasks.id, id)).returning()
    return row ?? null
  }

  async deleteTask(id: number): Promise<void> {
    await this.db.delete(scheduled_tasks).where(eq(scheduled_tasks.id, id))
  }

  async insertRun(values: NewScheduledTaskRun): Promise<ScheduledTaskRun> {
    const [row] = await this.db.insert(scheduled_task_runs).values(values).returning()
    return row!
  }

  /** execute_task 的任务状态回写；run_count 在 SQL 里自增 */
  async recordTaskResult(
    id: number,
    result: { last_status: string; last_error: string | null; last_duration_ms: number; last_run_at: string; next_run_at: string | null },
  ): Promise<ScheduledTask | null> {
    const [row] = await this.db
      .update(scheduled_tasks)
      .set({ ...result, run_count: sql`coalesce(${scheduled_tasks.run_count}, 0) + 1` })
      .where(eq(scheduled_tasks.id, id))
      .returning()
    return row ?? null
  }

  // ---- 调度器租约 ----

  /** 到期任务：is_active 且 next_run_at <= now，按 next_run_at 升序取 20 条 */
  async listDueTasks(limit = 20): Promise<ScheduledTask[]> {
    return this.db
      .select()
      .from(scheduled_tasks)
      .where(
        and(
          sql`${scheduled_tasks.is_active} IS true`,
          isNotNull(scheduled_tasks.next_run_at),
          lte(scheduled_tasks.next_run_at, utcNow()),
        ),
      )
      .orderBy(asc(scheduled_tasks.next_run_at))
      .limit(limit)
  }

  /**
   * 抢占：`next_run_at` 仍等于读到的值才置空并标 running。
   * 多个调度进程并发时只有一个 UPDATE 命中（rowCount === 1）。
   */
  async claim(id: number, nextRunAt: string): Promise<boolean> {
    const rows = await this.db
      .update(scheduled_tasks)
      .set({ next_run_at: null, last_status: 'running', updated_at: utcNow() })
      .where(and(eq(scheduled_tasks.id, id), sql`${scheduled_tasks.is_active} IS true`, eq(scheduled_tasks.next_run_at, nextRunAt)))
      .returning({ id: scheduled_tasks.id })
    return rows.length === 1
  }

  /** 过期租约回收：running 且 next_run_at 为空、updated_at 早于 now - lease 的任务重置为 idle 并立即到期 */
  async recoverStaleClaims(leaseSeconds: number): Promise<number> {
    const rows = await this.db
      .update(scheduled_tasks)
      .set({
        next_run_at: utcNow(),
        last_status: 'idle',
        last_error: '任务租约超时，已自动回收等待重试',
        updated_at: utcNow(),
      })
      .where(
        and(
          sql`${scheduled_tasks.is_active} IS true`,
          isNull(scheduled_tasks.next_run_at),
          eq(scheduled_tasks.last_status, 'running'),
          isNotNull(scheduled_tasks.updated_at),
          lte(scheduled_tasks.updated_at, sql`${utcNow()} - make_interval(secs => ${leaseSeconds})`),
        ),
      )
      .returning({ id: scheduled_tasks.id })
    return rows.length
  }

  /** 执行器崩溃：仍处于已抢占状态（next_run_at 为空）时标 failed 并排下一次 */
  async markCrashed(id: number, next: CrashNextRun): Promise<void> {
    const nextRunAt = next === 'now' ? utcNow() : next === 'now+5m' ? sql`${utcNow()} + interval '5 minutes'` : next.at
    await this.db
      .update(scheduled_tasks)
      .set({
        next_run_at: nextRunAt,
        last_status: 'failed',
        last_error: '执行器异常中断，任务已自动回收等待重试',
        updated_at: utcNow(),
      })
      .where(and(eq(scheduled_tasks.id, id), isNull(scheduled_tasks.next_run_at)))
  }
}
