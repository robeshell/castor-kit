import { and, eq, inArray, like } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { generatePasswordHash } from '@/common/password'
import type { DbHandle } from '@/db/client'
import { admin_users, notification_reads, notifications } from '@/db/schema'
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

const P = 'ck_test_r2_t_'
const INTERNAL = { error: '服务器内部错误，请稍后重试' }
let app: FastifyInstance
let handle: DbHandle
let s: AuthedSession
let u: AuthedSession
let fixtureUserId: number

async function cleanup() {
  await handle.db.delete(notifications).where(like(notifications.title, `${P}%`))
  await handle.db.delete(admin_users).where(like(admin_users.username, `${P}%`))
}

interface Item {
  id: number
  title: string
  is_read: boolean
}

async function listAll(session: AuthedSession, query = ''): Promise<{ items: Item[]; total: number }> {
  return (await session.inject({ url: `/api/admin/notifications?per_page=200${query}` })).json()
}

const ids = (items: Item[]) => items.map((i) => i.id)

beforeAll(async () => {
  handle = openTestDb()
  app = await buildTestApp()
  await cleanup()
  const fx = await createFixture(handle)
  fixtureUserId = fx.userId
  u = await loginSession(app, FIXTURE_USER, FIXTURE_PASSWORD, fx.userId)
  s = await superAdminSession(app, handle)
})

afterAll(async () => {
  await cleanup()
  await cleanupFixture(handle)
  await app.close()
  await handle.pool.end()
})

describe('notification', () => {
  let globalId: number
  let toFixtureId: number
  let toSuperId: number

  it('新增：201 形状；noti_type 非法 → info；is_global 按 Python 真值；非全局才取 user_id', async () => {
    const g = await s.inject({
      method: 'POST',
      url: '/api/admin/notifications',
      payload: { title: `  ${P}全局  `, noti_type: 'bogus', content: null, link: '', user_id: fixtureUserId },
    })
    expect(g.statusCode).toBe(201)
    expect(Object.keys(g.json()).sort()).toEqual(
      ['content', 'created_at', 'id', 'is_global', 'is_read', 'link', 'noti_type', 'title', 'user_id'].sort(),
    )
    expect(g.json()).toMatchObject({
      title: `${P}全局`,
      noti_type: 'info',
      content: '',
      link: null,
      is_global: true,
      user_id: null,
      is_read: false,
    })
    globalId = g.json().id

    const t = await s.inject({
      method: 'POST',
      url: '/api/admin/notifications',
      payload: { title: `${P}给夹具`, noti_type: 'warning', is_global: '', user_id: String(fixtureUserId), link: '/x' },
    })
    expect(t.json()).toMatchObject({ is_global: false, user_id: fixtureUserId, noti_type: 'warning', link: '/x' })
    toFixtureId = t.json().id

    const t2 = await s.inject({
      method: 'POST',
      url: '/api/admin/notifications',
      payload: { title: `${P}给超管`, is_global: 0, user_id: s.userId, noti_type: 'error' },
    })
    toSuperId = t2.json().id
  })

  it('新增校验：标题为空 400；非字符串标题/用户不存在 → 500 通用文案；无权限 403', async () => {
    const post = (session: AuthedSession, payload: object) =>
      session.inject({ method: 'POST', url: '/api/admin/notifications', payload })
    expect((await post(s, {})).json()).toEqual({ error: '标题不能为空' })
    expect((await post(s, { title: ' ' })).json()).toEqual({ error: '标题不能为空' })
    for (const bad of [{ title: 123 }, { title: `${P}x`, is_global: false, user_id: 99999999 }, { title: `${P}x`, content: { a: 1 } }]) {
      const res = await post(s, bad)
      expect([res.statusCode, res.json()]).toEqual([500, INTERNAL])
    }
    expect((await post(u, { title: 'x' })).json()).toEqual({ error: '无权限创建通知' })
  })

  it('可见性：全局 + 定向给自己；定向给别人不可见', async () => {
    const fixtureView = ids((await listAll(u)).items)
    expect(fixtureView).toContain(globalId)
    expect(fixtureView).toContain(toFixtureId)
    expect(fixtureView).not.toContain(toSuperId)
    const superView = ids((await listAll(s)).items)
    expect(superView).toContain(toSuperId)
    expect(superView).not.toContain(toFixtureId)

    const page = (await u.inject({ url: '/api/admin/notifications?page=1&per_page=1' })).json()
    expect(Object.keys(page).sort()).toEqual(['items', 'page', 'per_page', 'total'])
    expect(page.items).toHaveLength(1)
  })

  it('已读：单条已读幂等；未读数/筛选随之变化；不可见 → 404', async () => {
    const before = (await u.inject({ url: '/api/admin/notifications/unread-count' })).json().count
    expect((await u.inject({ method: 'POST', url: `/api/admin/notifications/${toFixtureId}/read` })).json()).toEqual({ success: true })
    expect((await u.inject({ method: 'POST', url: `/api/admin/notifications/${toFixtureId}/read` })).json()).toEqual({ success: true })
    expect((await u.inject({ url: '/api/admin/notifications/unread-count' })).json()).toEqual({ count: before - 1 })
    const reads = await handle.db
      .select()
      .from(notification_reads)
      .where(and(eq(notification_reads.notification_id, toFixtureId), eq(notification_reads.user_id, fixtureUserId)))
    expect(reads).toHaveLength(1)
    expect(reads[0]!.read_at).toBeTruthy()

    const readList = await listAll(u, '&is_read=true')
    expect(ids(readList.items)).toEqual([toFixtureId])
    expect(readList.items[0]!.is_read).toBe(true)
    expect(ids((await listAll(u, '&is_read=false')).items)).not.toContain(toFixtureId)
    expect(ids((await listAll(u, '&is_read=all')).items)).toContain(toFixtureId)

    const hidden = await u.inject({ method: 'POST', url: `/api/admin/notifications/${toSuperId}/read` })
    expect([hidden.statusCode, hidden.json()]).toEqual([404, { error: '通知不存在或无权限' }])
    const huge = await u.inject({ method: 'POST', url: '/api/admin/notifications/99999999999/read' })
    expect([huge.statusCode, huge.json()]).toEqual([404, { error: '通知不存在或无权限' }])
  })

  it('全部已读：返回标记条数，同一 read_at；再次调用 marked=0', async () => {
    const unread = (await u.inject({ url: '/api/admin/notifications/unread-count' })).json().count
    const res = (await u.inject({ method: 'POST', url: '/api/admin/notifications/read-all' })).json()
    expect(res).toEqual({ success: true, marked: unread })
    expect((await u.inject({ url: '/api/admin/notifications/unread-count' })).json()).toEqual({ count: 0 })
    const rows = await handle.db.select().from(notification_reads).where(eq(notification_reads.user_id, fixtureUserId))
    const batch = rows.filter((r) => r.notification_id !== toFixtureId)
    expect(new Set(batch.map((r) => r.read_at)).size).toBe(1)
    expect((await u.inject({ method: 'POST', url: '/api/admin/notifications/read-all' })).json()).toEqual({ success: true, marked: 0 })
  })

  it('删除：无权限可删定向给自己的；删全局需权限；不可见 404', async () => {
    const g = await u.inject({ method: 'DELETE', url: `/api/admin/notifications/${globalId}` })
    expect([g.statusCode, g.json()]).toEqual([403, { error: '无权限删除全局通知' }])
    const hidden = await u.inject({ method: 'DELETE', url: `/api/admin/notifications/${toSuperId}` })
    expect([hidden.statusCode, hidden.json()]).toEqual([404, { error: '通知不存在或无权限' }])
    expect((await u.inject({ method: 'DELETE', url: `/api/admin/notifications/${toFixtureId}` })).json()).toEqual({ success: true })
    // Read records are cascade-deleted along with the notification
    expect(await handle.db.select().from(notification_reads).where(eq(notification_reads.notification_id, toFixtureId))).toHaveLength(0)
    expect((await s.inject({ method: 'DELETE', url: `/api/admin/notifications/${globalId}` })).json()).toEqual({ success: true })
    expect((await s.inject({ method: 'DELETE', url: `/api/admin/notifications/${toSuperId}` })).json()).toEqual({ success: true })
    expect(await handle.db.select().from(notifications).where(inArray(notifications.id, [globalId, toFixtureId, toSuperId]))).toHaveLength(0)
    expect((await s.inject({ method: 'DELETE', url: '/api/admin/notifications/abc' })).statusCode).toBe(405)
  })

  it('会话用户已被删除：所有接口 → 401 并清掉会话', async () => {
    const [ghost] = await handle.db
      .insert(admin_users)
      .values({ username: `${P}ghost`, password_hash: await generatePasswordHash('ghost-pass', 1000) })
      .returning()
    const g = await loginSession(app, `${P}ghost`, 'ghost-pass', ghost!.id)
    await handle.db.delete(admin_users).where(eq(admin_users.id, ghost!.id))
    for (const [method, url] of [
      ['GET', '/api/admin/notifications/unread-count'],
      ['GET', '/api/admin/notifications'],
      ['POST', '/api/admin/notifications'],
      ['POST', '/api/admin/notifications/1/read'],
      ['POST', '/api/admin/notifications/read-all'],
      ['DELETE', '/api/admin/notifications/1'],
    ] as const) {
      const res = await g.inject({ method, url, ...(method === 'POST' ? { payload: {} } : {}) })
      expect([res.statusCode, res.json()], `${method} ${url}`).toEqual([401, { error: '未授权访问', redirect: '/admin/login' }])
    }
  })

  it('未登录 → 401', async () => {
    const res = await app.inject({ url: '/api/admin/notifications/unread-count' })
    expect([res.statusCode, res.json()]).toEqual([401, { error: '未授权访问', redirect: '/admin/login' }])
  })
})
