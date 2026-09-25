/**
 * 手动执行 `/run` 与 `/runs`：真实 HTTP 往返（本地服务作为任务目标）
 *
 * 本地服务在 127.0.0.1 上，会被执行阶段的 SSRF 复检拦下。因此打桩：
 * 只替换连接阶段用的 isBlockedIp，让“环回地址”放行；validateRequestUrl 内部仍用真实判定（新增/编辑照样拦 127.0.0.1），
 * 生产代码不做任何放宽。其他内网网段（如 10.x）在这里依然被拦。
 */

import { createServer, type IncomingMessage, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { eq, like } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { computeNextRunAt } from '@/common/scheduler/cron'
import type { DbHandle } from '@/db/client'
import { scheduled_task_runs, scheduled_tasks, type ScheduledTask } from '@/db/schema'
import { buildTestApp, openTestDb, superAdminSession, type AuthedSession } from './helpers'

vi.mock('@/common/scheduler/ssrf', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/common/scheduler/ssrf')>()
  return {
    ...actual,
    isBlockedIp: (ip: string) => (ip === '127.0.0.1' || ip === '::ffff:127.0.0.1' ? false : actual.isBlockedIp(ip)),
  }
})

const P = 'ck_test_r6_run_'
const T = '/api/admin/scheduled-tasks'
let app: FastifyInstance
let handle: DbHandle
let s: AuthedSession
let server: Server
let base: string
const received: Array<{ method: string; url: string; headers: IncomingMessage['headers']; body: string }> = []

async function seedTask(values: Partial<typeof scheduled_tasks.$inferInsert>): Promise<ScheduledTask> {
  const [row] = await handle.db
    .insert(scheduled_tasks)
    .values({
      name: '执行任务',
      task_code: `${P}${Math.random().toString(36).slice(2, 8)}`,
      cron_expression: '*/5 * * * *',
      request_method: 'GET',
      request_url: `${base}/ok`,
      timeout_seconds: 5,
      is_active: true,
      last_status: 'idle',
      run_count: 0,
      next_run_at: '2099-01-01 00:00:00',
      ...values,
    })
    .returning()
  return row!
}

beforeAll(async () => {
  server = createServer((req, res) => {
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => chunks.push(c))
    req.on('end', () => {
      const body = Buffer.concat(chunks).toString('utf8')
      received.push({ method: req.method!, url: req.url!, headers: req.headers, body })
      const path = req.url!.split('?')[0]
      if (path === '/ok') {
        res.setHeader('content-type', 'text/plain; charset=utf-8')
        return res.end('你好，scheduler')
      }
      if (path === '/fail') {
        res.statusCode = 502
        return res.end('bad gateway')
      }
      if (path === '/echo') {
        res.setHeader('content-type', 'application/json')
        return res.end(JSON.stringify({ method: req.method, ctype: req.headers['content-type'] ?? null, body }))
      }
      if (path === '/latin') {
        res.setHeader('content-type', 'text/plain')
        return res.end(Buffer.from([0x63, 0x61, 0x66, 0xe9, 0x80]))
      }
      if (path === '/long') {
        res.setHeader('content-type', 'text/plain; charset=utf-8')
        return res.end('中'.repeat(2500))
      }
      if (path === '/redirect') {
        res.statusCode = 302
        res.setHeader('location', '/echo')
        return res.end()
      }
      if (path === '/redirect-307') {
        res.statusCode = 307
        res.setHeader('location', '/echo')
        return res.end()
      }
      if (path === '/redirect-private') {
        res.statusCode = 302
        res.setHeader('location', 'http://10.255.255.1/')
        return res.end()
      }
      if (path === '/slow') {
        setTimeout(() => res.end('late'), 3000)
        return
      }
      res.statusCode = 404
      res.end('nf')
    })
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`

  handle = openTestDb()
  await handle.db.delete(scheduled_tasks).where(like(scheduled_tasks.task_code, `${P}%`))
  app = await buildTestApp()
  s = await superAdminSession(app, handle)
})

afterAll(async () => {
  await handle.db.delete(scheduled_tasks).where(like(scheduled_tasks.task_code, `${P}%`))
  await app.close()
  await handle.pool.end()
  server.closeAllConnections()
  await new Promise<void>((resolve) => server.close(() => resolve()))
})

const run = (task: ScheduledTask) => s.inject({ method: 'POST', url: `${T}/${task.id}/run` })

describe('手动执行（真实 HTTP）', () => {
  it('成功 200：执行记录、任务状态、下次执行时间', async () => {
    const task = await seedTask({ request_headers: '{"X-Token": "abc", "X-Num": 7}' })
    const res = await run(task)
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(Object.keys(body).sort()).toEqual(['message', 'run', 'task'])
    expect(body).toMatchObject({
      message: '执行成功',
      task: { id: task.id, last_status: 'success', last_error: null, run_count: 1 },
      run: { task_id: task.id, task_name: '执行任务', task_code: task.task_code, trigger_type: 'manual', status: 'success', response_status: 200, response_body: '你好，scheduler', error_message: null },
    })
    expect(body.task.last_run_at).toBe(body.run.finished_at)
    expect(body.task.last_duration_ms).toBe(body.run.duration_ms)
    const [stored] = await handle.db.select().from(scheduled_tasks).where(eq(scheduled_tasks.id, task.id))
    const [storedRun] = await handle.db.select().from(scheduled_task_runs).where(eq(scheduled_task_runs.task_id, task.id))
    expect(stored!.next_run_at).toBe(computeNextRunAt('*/5 * * * *', storedRun!.finished_at!))

    const hit = received.filter((r) => r.url === '/ok').at(-1)!
    expect(hit.headers['x-token']).toBe('abc')
    expect(hit.headers['x-num']).toBe('7')

    // 再执行一次：run_count 累加；/runs 能按任务查到两条
    await run(task)
    const runs = (await s.inject({ url: `${T}/runs?task_id=${task.id}` })).json()
    expect(runs.total).toBe(2)
    expect(runs.items.every((r: { task_code: string }) => r.task_code === task.task_code)).toBe(true)
    expect(runs.items[0].id).toBeGreaterThan(runs.items[1].id)
  })

  it('目标返回 502：500 + 完整结果体（error=HTTP 502）', async () => {
    const task = await seedTask({ request_url: `${base}/fail` })
    const res = await run(task)
    expect(res.statusCode).toBe(500)
    expect(res.json()).toMatchObject({
      message: '执行失败',
      error: 'HTTP 502',
      run: { status: 'failed', response_status: 502, response_body: 'bad gateway', error_message: 'HTTP 502' },
      task: { last_status: 'failed', last_error: 'HTTP 502' },
    })
    const failedRuns = (await s.inject({ url: `${T}/runs?task_id=${task.id}&status=failed` })).json()
    expect(failedRuns.total).toBe(1)
  })

  it('请求体：JSON 对象按 requests json= 发送（json.dumps 默认分隔符 + ensure_ascii + Content-Type）；纯文本按 data= 发送', async () => {
    const json = await seedTask({ request_url: `${base}/echo`, request_method: 'POST', request_body: '{"a": 1.0, "名": "值"}' })
    const res = await run(json)
    expect(JSON.parse(res.json().run.response_body)).toEqual({
      method: 'POST',
      ctype: 'application/json',
      body: '{"a": 1.0, "\\u540d": "\\u503c"}',
    })

    const text = await seedTask({ request_url: `${base}/echo`, request_method: 'PUT', request_body: '纯文本' })
    expect(JSON.parse((await run(text)).json().run.response_body)).toEqual({ method: 'PUT', ctype: null, body: '纯文本' })

    // 自定义 Content-Type 不被覆盖；GET 也带请求体（requests 行为）
    const custom = await seedTask({
      request_url: `${base}/echo`,
      request_headers: '{"content-type": "application/vnd.x+json"}',
      request_body: '[1]',
    })
    expect(JSON.parse((await run(custom)).json().run.response_body)).toEqual({ method: 'GET', ctype: 'application/vnd.x+json', body: '[1]' })
  })

  it('响应解码与截断：text/* 无 charset 按 latin-1；按字符截到 2000', async () => {
    const latin = await seedTask({ request_url: `${base}/latin` })
    expect((await run(latin)).json().run.response_body).toBe('café\u0080')
    const long = await seedTask({ request_url: `${base}/long` })
    expect((await run(long)).json().run.response_body).toBe('中'.repeat(2000))
  })

  it('重定向：302 把 POST 改成 GET 并丢弃请求体；307 保留；跳到内网网段被拦', async () => {
    const r302 = await seedTask({ request_url: `${base}/redirect`, request_method: 'POST', request_body: '{"k": 1}' })
    expect(JSON.parse((await run(r302)).json().run.response_body)).toEqual({ method: 'GET', ctype: null, body: '' })
    const r307 = await seedTask({ request_url: `${base}/redirect-307`, request_method: 'POST', request_body: '{"k": 1}' })
    expect(JSON.parse((await run(r307)).json().run.response_body)).toEqual({ method: 'POST', ctype: 'application/json', body: '{"k": 1}' })

    const priv = await seedTask({ request_url: `${base}/redirect-private` })
    const res = await run(priv)
    expect(res.statusCode).toBe(500)
    expect(res.json()).toMatchObject({ error: '不允许访问内网地址', run: { status: 'failed', response_status: null } })
  })

  it('超时：timeout_seconds 生效，记 failed', async () => {
    const task = await seedTask({ request_url: `${base}/slow`, timeout_seconds: 1 })
    const t0 = performance.now()
    const res = await run(task)
    expect(performance.now() - t0).toBeLessThan(2500)
    expect(res.statusCode).toBe(500)
    expect(res.json()).toMatchObject({ error: 'Request timed out. (timeout=1)', run: { status: 'failed', response_status: null } })
    expect(res.json().run.duration_ms).toBeGreaterThanOrEqual(900)
  })

  it('停用任务手动执行：成功但 next_run_at 置空', async () => {
    const task = await seedTask({ is_active: false })
    const res = await run(task)
    expect(res.statusCode).toBe(200)
    expect(res.json().task.next_run_at).toBeNull()
  })

  it('新增/编辑的 URL 校验不受打桩影响：127.0.0.1 仍被拒绝', async () => {
    const task = await seedTask({})
    const res = await s.inject({ method: 'PUT', url: `${T}/${task.id}`, payload: { request_url: `${base}/ok` } })
    expect([res.statusCode, res.json()]).toEqual([400, { error: '不允许访问内网地址' }])
  })
})
