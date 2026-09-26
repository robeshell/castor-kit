import type { FastifyInstance, InjectOptions, LightMyRequestResponse } from 'fastify'
import { and, eq } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { openSecret } from '@/common/secret-box'
import { totpCode } from '@/common/totp'
import type { DbHandle } from '@/db/client'
import { admin_users, login_logs, system_settings } from '@/db/schema'
import {
  buildTestApp,
  cleanupFixture,
  createFixture,
  FIXTURE_PASSWORD,
  FIXTURE_PREFIX,
  FIXTURE_USER,
  openTestDb,
  scopedSession,
  sessionCookie,
  superAdminSession,
  type Fixture,
} from './helpers'

let app: FastifyInstance
let handle: DbHandle
let fixture: Fixture

const MAX_FAILURES = 4

beforeAll(async () => {
  handle = openTestDb()
  app = await buildTestApp({ loginMaxFailures: MAX_FAILURES })
})

beforeEach(async () => {
  fixture = await createFixture(handle)
  await setSettings({ 'security.totp_enabled': true })
})

afterAll(async () => {
  await handle.db.delete(system_settings)
  await cleanupFixture(handle)
  await app.close()
  await handle.pool.end()
})

async function setSettings(values: Record<string, unknown>) {
  await handle.db.delete(system_settings)
  const rows = Object.entries(values).map(([key, value]) => ({ key, value }))
  if (rows.length) await handle.db.insert(system_settings).values(rows)
  app.settings.reset()
}

/** A browser: keeps the session cookie and CSRF token across calls */
function client() {
  let cookie: string | undefined
  let csrf = ''
  const track = (res: LightMyRequestResponse) => {
    const next = sessionCookie(res)
    if (next !== undefined) cookie = next
    const token = res.headers['content-type']?.includes('json') ? (res.json() as { csrf_token?: string }).csrf_token : undefined
    if (token) csrf = token
    return res
  }
  return {
    inject: async (opts: InjectOptions) =>
      track(
        await app.inject({
          ...opts,
          cookies: cookie ? { castor_session: cookie } : {},
          headers: { 'x-csrf-token': csrf, ...(opts.headers ?? {}) },
        } as InjectOptions),
      ),
    login: (password = FIXTURE_PASSWORD) =>
      app
        .inject({ method: 'POST', url: '/api/admin/login', payload: { username: FIXTURE_USER, password } })
        .then(track),
    cookie: () => cookie,
  }
}

const post = (c: ReturnType<typeof client>, url: string, payload: object = {}) => c.inject({ method: 'POST', url, payload })
const me = (c: ReturnType<typeof client>) => c.inject({ url: '/api/admin/me' }).then((r) => r.statusCode)

/** Enroll the fixture user from the profile; returns the secret and recovery codes */
async function enroll() {
  const c = client()
  await c.login()
  const { secret } = (await post(c, '/api/admin/two-factor/setup')).json()
  const res = await post(c, '/api/admin/two-factor/enable', { code: totpCode(secret) })
  expect(res.statusCode).toBe(200)
  return { secret: secret as string, recoveryCodes: res.json().recovery_codes as string[] }
}

const nextCode = (secret: string, periods = 1) => totpCode(secret, Date.now() + periods * 30_000)

describe('two-step verification: enrollment from the profile', () => {
  it('获取密钥 → 首个验证码开启 → 返回 10 个恢复码；密钥加密存储', async () => {
    const c = client()
    await c.login()
    expect((await c.inject({ url: '/api/admin/two-factor' })).json()).toMatchObject({ available: true, enabled: false, required: false })
    const setup = (await post(c, '/api/admin/two-factor/setup')).json()
    expect(setup.otpauth_url).toContain(`otpauth://totp/castor-kit:${FIXTURE_USER}?`)
    expect(setup.otpauth_url).toContain(`secret=${setup.secret}`)
    const [row] = await handle.db.select().from(admin_users).where(eq(admin_users.id, fixture.userId))
    expect(row!.totp_secret).not.toContain(setup.secret)
    expect(openSecret(row!.totp_secret!, app.config.secretKey)).toBe(setup.secret)
    expect(row!.totp_enabled_at).toBeNull()

    expect((await post(c, '/api/admin/two-factor/enable', { code: '000000' })).json()).toEqual({ error: '验证码错误' })
    const ok = (await post(c, '/api/admin/two-factor/enable', { code: totpCode(setup.secret) })).json()
    expect(ok.message).toBe('两步验证已开启')
    expect(ok.recovery_codes).toHaveLength(10)
    expect(ok.recovery_codes[0]).toMatch(/^[a-z2-9]{5}-[a-z2-9]{5}$/)
    expect((await c.inject({ url: '/api/admin/two-factor' })).json()).toMatchObject({ enabled: true, recovery_codes_left: 10 })
    expect((await c.inject({ url: '/api/admin/two-factor' })).json().enabled_at).toMatch(/^\d{4}-\d\d-\d\dT[\d:.]+$/)
    expect((await post(c, '/api/admin/two-factor/setup')).json()).toEqual({ error: '已开启两步验证，如需更换请先关闭' })
    // The user dict says whether 2FA is on
    expect((await c.inject({ url: '/api/admin/me' })).json().user.totp_enabled).toBe(true)
  })

  it('总开关关闭时不能新绑定', async () => {
    await setSettings({})
    const c = client()
    await c.login()
    expect((await post(c, '/api/admin/two-factor/setup')).json()).toEqual({ error: '两步验证未开启' })
  })
})

describe('two-step verification: sign-in', () => {
  it('已绑定：密码正确后进入第二步；验证通过才算登录（换新会话），同一时间步的码不能重放', async () => {
    const { secret } = await enroll()
    const successes = () =>
      handle.db
        .select()
        .from(login_logs)
        .where(and(eq(login_logs.username, FIXTURE_USER), eq(login_logs.status, 'success')))
        .then((rows) => rows.length)
    const before = await successes()
    const c = client()
    const first = await c.login()
    expect(first.statusCode).toBe(200)
    expect(first.json()).toEqual({ message: '请输入两步验证码', mfa_required: 'verify', csrf_token: expect.any(String) })
    const pendingCookie = c.cookie()
    // Waiting for the code is not signed in
    expect(await me(c)).toBe(401)
    expect((await c.inject({ url: '/api/admin/users' })).statusCode).toBe(401)
    expect(await successes()).toBe(before)

    expect((await post(c, '/api/admin/login/two-factor', { code: '123456' })).json()).toEqual({ error: '验证码错误' })
    // The code used to enable 2FA is from the same time step: rejected as a replay
    expect((await post(c, '/api/admin/login/two-factor', { code: totpCode(secret) })).statusCode).toBe(400)
    const ok = await post(c, '/api/admin/login/two-factor', { code: nextCode(secret) })
    expect(ok.json()).toMatchObject({ message: '登录成功', user: { username: FIXTURE_USER, totp_enabled: true } })
    expect(c.cookie()).not.toBe(pendingCookie)
    expect(await me(c)).toBe(200)
    expect(await successes()).toBe(before + 1)
    // The pending session is gone
    expect((await app.inject({ url: '/api/admin/me', cookies: { castor_session: pendingCookie! } })).statusCode).toBe(401)
  })

  it('恢复码可替代验证码，每个只能用一次', async () => {
    const { recoveryCodes } = await enroll()
    const a = client()
    await a.login()
    const typed = recoveryCodes[0]!.toUpperCase().replace('-', ' ')
    expect((await post(a, '/api/admin/login/two-factor', { recovery_code: typed })).statusCode).toBe(200)
    const b = client()
    await b.login()
    expect((await post(b, '/api/admin/login/two-factor', { recovery_code: recoveryCodes[0] })).json()).toEqual({ error: '验证码错误' })
    expect((await post(b, '/api/admin/login/two-factor', { recovery_code: recoveryCodes[1] })).statusCode).toBe(200)
    expect((await b.inject({ url: '/api/admin/two-factor' })).json().recovery_codes_left).toBe(8)
  })

  it('错误验证码计入登录失败锁定', async () => {
    await enroll()
    const c = client()
    await c.login()
    for (let i = 0; i < MAX_FAILURES; i++) await post(c, '/api/admin/login/two-factor', { code: '000000' })
    const res = await post(c, '/api/admin/login/two-factor', { code: '000000' })
    expect(res.statusCode).toBe(429)
    expect(res.json()).toEqual({ error: '登录失败次数过多，请稍后再试' })
  })

  it('关闭总开关：登录不再询问，绑定保留；重新打开后照旧询问', async () => {
    await enroll()
    await setSettings({})
    const c = client()
    expect((await c.login()).json().message).toBe('登录成功')
    expect((await c.inject({ url: '/api/admin/two-factor' })).json()).toMatchObject({ available: false, enabled: true })
    await setSettings({ 'security.totp_enabled': true })
    expect((await client().login()).json().mfa_required).toBe('verify')
  })

  it('角色要求两步验证：未绑定的成员登录时先绑定，完成后直接登录；不能自行关闭', async () => {
    await setSettings({ 'security.totp_enabled': true, 'security.totp_required_roles': [`${FIXTURE_PREFIX}role`] })
    const c = client()
    expect((await c.login()).json()).toMatchObject({ mfa_required: 'setup', message: '你的账号需要先绑定两步验证' })
    // The pending setup session can't verify, only enroll
    expect((await post(c, '/api/admin/login/two-factor', { code: '000000' })).statusCode).toBe(401)
    const { secret } = (await post(c, '/api/admin/two-factor/setup')).json()
    const done = (await post(c, '/api/admin/two-factor/enable', { code: totpCode(secret) })).json()
    expect(done).toMatchObject({ message: '登录成功', user: { username: FIXTURE_USER }, recovery_codes: expect.any(Array) })
    expect(await me(c)).toBe(200)
    expect((await c.inject({ url: '/api/admin/two-factor' })).json().required).toBe(true)
    expect((await post(c, '/api/admin/two-factor/disable', { password: FIXTURE_PASSWORD })).json()).toEqual({
      error: '你所在的角色要求开启两步验证，不能关闭',
    })
  })
})

describe('two-step verification: turning off and resetting', () => {
  it('本人关闭需要密码；更换恢复码需要密码且旧码作废', async () => {
    const { secret, recoveryCodes } = await enroll()
    const c = client()
    await c.login()
    await post(c, '/api/admin/login/two-factor', { code: nextCode(secret) })
    expect((await post(c, '/api/admin/two-factor/recovery-codes', { password: 'nope' })).json()).toEqual({ error: '密码错误' })
    const fresh = (await post(c, '/api/admin/two-factor/recovery-codes', { password: FIXTURE_PASSWORD })).json().recovery_codes
    expect(fresh).toHaveLength(10)
    expect(fresh).not.toContain(recoveryCodes[0])

    expect((await post(c, '/api/admin/two-factor/disable', { password: 'nope' })).json()).toEqual({ error: '密码错误' })
    expect((await post(c, '/api/admin/two-factor/disable', { password: FIXTURE_PASSWORD })).json()).toEqual({ message: '两步验证已关闭' })
    const [row] = await handle.db.select().from(admin_users).where(eq(admin_users.id, fixture.userId))
    expect([row!.totp_secret, row!.totp_enabled_at]).toEqual([null, null])
    expect((await client().login()).json().message).toBe('登录成功')
  })

  it('管理员重置：需要 system_users_edit；非超级管理员不能重置超级管理员', async () => {
    await enroll()
    const admin = await superAdminSession(app, handle)
    const editor = await scopedSession(app, handle, { name: 'tf_editor', codes: ['system_users_edit'], dataScope: 'all' })
    expect((await editor.inject({ method: 'DELETE', url: `/api/admin/users/${admin.userId}/two-factor` })).json()).toEqual({
      error: '只有超级管理员可以操作超级管理员账号',
    })
    const viewer = await scopedSession(app, handle, { name: 'tf_viewer', codes: [], dataScope: 'all' })
    expect((await viewer.inject({ method: 'DELETE', url: `/api/admin/users/${fixture.userId}/two-factor` })).statusCode).toBe(403)
    expect((await editor.inject({ method: 'DELETE', url: `/api/admin/users/${fixture.userId}/two-factor` })).json()).toEqual({
      message: '已重置两步验证',
    })
    expect((await client().login()).json().message).toBe('登录成功')
  })
})
