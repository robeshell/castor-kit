import pg from 'pg'
import { describe, expect, it } from 'vitest'
import { checkPasswordHash, generatePasswordHash } from '@/common/password'

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgresql://wangwenyu@localhost/castor_kit_test'

describe('pbkdf2:sha256 密码哈希', () => {
  it('校验库里现存的 pbkdf2:sha256 哈希（admin / admin123）', async () => {
    const client = new pg.Client(TEST_DATABASE_URL)
    await client.connect()
    const { rows } = await client.query<{ password_hash: string }>(
      "SELECT password_hash FROM admin_users WHERE username = 'admin'",
    )
    await client.end()
    // An empty DB (only baseline run, not seeded) has no admin, so skip
    if (rows.length === 0) return
    const hash = rows[0]!.password_hash
    expect(hash.startsWith('pbkdf2:sha256:')).toBe(true)
    expect(await checkPasswordHash(hash, 'admin123')).toBe(true)
    expect(await checkPasswordHash(hash, 'admin1234')).toBe(false)
  })

  it('生成格式为 pbkdf2:sha256:1000000$<16位salt>$<64位hex>，并能往返校验', async () => {
    const hash = await generatePasswordHash('中文-密码 123')
    expect(hash).toMatch(/^pbkdf2:sha256:1000000\$[A-Za-z0-9]{16}\$[0-9a-f]{64}$/)
    expect(await checkPasswordHash(hash, '中文-密码 123')).toBe(true)
    expect(await checkPasswordHash(hash, '中文-密码 124')).toBe(false)
  })

  it('非法输入一律返回 false', async () => {
    expect(await checkPasswordHash('plain', 'x')).toBe(false)
    expect(await checkPasswordHash('scrypt:32768:8:1$abc$00', 'x')).toBe(false)
    expect(await checkPasswordHash('pbkdf2:md4:1000$abc$00', 'x')).toBe(false)
    expect(await checkPasswordHash(null, 'x')).toBe(false)
    const hash = await generatePasswordHash('x', 1000)
    expect(await checkPasswordHash(hash, undefined)).toBe(false)
    expect(await checkPasswordHash(hash, 123)).toBe(false)
  })
})
