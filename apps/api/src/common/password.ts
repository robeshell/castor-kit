/**
 * 密码哈希，存储格式：`pbkdf2:sha256:<iterations>$<salt>$<hex_digest>`
 *
 * - salt 是 16 位 [A-Za-z0-9] 字符串，按 UTF-8 字节参与计算（不做 base64/hex 解码）
 * - 派生长度 = 摘要长度（sha256 为 32 字节），输出小写 hex
 * - method 里省略迭代次数时按默认值 1_000_000 处理
 *
 * 新哈希一律写成该格式，与库中已有的密码哈希保持可互验。
 * 一律使用异步 pbkdf2：100 万次迭代同步执行会阻塞事件循环约 0.3–0.5s。
 */

import { pbkdf2, randomInt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const pbkdf2Async = promisify(pbkdf2)

export const DEFAULT_PBKDF2_ITERATIONS = 1_000_000
const SALT_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
const SALT_LENGTH = 16
const SUPPORTED_DIGESTS: Record<string, number> = { sha256: 32, sha512: 64, sha1: 20 }

function genSalt(length = SALT_LENGTH): string {
  let salt = ''
  for (let i = 0; i < length; i += 1) salt += SALT_CHARS[randomInt(SALT_CHARS.length)]
  return salt
}

interface ParsedMethod {
  digest: string
  iterations: number
}

function parseMethod(method: string): ParsedMethod | null {
  const [name, digest = 'sha256', iterRaw] = method.split(':')
  if (name !== 'pbkdf2') return null
  if (!Object.hasOwn(SUPPORTED_DIGESTS, digest)) return null
  const iterations = iterRaw === undefined ? DEFAULT_PBKDF2_ITERATIONS : Number(iterRaw)
  if (!Number.isSafeInteger(iterations) || iterations <= 0) return null
  return { digest, iterations }
}

async function derive(password: string, salt: string, { digest, iterations }: ParsedMethod): Promise<Buffer> {
  return pbkdf2Async(
    Buffer.from(password, 'utf8'),
    Buffer.from(salt, 'utf8'),
    iterations,
    SUPPORTED_DIGESTS[digest]!,
    digest,
  )
}

export async function generatePasswordHash(
  password: string,
  iterations: number = DEFAULT_PBKDF2_ITERATIONS,
): Promise<string> {
  const salt = genSalt()
  const method = { digest: 'sha256', iterations }
  const hash = await derive(password, salt, method)
  return `pbkdf2:sha256:${iterations}$${salt}$${hash.toString('hex')}`
}

/** 校验失败（含格式不识别、非字符串密码）一律返回 false，不抛异常。 */
export async function checkPasswordHash(pwhash: string | null | undefined, password: unknown): Promise<boolean> {
  if (typeof pwhash !== 'string' || typeof password !== 'string') return false
  const parts = pwhash.split('$')
  if (parts.length !== 3) return false
  const [methodRaw, salt, expectedHex] = parts as [string, string, string]
  const method = parseMethod(methodRaw)
  if (!method || !/^[0-9a-f]+$/.test(expectedHex)) return false

  const expected = Buffer.from(expectedHex, 'hex')
  const actual = await derive(password, salt, method)
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}
