import type { FastifyInstance } from 'fastify'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '@/app'
import type { MailMessage } from '@/common/mailer'
import type { DbHandle } from '@/db/client'
import { admin_users, password_reset_tokens, system_settings } from '@/db/schema'
import { PasswordResetRepository } from '@/modules/admin/password-reset/repository'
import {
  buildTestApp,
  cleanupFixture,
  createFixture,
  FIXTURE_PASSWORD,
  FIXTURE_USER,
  loginSession,
  openTestDb,
  testConfig,
  type Fixture,
} from './helpers'

let app: FastifyInstance
let handle: DbHandle
let fixture: Fixture
const outbox: MailMessage[] = []
const EMAIL = 'ck_test_reset@example.com'

beforeAll(async () => {
  handle = openTestDb()
  const config = testConfig({ mailDriver: 'log', settingsEnv: { APP_BASE_URL: 'https://admin.example.com' } })
  app = await buildApp({ config, mailer: { send: async (m) => void outbox.push(m) } })
  await app.ready()
})

beforeEach(async () => {
  outbox.length = 0
  fixture = await createFixture(handle)
  await handle.db.update(admin_users).set({ email: EMAIL }).where(eq(admin_users.id, fixture.userId))
  await handle.db.delete(system_settings)
  await handle.db.insert(system_settings).values({ key: 'security.password_reset_enabled', value: true })
  app.settings.reset()
})

afterAll(async () => {
  await handle.db.delete(system_settings)
  await cleanupFixture(handle)
  await app.close()
  await handle.pool.end()
})

const requestReset = (email: string, lang?: string) =>
  app.inject({
    method: 'POST',
    url: '/api/admin/password-reset/request',
    payload: { email },
    headers: lang ? { 'accept-language': lang } : {},
  })
const confirm = (token: string, new_password: string) =>
  app.inject({ method: 'POST', url: '/api/admin/password-reset/confirm', payload: { token, new_password } })
const flush = () => new Promise((r) => setTimeout(r, 20))
const tokenFrom = (mail: MailMessage) => /reset-password\?token=([\w-]+)/.exec(mail.text)![1]!

describe('password reset', () => {
  it('申请：无论邮箱是否存在都返回同一提示；存在时发送带 APP_BASE_URL 链接的邮件（按请求语言）', async () => {
    const unknown = await requestReset('nobody@example.com')
    const known = await requestReset(EMAIL.toUpperCase(), 'en-US')
    expect(unknown.statusCode).toBe(200)
    expect(known.json()).toEqual({ message: 'If this email belongs to an account, a reset link has been sent. Please check your inbox.' })
    expect(unknown.json()).toEqual({ message: '如果该邮箱属于某个账号，重置链接已发送，请查收邮件' })
    await flush()
    expect(outbox).toHaveLength(1)
    expect(outbox[0]).toMatchObject({ to: EMAIL, subject: 'Reset your password' })
    expect(outbox[0]!.text).toContain(`https://admin.example.com/reset-password?token=`)
    // Only the hash is stored
    const [row] = await handle.db.select().from(password_reset_tokens).where(eq(password_reset_tokens.user_id, fixture.userId))
    expect(row!.token_hash).toHaveLength(64)
    expect(row!.token_hash).not.toBe(tokenFrom(outbox[0]!))
    expect((await requestReset('not-an-email')).json()).toEqual({ error: '请输入正确的邮箱地址' })
  })

  it('确认：按密码规则校验；成功后旧密码失效、所有会话下线；链接只能用一次，新申请使旧链接作废', async () => {
    const session = await loginSession(app, FIXTURE_USER, FIXTURE_PASSWORD, fixture.userId)
    await requestReset(EMAIL)
    await requestReset(EMAIL)
    await flush()
    const [older, newer] = outbox.map(tokenFrom)
    expect((await confirm(newer!, '123')).json()).toEqual({ error: '新密码长度至少6位' })
    expect((await confirm(older!, 'brand-new-pass')).json()).toEqual({ error: '重置链接无效或已过期，请重新申请' })
    expect((await confirm(newer!, 'brand-new-pass')).json()).toEqual({ message: '密码已重置，请使用新密码登录' })
    expect((await confirm(newer!, 'another-pass')).statusCode).toBe(400)
    expect((await session.inject({ url: '/api/admin/me' })).statusCode).toBe(401)
    await expect(loginSession(app, FIXTURE_USER, FIXTURE_PASSWORD)).rejects.toThrow()
    expect((await loginSession(app, FIXTURE_USER, 'brand-new-pass')).csrf).toBeTruthy()
  })

  it('过期链接、停用账号无效；过期记录由维护任务清理', async () => {
    await requestReset(EMAIL)
    await flush()
    const token = tokenFrom(outbox[0]!)
    await handle.db.update(password_reset_tokens).set({ expires_at: '2000-01-01 00:00:00' }).where(eq(password_reset_tokens.user_id, fixture.userId))
    expect((await confirm(token, 'brand-new-pass')).statusCode).toBe(400)
    expect(await new PasswordResetRepository(handle.db).purge()).toBeGreaterThanOrEqual(1)

    await handle.db.update(admin_users).set({ status: 'disabled' }).where(eq(admin_users.id, fixture.userId))
    outbox.length = 0
    await requestReset(EMAIL)
    await flush()
    expect(outbox).toHaveLength(0)
  })

  it('开关关闭或未配置邮件时不可用', async () => {
    await handle.db.delete(system_settings)
    app.settings.reset()
    expect((await requestReset(EMAIL)).json()).toEqual({ error: '找回密码功能未开启' })
    const bare = await buildTestApp()
    await handle.db.insert(system_settings).values({ key: 'security.password_reset_enabled', value: true })
    bare.settings.reset()
    // Stored as on, but no mail in this deployment: unavailable, and app-info says so
    expect((await bare.inject({ method: 'POST', url: '/api/admin/password-reset/request', payload: { email: EMAIL } })).statusCode).toBe(400)
    expect((await bare.inject({ url: '/api/admin/app-info' })).json().security.password_reset_enabled).toBe(false)
    await bare.close()
  })
})
