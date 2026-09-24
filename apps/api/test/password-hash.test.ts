import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import pg from 'pg'
import { describe, expect, it } from 'vitest'
import { checkPasswordHash, generatePasswordHash } from '@/common/password'

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgresql://wangwenyu@localhost/aurastack_test'
// AuraStack 的 venv：用真实 werkzeug 反向验证 Node 生成的哈希（并行运行期两个后端必须互相可验）
const WERKZEUG_PYTHON = process.env.WERKZEUG_PYTHON ?? '/Users/wangwenyu/Documents/Code/AuraStack/venv/bin/python'

describe('werkzeug 密码哈希兼容', () => {
  it('校验库里现存的 werkzeug 哈希（admin / admin123）', async () => {
    const client = new pg.Client(TEST_DATABASE_URL)
    await client.connect()
    const { rows } = await client.query<{ password_hash: string }>(
      "SELECT password_hash FROM admin_users WHERE username = 'admin'",
    )
    await client.end()
    // 空库（只跑过 baseline、未 seed）没有 admin，跳过
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

  it.skipIf(!existsSync(WERKZEUG_PYTHON))('Node 生成的哈希能被 werkzeug.check_password_hash 验证', async () => {
    const hash = await generatePasswordHash('新密码-xyz')
    const out = execFileSync(WERKZEUG_PYTHON, [
      '-c',
      'import sys\nfrom werkzeug.security import check_password_hash as c\nprint(c(sys.argv[1], sys.argv[2]), c(sys.argv[1], "nope"))',
      hash,
      '新密码-xyz',
    ]).toString()
    expect(out.trim()).toBe('True False')
  })
})
