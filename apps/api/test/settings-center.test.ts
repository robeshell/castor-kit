import { mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { FastifyInstance } from 'fastify'
import { and, desc, eq, like } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '@/app'
import type { DbHandle } from '@/db/client'
import { login_logs, notifications, operation_logs, sessions, system_settings } from '@/db/schema'
import { startFakeUpstream, type FakeUpstream } from './cc-ai-fake-upstream'
import { cleanupFixture, openTestDb, SUPER_PASSWORD, superAdminSession, testConfig, type AuthedSession } from './helpers'

// System settings beyond security: mail, file storage, uploads, AI — stored in the database (secrets sealed),
// pinned by environment variables, tried with the test buttons, applied without a restart

let app: FastifyInstance
let handle: DbHandle
let s: AuthedSession
let up: FakeUpstream
let storageDir: string

beforeAll(async () => {
  handle = openTestDb()
  await handle.db.delete(system_settings)
  up = await startFakeUpstream()
  storageDir = mkdtempSync(join(tmpdir(), 'ck-settings-'))
  // MAIL_DRIVER=log: "sending" writes to the log, so the mail test button works without an SMTP server;
  // AI_MODEL pinned by the environment to check the read-only path
  const config = testConfig({ mailDriver: 'log', storageLocalDir: storageDir, settingsEnv: { AI_MODEL: 'env-model' } })
  app = await buildApp({ config })
  await app.ready()
  s = await superAdminSession(app, handle)
})

beforeEach(async () => {
  await handle.db.delete(system_settings)
  app.settings.reset()
  // superAdminSession recreates the test super admin, so tests that sign in elsewhere would end this session
  s = await superAdminSession(app, handle)
})

afterAll(async () => {
  await handle.db.delete(notifications).where(eq(notifications.title, '系统设置已修改'))
  await handle.db.delete(system_settings)
  await handle.db.delete(operation_logs).where(like(operation_logs.path, '/api/admin/settings%'))
  await cleanupFixture(handle)
  await app.close()
  await up.close()
  await handle.pool.end()
  rmSync(storageDir, { recursive: true, force: true })
})

type Item = { key: string; value: unknown; has_value?: boolean; source: string; env: string | null; options: string[] | null }
const items = async () => {
  const body = (await s.inject({ url: '/api/admin/settings' })).json()
  return Object.fromEntries((body.items as Item[]).map((i) => [i.key, i]))
}
const put = (values: Record<string, unknown>) => s.inject({ method: 'PUT', url: '/api/admin/settings', payload: { values } })

describe('settings center', () => {
  it('密钥加密存储、不回显；来源标明 db / env / default；null 恢复默认 / 清除密钥', async () => {
    expect((await put({ 'mail.smtp_host': 'smtp.example.com', 'mail.smtp_password': 'p@ss-1', 'ai.api_key': 'sk-123' })).statusCode).toBe(200)
    const [row] = await handle.db.select().from(system_settings).where(eq(system_settings.key, 'mail.smtp_password'))
    expect(JSON.stringify(row!.value)).not.toContain('p@ss-1')
    expect(String(row!.value)).toMatch(/^v1:/)

    const byKey = await items()
    expect(byKey['mail.smtp_password']).toMatchObject({ value: null, has_value: true, source: 'db' })
    expect(byKey['mail.smtp_host']).toMatchObject({ value: 'smtp.example.com', source: 'db' })
    expect(byKey['mail.smtp_port']).toMatchObject({ value: 587, source: 'default' })
    expect(byKey['ai.model']).toMatchObject({ value: 'env-model', source: 'env', env: 'AI_MODEL' })
    expect(byKey['storage.driver']!.options).toEqual(['local', 's3'])
    expect((await app.settings.get()).mail.password).toBe('p@ss-1')

    await put({ 'mail.smtp_password': null, 'mail.smtp_host': null })
    const after = await items()
    expect(after['mail.smtp_password']).toMatchObject({ has_value: false, source: 'default' })
    expect(after['mail.smtp_host']).toMatchObject({ value: '', source: 'default' })
  })

  it('环境变量指定的项不能在页面上改；地址、枚举、类型列表按规则校验', async () => {
    expect((await put({ 'ai.model': 'x' })).json()).toEqual({ error: '该设置由环境变量 AI_MODEL 指定，不能在页面上修改' })
    expect((await put({ 'general.app_base_url': 'example.com' })).json()).toEqual({ error: '设置项取值不合法：general.app_base_url' })
    expect((await put({ 'storage.driver': 'ftp' })).json()).toEqual({ error: '设置项取值不合法：storage.driver' })
    expect((await put({ 'upload.allowed_types': ['png', 'bad type'] })).json()).toEqual({ error: '设置项取值不合法：upload.allowed_types' })
    expect((await put({ 'storage.driver': 's3', 'storage.s3_bucket': 'b' })).json()).toEqual({
      error: 'S3 存储需要填写 Bucket、Access Key 和 Secret Key',
    })
    await put({ 'general.app_base_url': 'https://admin.example.com/' })
    expect((await app.settings.get()).appBaseUrl).toBe('https://admin.example.com')
  })

  it('找回密码的前置条件按同一次保存后的值判断；app-info 的上传限制随设置变化', async () => {
    expect((await put({ 'security.password_reset_enabled': true })).json()).toEqual({ error: '需要先在「邮件」中填写网站地址（重置链接要用）' })
    const ok = await put({ 'general.app_base_url': 'https://admin.example.com', 'security.password_reset_enabled': true })
    expect(ok.statusCode).toBe(200)
    expect((await s.inject({ url: '/api/admin/app-info' })).json().security.password_reset_enabled).toBe(true)

    await put({ 'upload.max_size': 2048, 'upload.allowed_types': ['.PNG', 'txt'] })
    expect((await s.inject({ url: '/api/admin/app-info' })).json().upload).toEqual({ max_size: 2048, allowed_types: ['png', 'txt'] })
  })

  it('操作日志里密钥被脱敏', async () => {
    await put({ 'storage.s3_secret_key': 'very-secret', 'mail.smtp_password': 'pw', 'security.password_min_length': 8 })
    // The audit log is written after the response (onResponse hook): wait for this request's entry
    let log: typeof operation_logs.$inferSelect | undefined
    for (let i = 0; i < 50 && !log; i++) {
      ;[log] = await handle.db
        .select()
        .from(operation_logs)
        .where(and(eq(operation_logs.path, '/api/admin/settings'), like(operation_logs.payload, '%s3_secret_key%')))
        .orderBy(desc(operation_logs.id))
        .limit(1)
      if (!log) await new Promise((r) => setTimeout(r, 20))
    }
    expect(log!.payload).not.toContain('very-secret')
    expect(log!.payload).toContain('"storage.s3_secret_key": "***"')
    expect(log!.payload).toContain('"mail.smtp_password": "***"')
    expect(log!.payload).toContain('"security.password_min_length": 8')
  })

  it('测试按钮：用表单里未保存的值试发邮件 / 读写存储 / 调用 AI，不写入设置', async () => {
    const mail = await s.inject({ method: 'POST', url: '/api/admin/settings/test/mail', payload: { to: 'ops@example.com', values: {} } })
    expect(mail.json()).toEqual({ message: '测试邮件已发送' })
    expect((await s.inject({ method: 'POST', url: '/api/admin/settings/test/mail', payload: { to: 'nope' } })).json()).toEqual({
      error: '请输入正确的邮箱地址',
    })

    const objects = () => readdirSync(storageDir, { recursive: true, withFileTypes: true }).filter((e) => e.isFile()).length
    const before = objects()
    const local = await s.inject({ method: 'POST', url: '/api/admin/settings/test/storage', payload: { values: {} } })
    expect(local.json()).toEqual({ message: '存储可用', driver: 'local' })
    // The test object is removed again
    expect(objects()).toBe(before)
    const s3 = await s.inject({
      method: 'POST',
      url: '/api/admin/settings/test/storage',
      payload: {
        values: {
          'storage.driver': 's3',
          'storage.s3_endpoint': 'http://127.0.0.1:1',
          'storage.s3_bucket': 'b',
          'storage.s3_access_key': 'a',
          'storage.s3_secret_key': 's',
        },
      },
    })
    expect(s3.statusCode).toBe(400)
    expect(s3.json().error).toMatch(/^连接失败：/)

    expect((await s.inject({ method: 'POST', url: '/api/admin/settings/test/ai', payload: {} })).json()).toEqual({
      error: '未配置 AI 模型，请在「系统设置 → AI」中填写 API Key',
    })
    const ai = await s.inject({
      method: 'POST',
      url: '/api/admin/settings/test/ai',
      payload: { values: { 'ai.api_base': up.url, 'ai.api_key': 'draft-key' } },
    })
    expect(ai.json()).toEqual({ message: 'AI 接口可用', model: 'env-model' })
    expect(up.requests.at(-1)!.headers.authorization).toBe('Bearer draft-key')
    // Nothing was saved by the test buttons
    expect(await handle.db.select().from(system_settings)).toEqual([])
  })

  it('保存后立即生效：AI 配置在下一次请求就用上', async () => {
    await put({ 'ai.api_base': up.url, 'ai.api_key': 'saved-key' })
    const ai = await s.inject({ method: 'POST', url: '/api/admin/settings/test/ai', payload: {} })
    expect(ai.statusCode).toBe(200)
    expect(up.requests.at(-1)!.headers.authorization).toBe('Bearer saved-key')
  })

  it('环境变量选了 S3 但没填全：上传返回明确的提示', async () => {
    const pinned = await buildApp({ config: testConfig({ storageLocalDir: storageDir, settingsEnv: { STORAGE_DRIVER: 's3', S3_BUCKET: 'b' } }) })
    await pinned.ready()
    try {
      const admin = await superAdminSession(pinned, handle)
      const { multipartFile } = await import('./helpers')
      const res = await admin.inject({ method: 'POST', url: '/api/admin/files', ...multipartFile('a.txt', 'hello') })
      expect([res.statusCode, res.json()]).toEqual([400, { error: '文件存储未配置完整，请在系统设置的「文件存储」中填写' }])
    } finally {
      await pinned.close()
    }
  })

  it('权限：测试按钮需要 system_settings_edit', async () => {
    const { scopedSession } = await import('./helpers')
    const viewer = await scopedSession(app, handle, { name: 'settings_viewer', codes: ['system_settings'], dataScope: 'all' })
    expect((await viewer.inject({ url: '/api/admin/settings' })).statusCode).toBe(200)
    expect((await viewer.inject({ method: 'POST', url: '/api/admin/settings/test/ai', payload: {} })).json()).toEqual({
      error: '无权限修改系统设置',
    })
  })

  it('SSRF：云元数据等保留地址一律拒绝；内网地址按 SETTINGS_ALLOW_PRIVATE_NETWORK；环境变量锁定的不检查', async () => {
    expect((await put({ 'ai.api_base': 'http://169.254.169.254/v1' })).json()).toEqual({
      error: '不允许访问保留地址（169.254.169.254 解析为 169.254.169.254）',
    })
    const mail = await s.inject({
      method: 'POST',
      url: '/api/admin/settings/test/mail',
      payload: { to: 'ops@example.com', values: { 'mail.smtp_host': '169.254.169.254' } },
    })
    expect(mail.json().error).toBe('不允许访问保留地址（169.254.169.254 解析为 169.254.169.254）')
    const storage = await s.inject({
      method: 'POST',
      url: '/api/admin/settings/test/storage',
      payload: {
        values: {
          'storage.driver': 's3',
          'storage.s3_endpoint': 'http://[fe80::1]:9000',
          'storage.s3_bucket': 'b',
          'storage.s3_access_key': 'a',
          'storage.s3_secret_key': 's',
        },
      },
    })
    expect(storage.json().error).toMatch(/^不允许访问保留地址/)

    // Production default: no internal networks either, unless the operator pinned the address
    const strict = await buildApp({
      config: testConfig({ settingsAllowPrivateNetwork: false, settingsEnv: { AI_API_BASE: up.url, AI_API_KEY: 'k' } }),
    })
    await strict.ready()
    try {
      const admin = await superAdminSession(strict, handle)
      const blocked = await admin.inject({ method: 'PUT', url: '/api/admin/settings', payload: { values: { 'mail.smtp_host': '127.0.0.1' } } })
      expect(blocked.json()).toEqual({ error: '不允许访问内网地址（127.0.0.1 解析为 127.0.0.1）' })
      expect((await admin.inject({ method: 'POST', url: '/api/admin/settings/test/ai', payload: {} })).statusCode).toBe(200)
    } finally {
      await strict.close()
    }
  })

  it('敏感修改需要近期验证身份：过期后 403 reauth_required；验证密码后放行；密码错误计入登录失败', async () => {
    await handle.db.update(sessions).set({ verified_at: '2000-01-01 00:00:00' }).where(eq(sessions.user_id, s.userId))
    expect((await put({ 'security.password_min_length': 7 })).json()).toEqual({ error: '请先验证身份', reauth_required: true })
    expect((await s.inject({ method: 'POST', url: '/api/admin/settings/test/ai', payload: {} })).json()).toMatchObject({ reauth_required: true })
    // Reading still works
    expect((await s.inject({ url: '/api/admin/settings' })).statusCode).toBe(200)

    expect((await s.inject({ method: 'POST', url: '/api/admin/reauth', payload: { password: 'nope' } })).json()).toEqual({ error: '密码错误' })
    const [failed] = await handle.db
      .select()
      .from(login_logs)
      .where(and(eq(login_logs.user_id, s.userId), eq(login_logs.message, '身份验证密码错误')))
      .limit(1)
    expect(failed).toBeTruthy()
    expect((await s.inject({ method: 'POST', url: '/api/admin/reauth', payload: { password: SUPER_PASSWORD } })).json()).toEqual({ message: '验证成功' })
    expect((await put({ 'security.password_min_length': 7 })).statusCode).toBe(200)
  })

  it('修改设置后通知所有启用的超级管理员：写明改了哪些项，密钥只说已更新', async () => {
    await handle.db.delete(notifications).where(eq(notifications.title, '系统设置已修改'))
    await put({ 'mail.smtp_host': 'smtp.example.com', 'mail.smtp_password': 'secret-pw', 'security.totp_enabled': true })
    const rows = await handle.db.select().from(notifications).where(eq(notifications.title, '系统设置已修改'))
    const mine = rows.find((r) => r.user_id === s.userId)!
    expect(mine).toMatchObject({ noti_type: 'warning', is_global: false, link: '/system/settings' })
    expect(mine.content).toContain('修改了 3 项系统设置')
    expect(mine.content).toContain('SMTP 服务器 → smtp.example.com')
    expect(mine.content).toContain('SMTP 密码：已更新')
    expect(mine.content).not.toContain('secret-pw')
    expect(mine.content).toContain('两步验证开关 → true')
  })
})
