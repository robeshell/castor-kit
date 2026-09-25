/**
 * Scheduler end-to-end: actually starts a web process (RUN_SCHEDULER_IN_WEB=true) and a standalone worker process; tasks fire on cron and write scheduled_task_runs.
 *
 * Requires: a free port (default 5260, override with SCHEDULER_E2E_PORT), direct internet access to https://1.1.1.1 (the target is Cloudflare's read-only trace page, no side effects),
 * and about 90 seconds (it waits for the next full minute). Skipped by default; enable explicitly:
 *   SCHEDULER_E2E=1 TEST_DATABASE_URL=... npx vitest run test/scheduler-e2e.test.ts
 */

import { spawn, type ChildProcess } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { and, eq, like } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { computeNextRunAt } from '@/common/scheduler/cron'
import type { DbHandle } from '@/db/client'
import { scheduled_task_runs, scheduled_tasks } from '@/db/schema'
import { ScheduledTaskRepository } from '@/modules/admin/scheduled-task/repository'
import { openTestDb, TEST_DATABASE_URL } from './helpers'

const ENABLED = process.env.SCHEDULER_E2E === '1'
const PORT = Number(process.env.SCHEDULER_E2E_PORT ?? 5260)
const BASE = `http://127.0.0.1:${PORT}`
const API_ROOT = fileURLToPath(new URL('..', import.meta.url))
const CODE = 'ck_test_r6_e2e_every_minute'
const TARGET = 'https://1.1.1.1/cdn-cgi/trace'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function startProcess(entry: string, extraEnv: Record<string, string>): { proc: ChildProcess; output: () => string } {
  let out = ''
  const proc = spawn('npx', ['tsx', entry], {
    cwd: API_ROOT,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      TEST_DATABASE_URL,
      ENABLE_TASK_SCHEDULER: 'true',
      TASK_SCHEDULER_INTERVAL_SECONDS: '5',
      ...extraEnv,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  proc.stdout!.on('data', (c: Buffer) => (out += c.toString()))
  proc.stderr!.on('data', (c: Buffer) => (out += c.toString()))
  return { proc, output: () => out }
}

async function stopProcess(proc: ChildProcess): Promise<number | null> {
  if (proc.exitCode !== null) return proc.exitCode
  const exited = new Promise<number | null>((resolve) => proc.once('exit', (code) => resolve(code)))
  proc.kill('SIGTERM')
  return Promise.race([exited, sleep(8000).then(() => (proc.kill('SIGKILL'), null))])
}

async function waitFor<T>(fn: () => Promise<T | null | undefined | false>, timeoutMs: number, stepMs = 500): Promise<T> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const value = await fn()
    if (value) return value
    await sleep(stepMs)
  }
  throw new Error(`等待超时（${timeoutMs}ms）`)
}

describe.skipIf(!ENABLED)('调度器端到端', () => {
  let handle: DbHandle
  let web: ReturnType<typeof startProcess>
  let worker: ReturnType<typeof startProcess> | null = null

  const runsOf = (taskId: number) =>
    handle.db.select().from(scheduled_task_runs).where(and(eq(scheduled_task_runs.task_id, taskId), eq(scheduled_task_runs.trigger_type, 'scheduled')))

  beforeAll(async () => {
    handle = openTestDb()
    await handle.db.delete(scheduled_tasks).where(like(scheduled_tasks.task_code, 'ck_test_r6_e2e_%'))
    web = startProcess('src/main.ts', { PORT: String(PORT), RUN_SCHEDULER_IN_WEB: 'true' })
    await waitFor(async () => (await fetch(`${BASE}/health`).then((r) => r.ok).catch(() => false)) || null, 30_000)
  }, 40_000)

  afterAll(async () => {
    if (worker) await stopProcess(worker.proc)
    if (web) await stopProcess(web.proc)
    await handle.db.delete(scheduled_tasks).where(like(scheduled_tasks.task_code, 'ck_test_r6_e2e_%'))
    await handle.pool.end()
  }, 30_000)

  it('web 进程内调度：通过接口新建每分钟任务，到点自动执行并写执行记录、排下一次', async () => {
    expect(web.output()).toContain('定时任务调度器已在 web 进程内启动（间隔 5s')

    const login = await fetch(`${BASE}/api/admin/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' }),
    })
    expect(login.status).toBe(200)
    const cookie = login.headers.getSetCookie().map((c) => c.split(';', 1)[0]).join('; ')
    const csrf = ((await login.json()) as { csrf_token: string }).csrf_token

    const created = await fetch(`${BASE}/api/admin/scheduled-tasks`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie, 'x-csrf-token': csrf },
      body: JSON.stringify({ name: 'e2e 每分钟', task_code: CODE, cron_expression: '* * * * *', request_url: TARGET, timeout_seconds: 10 }),
    })
    expect(created.status).toBe(201)
    const task = (await created.json()) as { id: number; next_run_at: string }
    expect(task.next_run_at).toMatch(/:00$/)

    // Wait for a scheduling round after next_run_at (the next full minute)
    const [run] = await waitFor(async () => {
      const rows = await runsOf(task.id)
      return rows.length > 0 ? rows : null
    }, 90_000, 1000)
    expect(run).toMatchObject({ status: 'success', response_status: 200, error_message: null })
    expect(run!.response_body).toContain('h=1.1.1.1')
    // Fire time is not earlier than the time computed from cron
    expect(run!.started_at! >= task.next_run_at.replace('T', ' ')).toBe(true)

    const [after] = await handle.db.select().from(scheduled_tasks).where(eq(scheduled_tasks.id, task.id))
    expect(after).toMatchObject({ last_status: 'success', run_count: 1 })
    expect(after!.next_run_at).toBe(computeNextRunAt('* * * * *', run!.finished_at!))
  }, 120_000)

  it('独立 worker 与 web 同时运行：同一到期任务只执行一次', async () => {
    worker = startProcess('src/worker.ts', {})
    await waitFor(async () => worker!.output().includes('Scheduled task worker started.') || null, 30_000)

    const [task] = await handle.db.select().from(scheduled_tasks).where(eq(scheduled_tasks.task_code, CODE))
    const before = (await runsOf(task!.id)).length
    // Make it due immediately and change cron to once a day, so it doesn't hit the next minute again while waiting
    const now = await new ScheduledTaskRepository(handle.db).utcNow()
    await handle.db
      .update(scheduled_tasks)
      .set({ cron_expression: '0 3 * * *', next_run_at: now })
      .where(eq(scheduled_tasks.id, task!.id))

    await waitFor(async () => (await runsOf(task!.id)).length > before || null, 20_000)
    // Each process polls at least two more times, and there is still only one new record
    await sleep(11_000)
    expect((await runsOf(task!.id)).length).toBe(before + 1)
    const [after] = await handle.db.select().from(scheduled_tasks).where(eq(scheduled_tasks.id, task!.id))
    expect(after!.next_run_at).toMatch(/ 03:00:00$/)

    expect(await stopProcess(worker.proc)).toBe(0)
    expect(worker.output()).toContain('Scheduled task worker stopped.')
    worker = null
  }, 90_000)
})
