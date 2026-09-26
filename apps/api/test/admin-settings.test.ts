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
  loginSession,
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

  it('权限：查看需要 system_settings，保存需要 system_settings_edit', async () => {
    const fx = await createFixture(handle)
    const u = await loginSession(app, FIXTURE_USER, FIXTURE_PASSWORD, fx.userId)
    expect((await u.inject({ url: '/api/admin/settings' })).json()).toEqual({ error: '无权限查看系统设置' })
    expect((await u.inject({ method: 'PUT', url: '/api/admin/settings', payload: { values: {} } })).json()).toEqual({ error: '无权限修改系统设置' })
  })
})
