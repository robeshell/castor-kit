/**
 * werkzeug 兼容的密码哈希：`pbkdf2:sha256:<iterations>$<salt>$<hex_digest>`
 *
 * 对齐 AuraStack `generate_password_hash(password, method='pbkdf2:sha256')` /
 * `check_password_hash`（Werkzeug 3.1）：
 * - salt 是 16 位 [A-Za-z0-9] 字符串，按 UTF-8 字节参与计算（不做 base64/hex 解码）
 * - 派生长度 = sha256 摘要长度 32 字节，输出小写 hex
 * - 迭代次数省略时 werkzeug 使用其当前默认值 1_000_000
 *
 * 并行运行期新哈希也必须写成该格式，保证 Flask / Node 两个后端互相可验（rewrite-plan §2.3）。
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
