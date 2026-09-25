/**
 * Password hashing; storage format: `pbkdf2:sha256:<iterations>$<salt>$<hex_digest>`
 *
 * - salt is a 16-char [A-Za-z0-9] string, used as UTF-8 bytes (no base64/hex decoding)
 * - derived length = digest length (32 bytes for sha256), output as lowercase hex
 * - when method omits the iteration count, the default 1_000_000 is used
 *
 * New hashes are always written in this format so they stay mutually verifiable with existing password hashes in the DB.
 * Always use async pbkdf2: running 1M iterations synchronously would block the event loop for ~0.3–0.5s.
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

/** Any verification failure (incl. unrecognized format or non-string password) returns false; never throws. */
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
