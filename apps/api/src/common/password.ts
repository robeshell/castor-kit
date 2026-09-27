/**
 * Password hashing with scrypt (node:crypto), stored as a PHC string:
 * `$scrypt$ln=<log2 N>,r=<block size>,p=<parallelism>$<salt>$<hash>` (salt and hash in unpadded base64).
 *
 * - The parameters are part of the string, so they can be raised later and existing hashes still verify.
 * - Defaults follow the OWASP recommendation N = 2^15, r = 8, p = 3 (32 MiB of memory per hash).
 * - Always async: scrypt runs on the libuv thread pool instead of blocking the event loop.
 */

import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'

export interface ScryptParams {
  /** log2 of the CPU / memory cost N */
  ln: number
  /** Block size */
  r: number
  /** Parallelism */
  p: number
}

export const DEFAULT_SCRYPT_PARAMS: ScryptParams = { ln: 15, r: 8, p: 3 }

const SALT_BYTES = 16
const KEY_BYTES = 32
const PHC_RE = /^\$scrypt\$ln=(\d{1,2}),r=(\d{1,2}),p=(\d{1,2})\$([A-Za-z0-9+/]{16,})\$([A-Za-z0-9+/]{22,})$/

function deriveKey(password: string, salt: Buffer, { ln, r, p }: ScryptParams, length: number): Promise<Buffer> {
  const N = 2 ** ln
  return new Promise((resolve, reject) => {
    scrypt(Buffer.from(password, 'utf8'), salt, length, { N, r, p, maxmem: 256 * N * r }, (err, key) => (err ? reject(err) : resolve(key)))
  })
}

const b64 = (buf: Buffer) => buf.toString('base64').replace(/=+$/, '')

export async function generatePasswordHash(password: string, params: ScryptParams = DEFAULT_SCRYPT_PARAMS): Promise<string> {
  const salt = randomBytes(SALT_BYTES)
  const key = await deriveKey(password, salt, params, KEY_BYTES)
  return `$scrypt$ln=${params.ln},r=${params.r},p=${params.p}$${b64(salt)}$${b64(key)}`
}

/** Whether a stored value is a hash this module writes (anything else can never verify) */
export function isPasswordHash(value: string | null | undefined): boolean {
  return typeof value === 'string' && PHC_RE.test(value)
}

/** Any verification failure (an unrecognized format, parameters out of range, a non-string password) returns false; never throws. */
export async function checkPasswordHash(pwhash: string | null | undefined, password: unknown): Promise<boolean> {
  if (typeof pwhash !== 'string' || typeof password !== 'string') return false
  const m = PHC_RE.exec(pwhash)
  if (!m) return false
  const params = { ln: Number(m[1]), r: Number(m[2]), p: Number(m[3]) }
  // Bounds keep a crafted hash from asking for an absurd amount of memory or time
  if (params.ln < 1 || params.ln > 20 || params.r < 1 || params.p < 1 || params.p > 16) return false
  const expected = Buffer.from(m[5]!, 'base64')
  try {
    const actual = await deriveKey(password, Buffer.from(m[4]!, 'base64'), params, expected.length)
    return timingSafeEqual(expected, actual)
  } catch {
    return false
  }
}
