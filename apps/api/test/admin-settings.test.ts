import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DbHandle } from '@/db/client'
import { system_settings } from '@/db/schema'
import {
  buildTestApp,
  cleanupFixture,
  createFixture,
  FIXTURE_PASSWORD,
  FIXTURE_USER,
  FIXTURE_PREFIX,
  loginSession,
  multipartFile,
  openTestDb,
  superAdminSession,
  type AuthedSession,
} from './helpers'

let app: FastifyInstance
let handle: DbHandle
let s: AuthedSession

beforeAll(async () => {
  handle = openTestDb()
  await handle.db.delete(system_settings)
  app = await buildTestApp()
  s = await superAdminSession(app, handle)
})

afterAll(async () => {
  await handle.db.delete(system_settings)
  await cleanupFixture(handle)
  await app.close()
  await handle.pool.end()
})

type Item = { key: string; value: unknown; default: unknown; unavailable_reason: string | null }
const put = (values: Record<string, unknown>) => s.inject({ method: 'PUT', url: '/api/admin/settings', payload: { values } })

describe('system settings', () => {
  it('默认值与当前行为一致；找回密码在未配置邮件时标明原因', async () => {
    const items = (await s.inject({ url: '/api/admin/settings' })).json().items as Item[]
    const byKey = Object.fromEntries(items.map((i) => [i.key, i]))
    expect(byKey['security.totp_enabled']!.value).toBe(false)
    expect(byKey['security.password_min_length']!.value).toBe(6)
    expect(byKey['security.session_ttl_hours']!.value).toBe(8)
    expect(byKey['security.password_reset_enabled']!.unavailable_reason).toBe('需要先配置邮件服务（SMTP_HOST 等环境变量）')
  })

  it('保存：校验类型与范围、未知键、角色编码；前置条件缺失时不能打开；公开部分经 app-info 下发', async () => {
    expect((await put({ 'security.nope': true })).json()).toEqual({ error: '未知的设置项：security.nope' })
    expect((await put({ 'security.password_min_length': 3 })).json()).toEqual({ error: '设置项取值不合法：security.password_min_length' })
    expect((await put({ 'security.totp_enabled': 'yes' })).json()).toEqual({ error: '设置项取值不合法：security.totp_enabled' })
    expect((await put({ 'security.totp_required_roles': ['no_such_role'] })).json()).toEqual({ error: '角色编码不存在: no_such_role' })
    expect((await put({ 'security.password_reset_enabled': true })).json()).toEqual({ error: '需要先配置邮件服务（SMTP_HOST 等环境变量）' })
    // One invalid value → nothing is saved
    await put({ 'security.password_min_length': 10, 'security.rate_limit_per_minute': 1 })
    expect((await s.inject({ url: '/api/admin/app-info' })).json().security.password_policy.min_length).toBe(6)

    const ok = await put({ 'security.totp_enabled': true, 'security.password_min_length': 10, 'security.password_require_symbol': true })
    expect(ok.statusCode).toBe(200)
    const info = (await s.inject({ url: '/api/admin/app-info' })).json().security
    expect(info).toEqual({
      totp_enabled: true,
      password_reset_enabled: false,
      password_policy: { min_length: 10, require_letters_digits: false, require_symbol: true },
    })
    await handle.db.delete(system_settings)
    app.settings.reset()
  })

  it('密码规则：修改密码、新增 / 编辑 / 导入用户都按设置校验，报错按语言翻译', async () => {
    const fx = await createFixture(handle)
    s = await superAdminSession(app, handle)
    const u = await loginSession(app, FIXTURE_USER, FIXTURE_PASSWORD, fx.userId)
    const change = (new_password: string, lang?: string) =>
      u.inject({
        method: 'POST',
        url: '/api/admin/change-password',
        payload: { old_password: FIXTURE_PASSWORD, new_password },
        headers: lang ? { 'accept-language': lang } : {},
      })
    // Defaults: 6 characters, nothing else
    expect((await change('12345')).json()).toEqual({ error: '新密码长度至少6位' })

    await put({ 'security.password_min_length': 8, 'security.password_require_letters_digits': true, 'security.password_require_symbol': true })
    expect((await change('abc123')).json()).toEqual({ error: '新密码长度至少8位' })
    expect((await change('abc123', 'en-US')).json()).toEqual({ error: 'New password must be at least 8 characters' })
    expect((await change('abcdefgh')).json()).toEqual({ error: '新密码需同时包含字母和数字' })
    expect((await change('abcd1234')).json()).toEqual({ error: '新密码需包含至少一个符号' })
    expect((await change('abcd1234!')).statusCode).toBe(200)

    const name = `${FIXTURE_PREFIX}policy`
    expect((await s.inject({ method: 'POST', url: '/api/admin/users', payload: { username: name, password: '123456' } })).json()).toEqual({
      error: '密码长度至少8位',
    })
    expect((await s.inject({ method: 'PUT', url: `/api/admin/users/${fx.userId}`, payload: { password: 'abcdefghij' } })).json()).toEqual({
      error: '密码需同时包含字母和数字',
    })
    const csv = multipartFile('u.csv', `用户名,密码\n${name},abcd1234\n`)
    const res = await s.inject({ method: 'POST', url: '/api/admin/users/import', ...csv })
    expect(res.json().error_rows.map((r: { reason: string }) => r.reason)).toEqual(['密码需包含至少一个符号'])
    // Existing passwords still work (the rule applies when a password is set)
    expect((await loginSession(app, FIXTURE_USER, 'abcd1234!', fx.userId)).csrf).toBeTruthy()
    await handle.db.delete(system_settings)
    app.settings.reset()
  })

  it('权限：查看需要 system_settings，保存需要 system_settings_edit', async () => {
    const fx = await createFixture(handle)
    const u = await loginSession(app, FIXTURE_USER, FIXTURE_PASSWORD, fx.userId)
    expect((await u.inject({ url: '/api/admin/settings' })).json()).toEqual({ error: '无权限查看系统设置' })
    expect((await u.inject({ method: 'PUT', url: '/api/admin/settings', payload: { values: {} } })).json()).toEqual({ error: '无权限修改系统设置' })
  })
})
