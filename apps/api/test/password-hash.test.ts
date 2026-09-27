import { describe, expect, it } from 'vitest'
import { checkPasswordHash, generatePasswordHash } from '@/common/password'
import { FAST_HASH } from './helpers'

const PHC_RE = /^\$scrypt\$ln=15,r=8,p=3\$[A-Za-z0-9+/]{22}\$[A-Za-z0-9+/]{43}$/

describe('scrypt 密码哈希', () => {
  it('默认参数：PHC 格式（$scrypt$ln=15,r=8,p=3$<盐>$<哈希>），能往返校验，盐每次不同', async () => {
    const hash = await generatePasswordHash('中文-密码 123')
    expect(hash).toMatch(PHC_RE)
    expect(await checkPasswordHash(hash, '中文-密码 123')).toBe(true)
    expect(await checkPasswordHash(hash, '中文-密码 124')).toBe(false)
    expect(await generatePasswordHash('中文-密码 123')).not.toBe(hash)
  })

  it('参数写在字符串里：用其他参数生成的哈希照样能校验', async () => {
    const hash = await generatePasswordHash('x', FAST_HASH)
    expect(hash.startsWith('$scrypt$ln=4,r=8,p=1$')).toBe(true)
    expect(await checkPasswordHash(hash, 'x')).toBe(true)
  })

  it('格式不对、参数越界、密码不是字符串 → false，不抛错', async () => {
    const hash = await generatePasswordHash('x', FAST_HASH)
    for (const bad of [null, '', 'plain', hash.replace('$scrypt$', '$argon2id$'), hash.replace('ln=4', 'ln=30'), hash.replace('p=1', 'p=0'), `${hash}$x`]) {
      expect(await checkPasswordHash(bad, 'x'), String(bad)).toBe(false)
    }
    expect(await checkPasswordHash(hash, undefined)).toBe(false)
    expect(await checkPasswordHash(hash, 123)).toBe(false)
  })
})
