import { describe, expect, it } from 'vitest'
import { loadConfig } from '@/config'

const base = { NODE_ENV: 'test', INSTANCE_DIR: '/tmp/ck-instance' }

describe('storage config', () => {
  it('默认：local 驱动，目录在 instance/uploads/files；上限取 UPLOAD_MAX_SIZE 与 MAX_CONTENT_LENGTH 的较小值', () => {
    const { storage } = loadConfig({ ...base, UPLOAD_MAX_SIZE: String(50 * 1024 * 1024), MAX_CONTENT_LENGTH: String(16 * 1024 * 1024) })
    expect(storage).toMatchObject({ driver: 'local', localDir: '/tmp/ck-instance/uploads/files', uploadMaxSize: 16 * 1024 * 1024 })
    expect(storage.uploadAllowedTypes).toContain('png')
    expect(storage.uploadAllowedTypes).not.toContain('svg')
  })

  it('UPLOAD_ALLOWED_TYPES 归一化：小写、去点、去空格', () => {
    expect(loadConfig({ ...base, UPLOAD_ALLOWED_TYPES: ' .PNG, pdf ,,Txt ' }).storage.uploadAllowedTypes).toEqual(['png', 'pdf', 'txt'])
  })

  it('s3：缺 bucket / 密钥时拒绝启动；有 endpoint 时默认 path-style；公开地址去掉结尾斜杠', () => {
    expect(() => loadConfig({ ...base, STORAGE_DRIVER: 's3', S3_BUCKET: 'b' })).toThrow('STORAGE_DRIVER=s3 需要设置 S3_ACCESS_KEY / S3_SECRET_KEY')
    const { storage } = loadConfig({
      ...base,
      STORAGE_DRIVER: 'S3',
      S3_BUCKET: 'b',
      S3_ACCESS_KEY: 'a',
      S3_SECRET_KEY: 's',
      S3_ENDPOINT: 'http://minio:9000',
      S3_PUBLIC_URL: 'https://cdn.example.com/',
    })
    expect(storage).toMatchObject({ driver: 's3', s3: { forcePathStyle: true, region: 'us-east-1', publicUrl: 'https://cdn.example.com' } })
  })

  it('未知驱动 → 拒绝启动', () => {
    expect(() => loadConfig({ ...base, STORAGE_DRIVER: 'ftp' })).toThrow('STORAGE_DRIVER 只能是 local 或 s3（当前：ftp）')
  })
})
