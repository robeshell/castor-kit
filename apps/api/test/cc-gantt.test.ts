import { like } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DbHandle } from '@/db/client'
import { cc_gantt_tasks } from '@/db/schema'
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

const P = 'ck_test_r5_'
const B = '/api/admin/component-center/gantt'
let app: FastifyInstance
let handle: DbHandle
let s: AuthedSession
let taskId: number

async function cleanup() {
  await handle.db.delete(cc_gantt_tasks).where(like(cc_gantt_tasks.title, `${P}%`))
}

beforeAll(async () => {
  handle = openTestDb()
  app = await buildTestApp()
  s = await superAdminSession(app, handle)
  await cleanup()
  // 克隆出来的测试库主键序列可能落后于 MAX(id)，先同步
  await handle.pool.query(
    "SELECT setval(pg_get_serial_sequence('cc_gantt_tasks', 'id'), COALESCE((SELECT MAX(id) FROM cc_gantt_tasks), 0) + 1, false)",
  )
})

afterAll(async () => {
  await cleanup()
  await cleanupFixture(handle)
  await app.close()
  await handle.pool.end()
})

describe('gantt', () => {
  it('新建：201 + 枚举/进度归一化；各校验失败分支', async () => {
    const res = await s.inject({
      method: 'POST',
      url: `${B}/tasks`,
      payload: {
        title: `${P}任务`,
        start_date: '2024-W10-1',
        end_date: '20240320',
        progress: '130',
        task_type: 'milestone',
        priority: 'urgent',
        status: 'delayed',
        assignee: ' ',
        sort_order: 9000,
      },
    })
    expect(res.statusCode).toBe(201)
    const t = res.json()
    taskId = t.id
    expect(t).toMatchObject({
      title: `${P}任务`,
      task_type: 'milestone',
      start_date: '2024-03-04',
      end_date: '2024-03-20',
      progress: 100,
      assignee: null,
      priority: 'medium',
      status: 'delayed',
      color: '#4080FF',
      sort_order: 9000,
    })

    const cases: [object, string][] = [
      [{}, '任务标题不能为空'],
      [{ title: 'x', end_date: '2024-01-01' }, '开始日期不能为空'],
      [{ title: 'x', start_date: '2024-02-30', end_date: '2024-01-01' }, '开始日期不能为空'],
      [{ title: 'x', start_date: '2024-01-01', end_date: '' }, '结束日期不能为空'],
    ]
    for (const [payload, error] of cases) {
      const r = await s.inject({ method: 'POST', url: `${B}/tasks`, payload })
      expect(r.statusCode).toBe(400)
      expect(r.json()).toEqual({ error })
    }
    await s.inject({ method: 'POST', url: `${B}/tasks`, payload: { title: `${P}二`, start_date: '2024-01-01', end_date: '2024-01-02', priority: 'critical', sort_order: 9001 } })
  })

  it('列表：status / priority 精确筛选，按 sort_order', async () => {
    const all = (await s.inject({ url: `${B}/tasks` })).json() as { title: string; sort_order: number }[]
    const orders = all.map((t) => t.sort_order)
    expect(orders).toEqual([...orders].sort((a, b) => a - b))
    const delayed = (await s.inject({ url: `${B}/tasks?status=delayed` })).json()
    expect(delayed.map((t: { title: string }) => t.title)).toContain(`${P}任务`)
    const both = (await s.inject({ url: `${B}/tasks?status=not_started&priority=critical` })).json() as { title: string; status: string; priority: string }[]
    expect(both.map((t) => t.title)).toContain(`${P}二`)
    expect(both.every((t) => t.status === 'not_started' && t.priority === 'critical')).toBe(true)
  })

  it('编辑：进度钳制、日期置空 → 500（NOT NULL）；标题清空 400；404', async () => {
    const res = await s.inject({ method: 'PUT', url: `${B}/tasks/${taskId}`, payload: { progress: -3, status: 'nope', color: '', end_date: '2024-04-01' } })
    expect(res.json()).toMatchObject({ progress: 0, status: 'not_started', color: '#4080FF', end_date: '2024-04-01' })
    const keep = await s.inject({ method: 'PUT', url: `${B}/tasks/${taskId}`, payload: { progress: 'x' } })
    expect(keep.json().progress).toBe(0)
    const nul = await s.inject({ method: 'PUT', url: `${B}/tasks/${taskId}`, payload: { start_date: null } })
    expect(nul.statusCode).toBe(500)
    expect(nul.json()).toEqual({ error: '服务器内部错误，请稍后重试' })
    expect((await s.inject({ method: 'PUT', url: `${B}/tasks/${taskId}`, payload: { title: null } })).json()).toEqual({ error: '任务标题不能为空' })
    expect((await s.inject({ method: 'PUT', url: `${B}/tasks/99999999`, payload: {} })).statusCode).toBe(404)
  })

  it('无权限 → 403', async () => {
    const fx = await createFixture(handle)
    const u = await loginSession(app, FIXTURE_USER, FIXTURE_PASSWORD, fx.userId)
    expect((await u.inject({ url: `${B}/tasks` })).json()).toEqual({ error: '无权限' })
    expect((await u.inject({ method: 'POST', url: `${B}/tasks`, payload: {} })).json()).toEqual({ error: '无权限新建任务' })
    expect((await u.inject({ method: 'PUT', url: `${B}/tasks/${taskId}`, payload: {} })).json()).toEqual({ error: '无权限编辑任务' })
    const del = await u.inject({ method: 'DELETE', url: `${B}/tasks/${taskId}` })
    expect(del.statusCode).toBe(403)
    expect(del.json()).toEqual({ error: '无权限删除任务' })
  })

  it('删除', async () => {
    s = await superAdminSession(app, handle) // createFixture 会清掉 ck_test_ 前缀的用户（含 super 测试账号）
    expect((await s.inject({ method: 'DELETE', url: `${B}/tasks/${taskId}` })).json()).toEqual({ message: '删除成功' })
    expect((await s.inject({ method: 'DELETE', url: `${B}/tasks/${taskId}` })).statusCode).toBe(404)
  })
})
