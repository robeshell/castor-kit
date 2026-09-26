import { describe, expect, it } from 'vitest'
import { SettingsStore } from '@/common/settings'
import { loadConfig } from '@/config'
import type { Executor } from '@/db/client'

const base = { NODE_ENV: 'test', INSTANCE_DIR: '/tmp/ck-instance' }

/** Effective settings from the environment alone (defaults + pinned values; no database needed for peek()) */
function fromEnv(env: Record<string, string>) {
  const config = loadConfig({ ...base, ...env })
  return { config, settings: new SettingsStore(null as unknown as Executor, config).peek() }
}

describe('settings pinned by environment variables', () => {
  it('只收集设置了且非空的变量；本地存储目录默认在 instance/uploads/files', () => {
    const { config } = fromEnv({ SMTP_HOST: 'smtp.example.com', SMTP_USER: '  ', AI_MODEL: '' })
    expect(config.settingsEnv).toEqual({ SMTP_HOST: 'smtp.example.com' })
    expect(config.storageLocalDir).toBe('/tmp/ck-instance/uploads/files')
  })

  it('上传限制：取设置值与 MAX_CONTENT_LENGTH 的较小值；类型归一化（小写、去点、去空格）', () => {
    const { settings } = fromEnv({ UPLOAD_MAX_SIZE: String(50 * 1024 * 1024), MAX_CONTENT_LENGTH: String(16 * 1024 * 1024) })
    expect(settings.upload.maxSize).toBe(16 * 1024 * 1024)
    expect(fromEnv({}).settings.upload.allowedTypes).toContain('png')
    expect(fromEnv({}).settings.upload.allowedTypes).not.toContain('svg')
    expect(fromEnv({ UPLOAD_ALLOWED_TYPES: ' .PNG, pdf ,,Txt ' }).settings.upload.allowedTypes).toEqual(['png', 'pdf', 'txt'])
  })

  it('s3：有 endpoint 时默认 path-style；区域默认 us-east-1；地址去掉结尾斜杠；驱动名不区分大小写', () => {
    const { settings } = fromEnv({
      STORAGE_DRIVER: 'S3',
      S3_BUCKET: 'b',
      S3_ACCESS_KEY: 'a',
      S3_SECRET_KEY: 's',
      S3_ENDPOINT: 'http://minio:9000/',
      S3_PUBLIC_URL: 'https://cdn.example.com/',
    })
    expect(settings.storage).toMatchObject({
      driver: 's3',
      s3: { endpoint: 'http://minio:9000', forcePathStyle: true, region: 'us-east-1', publicUrl: 'https://cdn.example.com' },
    })
    expect(fromEnv({ S3_FORCE_PATH_STYLE: 'false', S3_ENDPOINT: 'http://minio:9000' }).settings.storage.s3.forcePathStyle).toBe(false)
  })

  it('邮件：SMTP_SECURE 为空时按端口判断；发件人默认用账号', () => {
    expect(fromEnv({ SMTP_HOST: 'h', SMTP_PORT: '465' }).settings.mail).toMatchObject({ port: 465, secure: true })
    expect(fromEnv({ SMTP_HOST: 'h' }).settings.mail).toMatchObject({ port: 587, secure: false })
    expect(fromEnv({ SMTP_HOST: 'h', SMTP_SECURE: 'true', SMTP_USER: 'bot@example.com' }).settings.mail).toMatchObject({
      secure: true,
      from: 'bot@example.com',
    })
  })

  it('取值不合法的变量 → 启动时报错（指出变量名）', () => {
    expect(() => fromEnv({ STORAGE_DRIVER: 'ftp' })).toThrow('环境变量 STORAGE_DRIVER 的值不合法')
    expect(() => fromEnv({ SMTP_PORT: 'abc' })).toThrow('环境变量 SMTP_PORT 的值不合法')
    expect(() => fromEnv({ APP_BASE_URL: 'example.com' })).toThrow('环境变量 APP_BASE_URL 的值不合法')
    expect(() => loadConfig({ ...base, MAIL_DRIVER: 'smtp2' })).toThrow('MAIL_DRIVER 只能是 log 或 none（当前：smtp2）')
  })
})
