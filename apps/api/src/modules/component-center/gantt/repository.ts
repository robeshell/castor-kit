/**
 * 甘特图页 repository 层
 */

import { and, asc, eq } from 'drizzle-orm'
import type { Executor } from '@/db/client'
import { cc_gantt_tasks, type GanttTask } from '@/db/schema'

const INT32_MIN = -2_147_483_648
const INT32_MAX = 2_147_483_647

export type GanttTaskInsert = typeof cc_gantt_tasks.$inferInsert
/** start_date/end_date 可能被置为 NULL（照写，由 NOT NULL 约束报错） */
export type GanttTaskPatch = Partial<Omit<GanttTask, 'id' | 'created_at' | 'updated_at' | 'start_date' | 'end_date'>> & {
  start_date?: string | null
  end_date?: string | null
}

export class GanttRepository {
  constructor(private readonly db: Executor) {}

  async allTasks(status: string | null, priority: string | null): Promise<GanttTask[]> {
    return this.db
      .select()
      .from(cc_gantt_tasks)
      .where(
        and(
          status ? eq(cc_gantt_tasks.status, status) : undefined,
          priority ? eq(cc_gantt_tasks.priority, priority) : undefined,
        ),
      )
      .orderBy(asc(cc_gantt_tasks.sort_order))
  }

  async getTask(id: number): Promise<GanttTask | null> {
    if (!Number.isInteger(id) || id < INT32_MIN || id > INT32_MAX) return null
    const [row] = await this.db.select().from(cc_gantt_tasks).where(eq(cc_gantt_tasks.id, id))
    return row ?? null
  }

  async insert(values: GanttTaskInsert): Promise<GanttTask> {
    const [row] = await this.db.insert(cc_gantt_tasks).values(values).returning()
    return row!
  }

  async update(id: number, patch: GanttTaskPatch): Promise<void> {
    await this.db
      .update(cc_gantt_tasks)
      .set(patch as Partial<GanttTaskInsert>)
      .where(eq(cc_gantt_tasks.id, id))
  }

  async delete(id: number): Promise<void> {
    await this.db.delete(cc_gantt_tasks).where(eq(cc_gantt_tasks.id, id))
  }
}
