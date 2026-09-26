import type { FastifyInstance } from 'fastify'
import { eq, sql } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { purgeSessions } from '@/common/session'
import type { DbHandle } from '@/db/client'
import { sessions } from '@/db/schema'
import {
  buildTestApp,
  cleanupFixture,
  createFixture,
  FIXTURE_PASSWORD,
  FIXTURE_USER,
  loginSession,
  openTestDb,
  scopedSession,
  superAdminSession,
  type AuthedSession,
  type Fixture,
} from './helpers'

let app: FastifyInstance
let handle: DbHandle
let fixture: Fixture
let admin: AuthedSession

beforeAll(async () => {
  handle = openTestDb()
  app = await buildTestApp()
})

beforeEach(async () => {
  fixture = await createFixture(handle)
  admin = await superAdminSession(app, handle)
})

afterAll(async () => {
  await cleanupFixture(handle)
  await app.close()
  await handle.pool.end()
})

type Item = { key: string; user_id: number; username: string; current: boolean; ip: string | null; last_seen_at: string }
const me = (s: AuthedSession) => s.inject({ url: '/api/admin/me' }).then((r) => r.statusCode)
const listFor = async (s: AuthedSession, userId: number) =>
  ((await s.inject({ url: '/api/admin/sessions?per_page=100' })).json().items as Item[]).filter((i) => i.user_id === userId)

describe('online users (在线用户)', () => {
  it('列出已登录会话；强制下线后该会话下一次请求即 401，其他会话不受影响', async () => {
    const a = await loginSession(app, FIXTURE_USER, FIXTURE_PASSWORD, fixture.userId)
    const b = await loginSession(app, FIXTURE_USER, FIXTURE_PASSWORD, fixture.userId)
    const items = await listFor(admin, fixture.userId)
    expect(items).toHaveLength(2)
    expect(items[0]).toMatchObject({ username: FIXTURE_USER, current: false })
    expect(items[0]!.key).toMatch(/^[0-9a-f]{16}$/)
    expect((await listFor(admin, admin.userId)).some((i) => i.current)).toBe(true)

    const [aRow] = await handle.db.select().from(sessions).where(eq(sessions.user_id, fixture.userId)).orderBy(sessions.created_at).limit(1)
    const res = await admin.inject({ method: 'DELETE', url: `/api/admin/sessions/${aRow!.id.slice(0, 16)}` })
    expect(res.json()).toEqual({ message: '已下线' })
    expect(await me(a)).toBe(401)
    expect(await me(b)).toBe(200)
    expect(await listFor(admin, fixture.userId)).toHaveLength(1)
    // Already revoked / unknown / malformed keys are 404
    expect((await admin.inject({ method: 'DELETE', url: `/api/admin/sessions/${aRow!.id.slice(0, 16)}` })).statusCode).toBe(404)
    expect((await admin.inject({ method: 'DELETE', url: '/api/admin/sessions/zz' })).statusCode).toBe(404)
  })

  it('不能在这里下线自己的当前会话；无权限 403', async () => {
    const own = (await listFor(admin, admin.userId)).find((i) => i.current)!
    expect((await admin.inject({ method: 'DELETE', url: `/api/admin/sessions/${own.key}` })).json()).toEqual({
      error: '不能下线当前会话，请直接退出登录',
    })
    const plain = await loginSession(app, FIXTURE_USER, FIXTURE_PASSWORD, fixture.userId)
    expect((await plain.inject({ url: '/api/admin/sessions' })).json()).toEqual({ error: '无权限查看在线用户' })
    expect((await plain.inject({ method: 'DELETE', url: `/api/admin/sessions/${own.key}` })).json()).toEqual({ error: '无权限强制下线' })
  })

  it('按数据权限过滤；非超级管理员不能下线超级管理员', async () => {
    const codes = ['system_sessions', 'system_sessions_revoke']
    const selfOnly = await scopedSession(app, handle, { name: 'sess_self', codes, dataScope: 'self' })
    const seen = ((await selfOnly.inject({ url: '/api/admin/sessions?per_page=100' })).json().items as Item[]).map((i) => i.user_id)
    expect([...new Set(seen)]).toEqual([selfOnly.userId])
    const superKey = (await listFor(admin, admin.userId))[0]!.key
    expect((await selfOnly.inject({ method: 'DELETE', url: `/api/admin/sessions/${superKey}` })).statusCode).toBe(404)

    const all = await scopedSession(app, handle, { name: 'sess_all', codes, dataScope: 'all' })
    expect((await all.inject({ method: 'DELETE', url: `/api/admin/sessions/${superKey}` })).json()).toEqual({
      error: '只有超级管理员可以操作超级管理员账号',
    })
    expect(await me(admin)).toBe(200)
    await loginSession(app, FIXTURE_USER, FIXTURE_PASSWORD, fixture.userId)
    const fixtureKey = (await listFor(all, fixture.userId))[0]!.key
    expect((await all.inject({ method: 'DELETE', url: `/api/admin/sessions/${fixtureKey}` })).statusCode).toBe(200)
  })
})

describe('profile: signed-in devices', () => {
  it('只看到自己的会话；可下线单个设备或其他全部设备', async () => {
    const a = await loginSession(app, FIXTURE_USER, FIXTURE_PASSWORD, fixture.userId)
    const b = await loginSession(app, FIXTURE_USER, FIXTURE_PASSWORD, fixture.userId)
    const c = await loginSession(app, FIXTURE_USER, FIXTURE_PASSWORD, fixture.userId)
    const mine = (await a.inject({ url: '/api/admin/profile/sessions' })).json().items as Item[]
    expect(mine).toHaveLength(3)
    expect(mine.every((i) => i.user_id === fixture.userId)).toBe(true)
    expect(mine.filter((i) => i.current)).toHaveLength(1)

    // Someone else's key is a 404 here
    const superKey = (await listFor(admin, admin.userId))[0]!.key
    expect((await a.inject({ method: 'DELETE', url: `/api/admin/profile/sessions/${superKey}` })).statusCode).toBe(404)
    const current = mine.find((i) => i.current)!
    expect((await a.inject({ method: 'DELETE', url: `/api/admin/profile/sessions/${current.key}` })).statusCode).toBe(400)

    const other = mine.find((i) => !i.current)!
    expect((await a.inject({ method: 'DELETE', url: `/api/admin/profile/sessions/${other.key}` })).statusCode).toBe(200)
    expect([await me(b), await me(c)].sort()).toEqual([200, 401])

    expect((await a.inject({ method: 'POST', url: '/api/admin/profile/sessions/revoke-others' })).json()).toEqual({
      message: '已下线其他设备',
      revoked: 1,
    })
    expect([await me(a), await me(b), await me(c)]).toEqual([200, 401, 401])
  })
})

describe('revocation points', () => {
  it('修改密码：其他设备下线，当前设备保持登录', async () => {
    const a = await loginSession(app, FIXTURE_USER, FIXTURE_PASSWORD, fixture.userId)
    const b = await loginSession(app, FIXTURE_USER, FIXTURE_PASSWORD, fixture.userId)
    const res = await a.inject({
      method: 'POST',
      url: '/api/admin/change-password',
      payload: { old_password: FIXTURE_PASSWORD, new_password: 'changed-pass-2' },
    })
    expect(res.statusCode).toBe(200)
    expect(await me(a)).toBe(200)
    expect(await me(b)).toBe(401)
  })

  it('管理员重置密码 / 停用账号：该用户所有会话下线', async () => {
    const a = await loginSession(app, FIXTURE_USER, FIXTURE_PASSWORD, fixture.userId)
    await admin.inject({ method: 'PUT', url: `/api/admin/users/${fixture.userId}`, payload: { password: 'reset-pass-3' } })
    expect(await me(a)).toBe(401)
    // Editing without a password keeps sessions
    const b = await loginSession(app, FIXTURE_USER, 'reset-pass-3', fixture.userId)
    await admin.inject({ method: 'PUT', url: `/api/admin/users/${fixture.userId}`, payload: { nickname: 'x' } })
    expect(await me(b)).toBe(200)
    await admin.inject({ method: 'PUT', url: `/api/admin/users/${fixture.userId}/status`, payload: { status: 'disabled' } })
    expect(await me(b)).toBe(401)
  })

  it('退出登录吊销服务端会话：旧 cookie 重放无效', async () => {
    const a = await loginSession(app, FIXTURE_USER, FIXTURE_PASSWORD, fixture.userId)
    await a.inject({ method: 'POST', url: '/api/admin/logout' })
    expect(await me(a)).toBe(401)
  })

  it('维护任务清理过期或早已吊销的会话', async () => {
    await loginSession(app, FIXTURE_USER, FIXTURE_PASSWORD, fixture.userId)
    await loginSession(app, FIXTURE_USER, FIXTURE_PASSWORD, fixture.userId)
    const rows = await handle.db.select({ id: sessions.id }).from(sessions).where(eq(sessions.user_id, fixture.userId))
    await handle.db.update(sessions).set({ expires_at: sql`now() - interval '2 days'` }).where(eq(sessions.id, rows[0]!.id))
    await handle.db.update(sessions).set({ revoked_at: sql`now() - interval '2 days'` }).where(eq(sessions.id, rows[1]!.id))
    expect(await purgeSessions(handle.db)).toBeGreaterThanOrEqual(2)
    expect(await handle.db.select().from(sessions).where(eq(sessions.user_id, fixture.userId))).toHaveLength(0)
  })
})
