import type { FastifyInstance, InjectOptions } from 'fastify'
import { and, desc, eq, like } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { API_TOKEN_DENIED } from '@/common/api-token'
import type { DbHandle } from '@/db/client'
import { admin_users, api_tokens, operation_logs, system_settings } from '@/db/schema'
import {
  buildTestApp,
  cleanupFixture,
  createFixture,
  ensureMenus,
  FIXTURE_PREFIX,
  openTestDb,
  scopedSession,
  superAdminSession,
  type AuthedSession,
} from './helpers'

let app: FastifyInstance
let handle: DbHandle
let admin: AuthedSession

beforeAll(async () => {
  handle = openTestDb()
  app = await buildTestApp()
})

beforeEach(async () => {
  await createFixture(handle)
  admin = await superAdminSession(app, handle)
  await setEnabled(true)
})

afterAll(async () => {
  await handle.db.delete(system_settings)
  await cleanupFixture(handle)
  await app.close()
  await handle.pool.end()
})

async function setEnabled(on: boolean) {
  await handle.db.delete(system_settings)
  if (on) await handle.db.insert(system_settings).values({ key: 'security.api_tokens_enabled', value: true })
  app.settings.reset()
}

async function createToken(s: AuthedSession, scopes: string[], extra: Record<string, unknown> = {}) {
  const res = await s.inject({
    method: 'POST',
    url: '/api/admin/profile/api-tokens',
    payload: { name: 'ci', scopes, expires_in_days: 30, ...extra },
  })
  return res
}

/** A request with only the Bearer token (no cookie, no CSRF header) */
const bearer = (token: string, opts: InjectOptions) =>
  app.inject({ ...opts, headers: { authorization: `Bearer ${token}`, ...(opts.headers ?? {}) } } as InjectOptions)

describe('API tokens: creating', () => {
  it('开关关闭时不能创建、已有 token 也不能用；创建时明文只返回一次、列表只显示前缀', async () => {
    const created = (await createToken(admin, ['system_users'])).json()
    expect(created.token).toMatch(/^ck_[\w-]{43}$/)
    expect(created.item).toMatchObject({ name: 'ci', token_prefix: created.token.slice(0, 11), scopes: ['system_users'] })
    expect(created.item.expires_at).toBeTruthy()
    const own = (await admin.inject({ url: '/api/admin/profile/api-tokens' })).json()
    expect(own.enabled).toBe(true)
    expect(JSON.stringify(own)).not.toContain(created.token)
    expect(JSON.stringify(own)).not.toContain('token_hash')

    await setEnabled(false)
    expect((await createToken(admin, ['system_users'])).json()).toEqual({ error: 'API Token 未开启' })
    expect((await bearer(created.token, { url: '/api/admin/users' })).json()).toEqual({ error: 'API Token 未开启' })
  })

  it('只能授予自己拥有的权限；名称、有效期、需要近期验证身份', async () => {
    const staff = await scopedSession(app, handle, { name: 'tok_staff', codes: ['system_users'], dataScope: 'self' })
    expect((await createToken(staff, ['system_users', 'system_roles'])).json()).toEqual({ error: '不能授予自己没有的权限：system_roles' })
    expect((await createToken(staff, [])).json()).toEqual({ error: '请至少选择一项权限' })
    expect((await createToken(staff, ['system_users'], { name: '' })).json()).toEqual({ error: '请填写名称（最多 100 个字符）' })
    expect((await createToken(staff, ['system_users'], { expires_in_days: 0 })).json()).toEqual({ error: '有效期不合法' })
    expect((await createToken(staff, ['system_users'], { expires_in_days: null })).json().item.expires_at).toBeNull()

    await handle.db.execute(`update sessions set verified_at = '2000-01-01' where user_id = ${staff.userId}`)
    expect((await createToken(staff, ['system_users'])).json()).toEqual({ error: '请先验证身份', reauth_required: true })
  })

  it('可授予的权限只包括自己拥有的（附带上级目录便于显示）', async () => {
    const staff = await scopedSession(app, handle, { name: 'tok_scopes', codes: ['system_users'], dataScope: 'self' })
    const items = (await staff.inject({ url: '/api/admin/profile/api-tokens/scopes' })).json().items as { code: string; grantable: boolean }[]
    expect(items.filter((i) => i.grantable).map((i) => i.code)).toEqual(['system_users'])
  })
})

describe('API tokens: using', () => {
  it('权限 = scopes ∩ 创建人权限：超级管理员的 token 也只有勾选的权限；不需要 CSRF；同时带 cookie 时忽略 cookie', async () => {
    const { token } = (await createToken(admin, ['system_users', 'system_users_add'])).json()
    expect((await bearer(token, { url: '/api/admin/users' })).statusCode).toBe(200)
    expect((await bearer(token, { url: '/api/admin/roles' })).json()).toMatchObject({ error: expect.any(String) })
    expect((await bearer(token, { url: '/api/admin/roles' })).statusCode).toBe(403)
    const created = await bearer(token, {
      method: 'POST',
      url: '/api/admin/users',
      payload: { username: `${FIXTURE_PREFIX}via_token`, password: 'token-made-1' },
    })
    expect(created.statusCode).toBe(201)
    // The super admin's cookie alongside the token changes nothing: the token decides
    const both = await app.inject({
      url: '/api/admin/roles',
      cookies: { castor_session: admin.cookie },
      headers: { authorization: `Bearer ${token}` },
    })
    expect(both.statusCode).toBe(403)
    // No session was created for the token
    expect(created.cookies.find((c) => c.name === 'castor_session')).toBeUndefined()
  })

  it('账号与安全类接口一律拒绝 token（即使 token 拥有全部权限）', async () => {
    const all = ['system_users', 'system_users_edit', 'system_settings', 'system_settings_edit', 'system_webhooks', 'system_webhooks_add', 'system_api_tokens']
    await ensureMenus(handle, all)
    const created = await createToken(admin, all)
    expect(created.statusCode).toBe(200)
    const { token } = created.json()
    const denied: Array<[string, string]> = [
      ['POST', '/api/admin/logout'],
      ['POST', '/api/admin/change-password'],
      ['POST', '/api/admin/reauth'],
      ['POST', '/api/admin/password-reset/request'],
      ['GET', '/api/admin/two-factor'],
      ['DELETE', '/api/admin/users/1/two-factor'],
      ['PUT', '/api/admin/profile'],
      ['GET', '/api/admin/profile/api-tokens'],
      ['POST', '/api/admin/profile/api-tokens'],
      ['GET', '/api/admin/sessions'],
      ['GET', '/api/admin/api-tokens'],
      ['PUT', '/api/admin/settings'],
      ['POST', '/api/admin/settings/test/ai'],
      ['POST', '/api/admin/webhooks'],
      ['GET', '/api/admin/webhooks/1/secret'],
    ]
    expect(denied.length).toBeGreaterThanOrEqual(API_TOKEN_DENIED.length)
    for (const [method, url] of denied) {
      const res = await bearer(token, { method, url, payload: method === 'GET' || method === 'DELETE' ? undefined : {} } as InjectOptions)
      expect([method, url, res.statusCode, res.json()]).toEqual([method, url, 403, { error: '该接口不支持 API Token' }])
    }
    // Reading settings is fine
    expect((await bearer(token, { url: '/api/admin/settings' })).statusCode).toBe(200)
  })

  it('吊销、过期、创建人停用、未知 token：立即 401', async () => {
    const a = (await createToken(admin, ['system_users'])).json()
    await admin.inject({ method: 'DELETE', url: `/api/admin/profile/api-tokens/${a.item.id}` })
    expect((await bearer(a.token, { url: '/api/admin/users' })).json()).toEqual({ error: 'API Token 无效或已过期' })

    const b = (await createToken(admin, ['system_users'])).json()
    await handle.db.update(api_tokens).set({ expires_at: '2000-01-01 00:00:00' }).where(eq(api_tokens.id, b.item.id))
    expect((await bearer(b.token, { url: '/api/admin/users' })).statusCode).toBe(401)

    const staff = await scopedSession(app, handle, { name: 'tok_disabled', codes: ['system_users'], dataScope: 'all' })
    const c = (await createToken(staff, ['system_users'])).json()
    expect((await bearer(c.token, { url: '/api/admin/users' })).statusCode).toBe(200)
    await handle.db.update(admin_users).set({ status: 'disabled' }).where(eq(admin_users.id, staff.userId))
    expect((await bearer(c.token, { url: '/api/admin/users' })).statusCode).toBe(401)

    expect((await bearer('ck_not-a-real-token', { url: '/api/admin/users' })).statusCode).toBe(401)
  })

  it('数据权限按创建人；记录最近使用；操作日志注明 token', async () => {
    const staff = await scopedSession(app, handle, { name: 'tok_self', codes: ['system_users', 'system_users_edit'], dataScope: 'self' })
    const { token, item } = (await createToken(staff, ['system_users', 'system_users_edit'])).json()
    const users = (await bearer(token, { url: '/api/admin/users' })).json().items as { id: number }[]
    expect(users.map((u) => u.id)).toEqual([staff.userId])
    const [row] = await handle.db.select().from(api_tokens).where(eq(api_tokens.id, item.id))
    expect(row!.last_used_at).toBeTruthy()

    await bearer(token, { method: 'PUT', url: `/api/admin/users/${staff.userId}`, payload: { nickname: 'via token' } })
    let log: typeof operation_logs.$inferSelect | undefined
    for (let i = 0; i < 50 && !log; i++) {
      ;[log] = await handle.db
        .select()
        .from(operation_logs)
        .where(and(eq(operation_logs.user_id, staff.userId), like(operation_logs.path, '/api/admin/users/%')))
        .orderBy(desc(operation_logs.id))
        .limit(1)
      if (!log) await new Promise((r) => setTimeout(r, 20))
    }
    expect(log!.api_token_id).toBe(item.id)
  })
})

describe('API tokens: administration', () => {
  it('管理员查看全部、吊销；需要权限；非超级管理员不能吊销超级管理员的 token', async () => {
    const superToken = (await createToken(admin, ['system_users'])).json()
    const list = (await admin.inject({ url: '/api/admin/api-tokens?status=active&per_page=100' })).json()
    expect(list.items.some((t: { id: number; creator_username: string }) => t.id === superToken.item.id)).toBe(true)

    const viewer = await scopedSession(app, handle, { name: 'tok_viewer', codes: [], dataScope: 'all' })
    expect((await viewer.inject({ url: '/api/admin/api-tokens' })).json()).toEqual({ error: '无权限查看 API Token' })
    const auditor = await scopedSession(app, handle, {
      name: 'tok_auditor',
      codes: ['system_api_tokens', 'system_api_tokens_revoke'],
      dataScope: 'all',
    })
    expect((await auditor.inject({ method: 'DELETE', url: `/api/admin/api-tokens/${superToken.item.id}` })).json()).toEqual({
      error: '只有超级管理员可以操作超级管理员账号',
    })
    expect((await admin.inject({ method: 'DELETE', url: `/api/admin/api-tokens/${superToken.item.id}` })).json()).toEqual({ message: '已吊销' })
    expect((await bearer(superToken.token, { url: '/api/admin/users' })).statusCode).toBe(401)
  })
})
