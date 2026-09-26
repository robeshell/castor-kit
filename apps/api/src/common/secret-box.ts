/**
 * Encryption for small secrets stored in the database (TOTP secrets): AES-256-GCM with a key derived from SECRET_KEY.
 *
 * The key comes from HKDF with its own `info` label, so it is independent of the session cookie key derived from the
 * same SECRET_KEY. Changing SECRET_KEY makes stored secrets unreadable (users would need to set up 2FA again, or an
 * admin resets it for them).
 *
 * Format: `v1:<iv>:<tag>:<ciphertext>` (base64url parts).
 */

import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto'

const VERSION = 'v1'

function keyFor(secretKey: string): Buffer {
  return Buffer.from(hkdfSync('sha256', secretKey, '', 'castor-kit-secret-box', 32))
}

export function sealSecret(plain: string, secretKey: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', keyFor(secretKey), iv)
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  return [VERSION, iv, cipher.getAuthTag(), data].map((p) => (typeof p === 'string' ? p : p.toString('base64url'))).join(':')
}

/** The plain text, or null when the value is malformed or was sealed with another key */
export function openSecret(sealed: string, secretKey: string): string | null {
  const [version, iv, tag, data] = sealed.split(':')
  if (version !== VERSION || !iv || !tag || data === undefined) return null
  try {
    const decipher = createDecipheriv('aes-256-gcm', keyFor(secretKey), Buffer.from(iv, 'base64url'))
    decipher.setAuthTag(Buffer.from(tag, 'base64url'))
    return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8')
  } catch {
    return null
  }
}
