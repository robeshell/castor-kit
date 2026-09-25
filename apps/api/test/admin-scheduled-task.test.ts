/**
 * Scheduled task API
 */

import { eq, like, sql } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DbHandle } from '@/db/client'
import { scheduled_task_runs, scheduled_tasks, type ScheduledTask } from '@/db/schema'
import {
  buildTestApp,
  cleanupFixture,
  createFixture,
  FIXTURE_PASSWORD,
  FIXTURE_USER,
  loginSession,
  openTestDb,
  superAdminSession,
  type AuthedSession,
} from './helpers'

const P = 'ck_test_r6_api_'
const T = '/api/admin/scheduled-tasks'
let app: FastifyInstance
let handle: DbHandle
let s: AuthedSession
/** A user with no scheduled task permissions */
let nobody: AuthedSession

async function seedTask(values: Partial<typeof scheduled_tasks.$inferInsert> = {}): Promise<ScheduledTask> {
  const [row] = await handle.db
    .insert(scheduled_tasks)
    .values({
      name: '种子任务',
      task_code: `${P}seed_${Math.random().toString(36).slice(2, 8)}`,
      cron_expression: '0 3 * * *',
      request_method: 'GET',
      request_url: 'https://1.1.1.1/cdn-cgi/trace',
      timeout_seconds: 10,
      is_active: false,
      last_status: 'idle',
      run_count: 0,
      ...values,
    })
    .returning()
  return row!
}

async function getTask(id: number) {
  const [row] = await handle.db.select().from(scheduled_tasks).where(eq(scheduled_tasks.id, id))
  return row
}

const valid = (extra: Record<string, unknown> = {}) => ({
  name: '接口任务',
  task_code: `${P}x`,
  cron_expression: '*/10 * * * *',
  request_url: 'https://1.1.1.1/cdn-cgi/trace',
  ...extra,
})

beforeAll(async () => {
  handle = openTestDb()
  await handle.db.delete(scheduled_tasks).where(like(scheduled_tasks.task_code, `${P}%`))
  app = await buildTestApp()
  // createFixture first cleans up all ck_test_ users (including the super account), so create fixtures before logging in as super
  await createFixture(handle)
  nobody = await loginSession(app, FIXTURE_USER, FIXTURE_PASSWORD)
  s = await superAdminSession(app, handle)
})

afterAll(async () => {
  await handle.db.delete(scheduled_tasks).where(like(scheduled_tasks.task_code, `${P}%`))
  await cleanupFixture(handle)
  await app.close()
  await handle.pool.end()
})

describe('列表', () => {
  it('形状 / search（名称、编码、地址）/ is_active / status / 分页', async () => {
    const a = await seedTask({ name: '列表甲', task_code: `${P}list_a`, is_active: true, last_status: 'failed', request_url: 'https://1.1.1.1/list-a' })
    await seedTask({ name: '列表乙', task_code: `${P}list_b`, is_active: false })

    const res = await s.inject({ url: `${T}?search=${P}list_&per_page=999` })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(Object.keys(body).sort()).toEqual(['items', 'page', 'per_page', 'total'])
    expect(body).toMatchObject({ total: 2, page: 1, per_page: 200 })
    expect(body.items.map((i: { task_code: string }) => i.task_code)).toEqual([`${P}list_b`, `${P}list_a`])
    expect(Object.keys(body.items[1]).sort()).toEqual(
      [
        'id', 'name', 'task_code', 'cron_expression', 'request_method', 'request_url', 'request_headers', 'request_body',
        'timeout_seconds', 'is_active', 'remark', 'last_status', 'last_error', 'last_duration_ms', 'run_count', 'last_run_at',
        'next_run_at', 'created_at', 'updated_at',
      ].sort(),
    )

    const q = async (qs: string) => (await s.inject({ url: `${T}?${qs}` })).json()
    expect((await q(`search=list-a`)).items.map((i: { id: number }) => i.id)).toEqual([a.id])
    expect((await q(`search=${encodeURIComponent('列表乙')}`)).total).toBe(1)
    expect((await q(`search=${P}list_&is_active=1`)).items[0].id).toBe(a.id)
    expect((await q(`search=${P}list_&is_active=${encodeURIComponent('否')}`)).items[0].task_code).toBe(`${P}list_b`)
    expect((await q(`search=${P}list_&is_active=whatever`)).total).toBe(2)
    expect((await q(`search=${P}list_&status=failed`)).items.map((i: { id: number }) => i.id)).toEqual([a.id])
    const page2 = await q(`search=${P}list_&page=2&per_page=1`)
    expect(page2).toMatchObject({ total: 2, page: 2, per_page: 1 })
    expect(page2.items[0].id).toBe(a.id)
  })

  it('未登录 401；无权限 403', async () => {
    const res = await app.inject({ url: T })
    expect(res.statusCode).toBe(401)
    const denied = await nobody.inject({ url: T })
    expect(denied.statusCode).toBe(403)
    expect(denied.json()).toEqual({ error: '无权限查看定时任务列表' })
  })
})

describe('新增', () => {
  it('成功 201：字段归一化、停用时 next_run_at 为空', async () => {
    const res = await s.inject({
      method: 'POST',
      url: T,
      payload: valid({
        name: '  新增任务  ',
        task_code: `${P}create_a`,
        request_method: ' post ',
        request_headers: { 'X-中文': '值', n: 1 },
        request_body: '  {"a":1}  ',
        timeout_seconds: '999',
        is_active: '停用',
        remark: '   ',
      }),
    })
    expect(res.statusCode).toBe(201)
    expect(res.json()).toMatchObject({
      name: '新增任务',
      task_code: `${P}create_a`,
      request_method: 'POST',
      request_headers: '{"X-中文": "值", "n": 1}',
      request_body: '{"a":1}',
      timeout_seconds: 120,
      is_active: false,
      remark: null,
      last_status: 'idle',
      run_count: 0,
      next_run_at: null,
      last_run_at: null,
    })
    const created = res.json()
    expect(created.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}$/)
  })

  it('启用：next_run_at 为 cron 的下一个触发分钟；请求头文本按 Python json.dumps 重排', async () => {
    const res = await s.inject({
      method: 'POST',
      url: T,
      payload: valid({ task_code: `${P}create_b`, cron_expression: '0 0 1 * 1', request_headers: ' {"b": 1.0,"a":[1,"x"]} ' }),
    })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.request_method).toBe('GET')
    expect(body.timeout_seconds).toBe(10)
    expect(body.is_active).toBe(true)
    expect(body.request_headers).toBe('{"b": 1.0, "a": [1, "x"]}')
    // Day-of-month and day-of-week are ANDed: the next day that is both the 1st and a Monday
    expect(body.next_run_at).toMatch(/^\d{4}-\d{2}-01T00:00:00$/)
    const [y, m] = body.next_run_at.split('-').map(Number)
    expect(new Date(Date.UTC(y, m - 1, 1)).getUTCDay()).toBe(1)
  })

  it('校验失败 400 与错误文案', async () => {
    const cases: Array<[Record<string, unknown>, string]> = [
      [{ name: '' }, '任务名称不能为空'],
      [{ task_code: '  ' }, '任务编码不能为空'],
      [{ cron_expression: null }, 'Cron 表达式不能为空'],
      [{ request_method: 'OPTIONS' }, '请求方法仅支持 GET/POST/PUT/DELETE/PATCH'],
      [{ request_method: '  ' }, '请求方法仅支持 GET/POST/PUT/DELETE/PATCH'],
      [{ task_code: `${P}create_a` }, '任务编码已存在'],
      [{ cron_expression: '* * *' }, 'Cron 表达式格式错误，应为 5 段: 分 时 日 月 周'],
      [{ cron_expression: '0 0 30 2 *' }, 'Cron 表达式在一年内没有可触发时间，请检查配置'],
      [{ cron_expression: '0 0 * * 5-7' }, 'Cron 区间不合法: 5-7'],
      [{ request_headers: '{bad' }, 'JSON 格式不合法'],
      [{ request_headers: '[1]' }, 'JSON 内容必须是对象'],
      [{ request_headers: ['a'] }, 'JSON 格式不合法'],
    ]
    for (const [extra, error] of cases) {
      const res = await s.inject({ method: 'POST', url: T, payload: valid({ task_code: `${P}create_bad`, ...extra }) })
      expect([res.statusCode, res.json()]).toEqual([400, { error }])
    }
  })

  it('请求地址不合法：400 + 具体原因（校验在名称 / 编码 / Cron 之后）', async () => {
    // Expected message; RegExp is for localhost (different machines resolve ::1 or 127.0.0.1 first)
    const cases: Array<[unknown, string | RegExp]> = [
      [undefined, '请求地址不能为空'],
      ['', '请求地址不能为空'],
      ['ftp://1.1.1.1/x', '请求地址仅支持 http/https 协议'],
      ['http://127.0.0.1/x', '不允许访问内网地址'],
      ['http://localhost/x', /^不允许访问内网地址（localhost 解析为 (127\.0\.0\.1|::1)）$/],
      ['http://[::1/x', '请求地址格式不合法'],
      ['http://1.1.1.1:0/', '请求地址端口不合法'],
    ]
    for (const [url, error] of cases) {
      const res = await s.inject({ method: 'POST', url: T, payload: valid({ task_code: `${P}create_url`, request_url: url }) })
      expect([url, res.statusCode]).toEqual([url, 400])
      if (error instanceof RegExp) expect(res.json().error).toMatch(error)
      else expect(res.json()).toEqual({ error })
    }
    // Empty body: the name error is reported first (same order as the form fields)
    const empty = await s.inject({ method: 'POST', url: T, payload: {} })
    expect([empty.statusCode, empty.json()]).toEqual([400, { error: '任务名称不能为空' }])
    expect(await handle.db.select().from(scheduled_tasks).where(eq(scheduled_tasks.task_code, `${P}create_url`))).toHaveLength(0)
  })

  it('无权限 403', async () => {
    const res = await nobody.inject({ method: 'POST', url: T, payload: valid() })
    expect([res.statusCode, res.json()]).toEqual([403, { error: '无权限新增定时任务' }])
  })
})

describe('详情 / 编辑 / 删除', () => {
  it('详情：200 / 404 / 先 404 再 403 / 非数字 id', async () => {
    const task = await seedTask()
    const ok = await s.inject({ url: `${T}/${task.id}` })
    expect(ok.statusCode).toBe(200)
    expect(ok.json()).toMatchObject({ id: task.id, task_code: task.task_code, is_active: false })
    expect((await s.inject({ url: `${T}/99999999` })).json()).toEqual({ error: '资源不存在' })
    expect((await nobody.inject({ url: `${T}/99999999` })).statusCode).toBe(404)
    const denied = await nobody.inject({ url: `${T}/${task.id}` })
    expect([denied.statusCode, denied.json()]).toEqual([403, { error: '无权限查看定时任务' }])
    expect((await s.inject({ url: `${T}/abc` })).statusCode).toBe(404)
  })

  it('编辑：部分字段更新；启用时重算 next_run_at；停用清空', async () => {
    const task = await seedTask({ task_code: `${P}edit_a` })
    const res = await s.inject({
      method: 'PUT',
      url: `${T}/${task.id}`,
      payload: { name: ' 改名 ', is_active: 'yes', cron_expression: ' 30 * * * * ', timeout_seconds: 0, request_body: 'hi', remark: '备注' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body).toMatchObject({ name: '改名', is_active: true, cron_expression: '30 * * * *', timeout_seconds: 1, request_body: 'hi', remark: '备注' })
    expect(body.next_run_at).toMatch(/T\d{2}:30:00$/)

    const off = await s.inject({ method: 'PUT', url: `${T}/${task.id}`, payload: { is_active: false } })
    expect(off.json().next_run_at).toBeNull()
    // Invalid is_active / timeout fall back to the current value
    const keep = await s.inject({ method: 'PUT', url: `${T}/${task.id}`, payload: { is_active: 'maybe', timeout_seconds: 'x' } })
    expect(keep.json()).toMatchObject({ is_active: false, timeout_seconds: 1 })
  })

  it('编辑：值没变化时不发 UPDATE（updated_at 不变）', async () => {
    const task = await seedTask({ task_code: `${P}edit_noop`, remark: 'r', updated_at: '2026-01-01 00:00:00' })
    const res = await s.inject({ method: 'PUT', url: `${T}/${task.id}`, payload: { remark: '  r  ', is_active: false, name: task.name } })
    expect(res.json().updated_at).toBe('2026-01-01T00:00:00')
    const changed = await s.inject({ method: 'PUT', url: `${T}/${task.id}`, payload: { remark: 'r2' } })
    expect(changed.json().updated_at).not.toBe('2026-01-01T00:00:00')
  })

  it('编辑：校验失败 400', async () => {
    const task = await seedTask({ task_code: `${P}edit_bad` })
    const other = await seedTask({ task_code: `${P}edit_other` })
    const cases: Array<[Record<string, unknown>, string]> = [
      [{ name: '  ' }, '任务名称不能为空'],
      [{ task_code: '' }, '任务编码不能为空'],
      [{ task_code: other.task_code }, '任务编码已存在'],
      [{ request_method: 'trace' }, '请求方法仅支持 GET/POST/PUT/DELETE/PATCH'],
      [{ cron_expression: '61 * * * *' }, 'Cron 数值超出范围: 61'],
      [{ request_headers: 'x' }, 'JSON 格式不合法'],
      [{ request_url: '' }, '请求地址不能为空'],
      [{ request_url: 'gopher://1.1.1.1/' }, '请求地址仅支持 http/https 协议'],
      [{ request_url: 'http://10.0.0.1/' }, '不允许访问内网地址'],
      [{ request_url: 'http://1.1.1.1:65536/' }, '请求地址端口不合法'],
      [{ is_active: true, cron_expression: '0 0 31 4 *' }, 'Cron 表达式在一年内没有可触发时间，请检查配置'],
    ]
    for (const [payload, error] of cases) {
      const res = await s.inject({ method: 'PUT', url: `${T}/${task.id}`, payload })
      expect([res.statusCode, res.json()]).toEqual([400, { error }])
    }
    // Its own code doesn't count as a duplicate
    expect((await s.inject({ method: 'PUT', url: `${T}/${task.id}`, payload: { task_code: task.task_code } })).statusCode).toBe(200)
    // urlsplit ValueError: 400 "请求地址格式不合法"
    const bad = await s.inject({ method: 'PUT', url: `${T}/${task.id}`, payload: { request_url: 'http://[::1/x' } })
    expect([bad.statusCode, bad.json()]).toEqual([400, { error: '请求地址格式不合法' }])
  })

  it('编辑：404 先于 403；无权限 403', async () => {
    const task = await seedTask()
    expect((await nobody.inject({ method: 'PUT', url: `${T}/99999999`, payload: {} })).statusCode).toBe(404)
    const denied = await nobody.inject({ method: 'PUT', url: `${T}/${task.id}`, payload: {} })
    expect([denied.statusCode, denied.json()]).toEqual([403, { error: '无权限编辑定时任务' }])
  })

  it('删除：成功（执行记录级联删除）/ 404 / 403', async () => {
    const task = await seedTask()
    await handle.db.insert(scheduled_task_runs).values({ task_id: task.id, status: 'success', trigger_type: 'manual' })
    const denied = await nobody.inject({ method: 'DELETE', url: `${T}/${task.id}` })
    expect([denied.statusCode, denied.json()]).toEqual([403, { error: '无权限删除定时任务' }])
    const res = await s.inject({ method: 'DELETE', url: `${T}/${task.id}` })
    expect([res.statusCode, res.json()]).toEqual([200, { message: '删除成功' }])
    expect(await getTask(task.id)).toBeUndefined()
    expect(await handle.db.select().from(scheduled_task_runs).where(eq(scheduled_task_runs.task_id, task.id))).toHaveLength(0)
    expect((await s.inject({ method: 'DELETE', url: `${T}/${task.id}` })).statusCode).toBe(404)
  })
})

describe('手动执行 / 执行记录', () => {
  it('执行：403 先于 404（该路由先查权限）', async () => {
    const denied = await nobody.inject({ method: 'POST', url: `${T}/99999999/run` })
    expect([denied.statusCode, denied.json()]).toEqual([403, { error: '无权限执行定时任务' }])
    expect((await s.inject({ method: 'POST', url: `${T}/99999999/run` })).json()).toEqual({ error: '资源不存在' })
  })

  it('请求头非法：400，不写执行记录', async () => {
    const t1 = await seedTask({ request_headers: 'nope' })
    const t2 = await seedTask({ request_headers: '"str"' })
    expect((await s.inject({ method: 'POST', url: `${T}/${t1.id}/run` })).json()).toEqual({ error: '请求头 JSON 解析失败' })
    expect((await s.inject({ method: 'POST', url: `${T}/${t2.id}/run` })).json()).toEqual({ error: '请求头必须是 JSON 对象' })
    expect(await handle.db.select().from(scheduled_task_runs).where(eq(scheduled_task_runs.task_id, t1.id))).toHaveLength(0)
  })

  it('存量任务指向内网：执行阶段连接前拦截 → 500 + 完整结果体', async () => {
    const task = await seedTask({ request_url: 'http://127.0.0.1:9/never', is_active: true, cron_expression: '*/15 * * * *' })
    const res = await s.inject({ method: 'POST', url: `${T}/${task.id}/run` })
    expect(res.statusCode).toBe(500)
    const body = res.json()
    expect(Object.keys(body).sort()).toEqual(['error', 'message', 'run', 'task'])
    expect(body).toMatchObject({
      message: '执行失败',
      error: '不允许访问内网地址',
      task: { id: task.id, last_status: 'failed', last_error: '不允许访问内网地址', run_count: 1 },
      run: { task_id: task.id, task_name: '种子任务', task_code: task.task_code, trigger_type: 'manual', status: 'failed', response_status: null, response_body: null },
    })
    expect(body.task.next_run_at).toMatch(/:(00|15|30|45):00$/)
    expect(body.task.last_run_at).toBe(body.run.finished_at)
  })

  it('执行记录：形状 / task_id / status 过滤 / 权限', async () => {
    const task = await seedTask({ name: '记录任务' })
    await handle.db.insert(scheduled_task_runs).values([
      { task_id: task.id, status: 'success', trigger_type: 'scheduled', started_at: '2026-09-01 00:00:00.1', created_at: sql`timezone('utc', now())` as unknown as string },
      { task_id: task.id, status: 'failed', trigger_type: 'manual', error_message: 'HTTP 500' },
    ])
    const res = await s.inject({ url: `${T}/runs?task_id=${task.id}` })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body).toMatchObject({ total: 2, page: 1, per_page: 20 })
    expect(body.items[0]).toMatchObject({ status: 'failed', task_name: '记录任务', task_code: task.task_code, error_message: 'HTTP 500' })
    expect(Object.keys(body.items[0]).sort()).toEqual(
      ['id', 'task_id', 'task_name', 'task_code', 'trigger_type', 'status', 'response_status', 'response_body', 'error_message', 'started_at', 'finished_at', 'duration_ms', 'created_at'].sort(),
    )
    expect(body.items[1].started_at).toBe('2026-09-01T00:00:00.100000')
    expect((await s.inject({ url: `${T}/runs?task_id=${task.id}&status=success` })).json().total).toBe(1)
    // Invalid task_id → no filtering
    expect((await s.inject({ url: `${T}/runs?task_id=abc&per_page=1` })).json().per_page).toBe(1)
    const denied = await nobody.inject({ url: `${T}/runs` })
    expect([denied.statusCode, denied.json()]).toEqual([403, { error: '无权限查看执行记录' }])
  })
})
