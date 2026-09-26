/**
 * Scheduler lease model + execute_task (real PostgreSQL)
 */

import { eq, like, sql } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { computeNextRunAt } from '@/common/scheduler/cron'
import type { HttpExecutor, HttpRequestSpec } from '@/common/scheduler/http'
import { ScheduledTaskRunner } from '@/common/scheduler/runner'
import type { DbHandle } from '@/db/client'
import { scheduled_task_runs, scheduled_tasks, type ScheduledTask } from '@/db/schema'
import { ScheduledTaskRepository } from '@/modules/admin/scheduled-task/repository'
import { ScheduledTaskService } from '@/modules/admin/scheduled-task/service'
import { openTestDb } from './helpers'

const P = 'ck_test_r6_rn_'
let handle: DbHandle
/** Second connection pool: simulates another scheduler process */
let handle2: DbHandle
let seq = 0

type Exec = HttpExecutor & { calls: HttpRequestSpec[] }

function fakeExecutor(respond: (spec: HttpRequestSpec) => Promise<{ status: number; text: string }> | { status: number; text: string }): Exec {
  const calls: HttpRequestSpec[] = []
  const fn = (async (spec: HttpRequestSpec) => {
    calls.push(spec)
    return respond(spec)
  }) as Exec
  fn.calls = calls
  return fn
}

async function dbNow(h: DbHandle = handle): Promise<string> {
  return new ScheduledTaskRepository(h.db).utcNow()
}

async function insertTask(values: Partial<typeof scheduled_tasks.$inferInsert> = {}): Promise<ScheduledTask> {
  seq += 1
  const [row] = await handle.db
    .insert(scheduled_tasks)
    .values({
      name: `runner ${seq}`,
      task_code: `${P}${seq}`,
      cron_expression: '*/5 * * * *',
      request_method: 'GET',
      request_url: 'https://1.1.1.1/x',
      timeout_seconds: 10,
      is_active: true,
      last_status: 'idle',
      run_count: 0,
      next_run_at: sql`timezone('utc', now()) - interval '1 minute'` as unknown as string,
      ...values,
    })
    .returning()
  return row!
}

async function getTask(id: number): Promise<ScheduledTask> {
  const [row] = await handle.db.select().from(scheduled_tasks).where(eq(scheduled_tasks.id, id))
  return row!
}

async function runsOf(id: number) {
  return handle.db.select().from(scheduled_task_runs).where(eq(scheduled_task_runs.task_id, id))
}

async function cleanup() {
  await handle.db.delete(scheduled_tasks).where(like(scheduled_tasks.task_code, `${P}%`))
}

beforeAll(async () => {
  handle = openTestDb()
  handle2 = openTestDb()
  await cleanup()
})

beforeEach(async () => {
  // Each case makes only its own task due, to avoid processing other due tasks in the DB
  await handle.db
    .update(scheduled_tasks)
    .set({ next_run_at: '2099-01-01 00:00:00' })
    .where(sql`${scheduled_tasks.next_run_at} <= timezone('utc', now())`)
})

afterAll(async () => {
  await cleanup()
  await handle.pool.end()
  await handle2.pool.end()
})

describe('间隔与租约参数（构造函数）', () => {
  it('interval 至少 5 秒，0 回落 20；lease 至少 3 倍 interval，0 回落 1800', () => {
    const a = new ScheduledTaskRunner(handle.db, { intervalSeconds: 1, leaseSeconds: 10 })
    expect([a.intervalSeconds, a.leaseSeconds]).toEqual([5, 15])
    const b = new ScheduledTaskRunner(handle.db, { intervalSeconds: 0, leaseSeconds: 0 })
    expect([b.intervalSeconds, b.leaseSeconds]).toEqual([20, 1800])
    const c = new ScheduledTaskRunner(handle.db, { intervalSeconds: 30, leaseSeconds: 60 })
    expect([c.intervalSeconds, c.leaseSeconds]).toEqual([30, 90])
  })
})

describe('claim 并发安全', () => {
  it('多个进程抢同一任务同一 next_run_at：只有一个成功', async () => {
    for (let round = 0; round < 10; round += 1) {
      const task = await insertTask()
      const repos = [handle, handle2, handle, handle2, handle].map((h) => new ScheduledTaskRepository(h.db))
      const results = await Promise.all(repos.map((r) => r.claim(task.id, task.next_run_at!)))
      expect(results.filter(Boolean)).toHaveLength(1)
      const after = await getTask(task.id)
      expect(after.next_run_at).toBeNull()
      expect(after.last_status).toBe('running')
    }
  })

  it('next_run_at 已变化 / 任务已停用：claim 失败', async () => {
    const task = await insertTask()
    const repo = new ScheduledTaskRepository(handle.db)
    expect(await repo.claim(task.id, '2000-01-01 00:00:00')).toBe(false)
    const inactive = await insertTask({ is_active: false })
    expect(await repo.claim(inactive.id, inactive.next_run_at!)).toBe(false)
  })

  it('两个 runner 同时跑一轮：同一到期任务只执行一次、只写一条执行记录', async () => {
    const task = await insertTask()
    const ex1 = fakeExecutor(async () => ({ status: 200, text: 'one' }))
    const ex2 = fakeExecutor(async () => ({ status: 200, text: 'two' }))
    const r1 = new ScheduledTaskRunner(handle.db, { service: new ScheduledTaskService(handle.db, { httpExecutor: ex1 }) })
    const r2 = new ScheduledTaskRunner(handle2.db, { service: new ScheduledTaskService(handle2.db, { httpExecutor: ex2 }) })
    await Promise.all([r1.executeDueTasks(), r2.executeDueTasks(), r1.executeDueTasks()])
    expect(ex1.calls.length + ex2.calls.length).toBe(1)
    const runs = await runsOf(task.id)
    expect(runs).toHaveLength(1)
    expect(runs[0]!.trigger_type).toBe('scheduled')
    const after = await getTask(task.id)
    expect(after.run_count).toBe(1)
    expect(after.last_status).toBe('success')
  })
})

describe('执行一轮（executeDueTasks）', () => {
  it('成功：写 scheduled 执行记录，按 cron 从 finished_at 排下一次', async () => {
    const task = await insertTask({ cron_expression: '*/5 * * * *', request_headers: '{"X-A": 1, "B": true, "C": null, "D": 1.0}' })
    const ex = fakeExecutor(async () => {
      await new Promise((r) => setTimeout(r, 30))
      return { status: 200, text: 'fine' }
    })
    const runner = new ScheduledTaskRunner(handle.db, { service: new ScheduledTaskService(handle.db, { httpExecutor: ex }) })
    await runner.executeDueTasks()

    expect(ex.calls).toHaveLength(1)
    expect(ex.calls[0]).toMatchObject({
      method: 'GET',
      url: 'https://1.1.1.1/x',
      headers: { 'X-A': '1', B: 'True', C: 'None', D: '1.0' },
      body: null,
      timeoutSeconds: 10,
    })
    const [run] = await runsOf(task.id)
    expect(run).toMatchObject({ status: 'success', response_status: 200, response_body: 'fine', error_message: null, trigger_type: 'scheduled' })
    expect(run!.duration_ms).toBeGreaterThanOrEqual(25)
    const after = await getTask(task.id)
    expect(after).toMatchObject({ last_status: 'success', last_error: null, run_count: 1, last_run_at: run!.finished_at })
    expect(after.next_run_at).toBe(computeNextRunAt('*/5 * * * *', run!.finished_at!))
    expect(after.last_duration_ms).toBe(run!.duration_ms)
  })

  it('HTTP >= 400 记 failed（HTTP 503），响应体按字符截断到 2000', async () => {
    const task = await insertTask()
    const long = '😀'.repeat(1500) + 'x'.repeat(1500)
    const ex = fakeExecutor(() => ({ status: 503, text: long }))
    await new ScheduledTaskRunner(handle.db, { service: new ScheduledTaskService(handle.db, { httpExecutor: ex }) }).executeDueTasks()
    const [run] = await runsOf(task.id)
    expect(run).toMatchObject({ status: 'failed', response_status: 503, error_message: 'HTTP 503' })
    expect([...run!.response_body!]).toHaveLength(2000)
    expect(run!.response_body).toBe('😀'.repeat(1500) + 'x'.repeat(500))
    expect((await getTask(task.id)).last_error).toBe('HTTP 503')
  })

  it('执行器抛错：failed，error_message 为异常信息，response_status 为空', async () => {
    const task = await insertTask()
    const ex = fakeExecutor(() => {
      throw new Error('connect ECONNREFUSED')
    })
    await new ScheduledTaskRunner(handle.db, { service: new ScheduledTaskService(handle.db, { httpExecutor: ex }) }).executeDueTasks()
    const [run] = await runsOf(task.id)
    expect(run).toMatchObject({ status: 'failed', response_status: null, response_body: null, error_message: 'connect ECONNREFUSED' })
  })

  it('请求体：dict/list → json（Python json.dumps 形态）；其他 → data=str(parsed)；NaN → failed', async () => {
    const cases: Array<[string, HttpRequestSpec['body'] | 'nan']> = [
      ['{"a": 1.0, "b": [1, "中"]}', { kind: 'json', text: '{"a": 1.0, "b": [1, "\\u4e2d"]}' }],
      ['[1,2]', { kind: 'json', text: '[1, 2]' }],
      ['  hello  ', { kind: 'data', text: 'hello' }],
      ['123', { kind: 'data', text: '123' }],
      ['1e5', { kind: 'data', text: '100000.0' }],
      ['true', { kind: 'data', text: 'True' }],
      ['null', { kind: 'data', text: 'None' }],
      ['"quoted"', { kind: 'data', text: 'quoted' }],
      ['{"x": NaN}', 'nan'],
    ]
    for (const [raw, expected] of cases) {
      const task = await insertTask({ request_body: raw, request_method: 'POST' })
      const ex = fakeExecutor(() => ({ status: 200, text: '' }))
      await new ScheduledTaskService(handle.db, { httpExecutor: ex }).executeTask(task, 'manual')
      if (expected === 'nan') {
        expect(ex.calls).toHaveLength(0)
        const [run] = await runsOf(task.id)
        expect(run).toMatchObject({ status: 'failed', error_message: 'Out of range float values are not JSON compliant: nan' })
      } else {
        expect(ex.calls[0]!.body).toEqual(expected)
      }
    }
  })

  it('超时参数 max(1, min(int(x or 10), 120))', async () => {
    for (const [value, expected] of [
      [500, 120],
      [0, 10],
      [null, 10],
      [-3, 1],
    ] as const) {
      const task = await insertTask({ timeout_seconds: value })
      const ex = fakeExecutor(() => ({ status: 200, text: '' }))
      await new ScheduledTaskService(handle.db, { httpExecutor: ex }).executeTask(task)
      expect(ex.calls[0]!.timeoutSeconds).toBe(expected)
    }
  })

  it('cron 在执行时已非法：记 failed 并带 cron 错误文案，next_run_at 为空', async () => {
    const task = await insertTask({ cron_expression: '0 0 30 2 *' })
    const ex = fakeExecutor(() => ({ status: 200, text: 'ok' }))
    await new ScheduledTaskRunner(handle.db, { service: new ScheduledTaskService(handle.db, { httpExecutor: ex }) }).executeDueTasks()
    const [run] = await runsOf(task.id)
    expect(run).toMatchObject({ status: 'failed', response_status: 200, error_message: 'Cron 表达式在一年内没有可触发时间，请检查配置' })
    const after = await getTask(task.id)
    expect(after.next_run_at).toBeNull()
    expect(after.last_status).toBe('failed')
  })
})

describe('崩溃标记与过期租约回收', () => {
  it('execute_task 抛异常（请求头非法）：按 cron 排下一次并标 failed，不写执行记录', async () => {
    const task = await insertTask({ request_headers: '{bad', cron_expression: '0 * * * *' })
    const ex = fakeExecutor(() => ({ status: 200, text: '' }))
    const before = await dbNow()
    await new ScheduledTaskRunner(handle.db, { service: new ScheduledTaskService(handle.db, { httpExecutor: ex }) }).executeDueTasks()
    expect(ex.calls).toHaveLength(0)
    expect(await runsOf(task.id)).toHaveLength(0)
    const after = await getTask(task.id)
    expect(after.last_status).toBe('failed')
    expect(after.last_error).toBe('执行器异常中断，任务已自动回收等待重试')
    expect(after.next_run_at).toBe(computeNextRunAt('0 * * * *', before))
  })

  it('崩溃且 cron 非法：5 分钟后重试', async () => {
    const task = await insertTask({ request_headers: '[1]', cron_expression: 'bad cron' })
    await new ScheduledTaskRunner(handle.db, {
      service: new ScheduledTaskService(handle.db, { httpExecutor: fakeExecutor(() => ({ status: 200, text: '' })) }),
    }).executeDueTasks()
    const res = await handle.db.execute<{ ok: boolean }>(
      sql`SELECT next_run_at BETWEEN timezone('utc', now()) + interval '4 minutes' AND timezone('utc', now()) + interval '6 minutes' AS ok
          FROM scheduled_tasks WHERE id = ${task.id}`,
    )
    expect(res.rows[0]!.ok).toBe(true)
    expect((await getTask(task.id)).last_status).toBe('failed')
  })

  it('过期租约：running + next_run_at 为空 + updated_at 早于 lease → idle 并立即到期；未过期 / 停用的不动', async () => {
    const stale = await insertTask({
      last_status: 'running',
      next_run_at: null,
      updated_at: sql`timezone('utc', now()) - interval '2 hours'` as unknown as string,
    })
    const fresh = await insertTask({
      last_status: 'running',
      next_run_at: null,
      updated_at: sql`timezone('utc', now()) - interval '10 seconds'` as unknown as string,
    })
    const inactive = await insertTask({
      is_active: false,
      last_status: 'running',
      next_run_at: null,
      updated_at: sql`timezone('utc', now()) - interval '2 hours'` as unknown as string,
    })
    const runner = new ScheduledTaskRunner(handle.db, { leaseSeconds: 1800 })
    expect(await runner.recoverStaleClaims()).toBe(1)

    const s = await getTask(stale.id)
    expect(s).toMatchObject({ last_status: 'idle', last_error: '任务租约超时，已自动回收等待重试' })
    expect(s.next_run_at).not.toBeNull()
    expect((await getTask(fresh.id)).last_status).toBe('running')
    expect((await getTask(inactive.id)).last_status).toBe('running')

    // A reclaimed task is re-executed in the next round
    const ex = fakeExecutor(() => ({ status: 200, text: 'again' }))
    await new ScheduledTaskRunner(handle.db, { service: new ScheduledTaskService(handle.db, { httpExecutor: ex }) }).executeDueTasks()
    expect(ex.calls).toHaveLength(1)
    expect((await getTask(stale.id)).last_status).toBe('success')
  })
})

describe('start / stop 循环', () => {
  it('start 后立即跑第一轮；stop 能及时结束睡眠', async () => {
    const task = await insertTask()
    const ex = fakeExecutor(() => ({ status: 200, text: 'loop' }))
    const runner = new ScheduledTaskRunner(handle.db, {
      intervalSeconds: 60,
      service: new ScheduledTaskService(handle.db, { httpExecutor: ex }),
    })
    runner.start()
    for (let i = 0; i < 50 && ex.calls.length === 0; i += 1) await new Promise((r) => setTimeout(r, 100))
    expect(ex.calls).toHaveLength(1)
    const t0 = performance.now()
    await runner.stop()
    expect(performance.now() - t0).toBeLessThan(1000)
    expect(runner.running).toBe(false)
    expect((await runsOf(task.id))[0]!.response_body).toBe('loop')
  })
})

describe('内置维护任务', () => {
  it('按各自间隔执行；失败只记日志，下个间隔再试', async () => {
    const calls: string[] = []
    const errors: string[] = []
    const runner = new ScheduledTaskRunner(handle.db, {
      logger: { info() {}, warn() {}, error: (_o: unknown, msg?: string) => void errors.push(String(msg)) },
      maintenance: [
        { name: 'ok', intervalSeconds: 60, run: async () => void calls.push('ok') },
        {
          name: 'boom',
          intervalSeconds: 60,
          run: async () => {
            calls.push('boom')
            throw new Error('x')
          },
        },
      ],
    })
    await runner.runMaintenance(1_000_000)
    await runner.runMaintenance(1_000_000 + 30_000)
    await runner.runMaintenance(1_000_000 + 60_000)
    expect(calls).toEqual(['ok', 'boom', 'ok', 'boom'])
    expect(errors).toEqual(['Maintenance job failed: boom', 'Maintenance job failed: boom'])
  })
})
