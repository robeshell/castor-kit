/**
 * TOTP helpers (RFC 6238 via otpauth): 6 digits, 30 s period, SHA-1 — what every authenticator app supports.
 *
 * - A code is accepted for the previous, current and next period (clock drift), and a period can only be used once
 *   per user (admin_users.totp_last_step, checked by the caller)
 * - Recovery codes are random (50 bits each), shown once and stored as sha256 hashes
 */

import { createHash, randomInt } from 'node:crypto'
import { Secret, TOTP } from 'otpauth'

export const TOTP_ISSUER = 'castor-kit'
const PERIOD = 30
const RECOVERY_CODE_COUNT = 10
/** Crockford-style alphabet without look-alikes (0/O, 1/I/L) */
const RECOVERY_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'

export function newTotpSecret(): string {
  return new Secret({ size: 20 }).base32
}

function totpFor(secret: string, label = ''): TOTP {
  return new TOTP({ issuer: TOTP_ISSUER, label, algorithm: 'SHA1', digits: 6, period: PERIOD, secret: Secret.fromBase32(secret) })
}

/** otpauth:// URI for the QR code */
export function totpUri(secret: string, username: string): string {
  return totpFor(secret, username).toString()
}

/** The time step a code matches (within ±1 period), or null */
export function matchTotpStep(secret: string, code: string, now = Date.now()): number | null {
  const token = code.replace(/\s+/g, '')
  if (!/^\d{6}$/.test(token)) return null
  const delta = totpFor(secret).validate({ token, timestamp: now, window: 1 })
  if (delta === null) return null
  return TOTP.counter({ period: PERIOD, timestamp: now }) + delta
}

/** Current code (tests) */
export function totpCode(secret: string, now = Date.now()): string {
  return totpFor(secret).generate({ timestamp: now })
}

export function newRecoveryCodes(): string[] {
  return Array.from({ length: RECOVERY_CODE_COUNT }, () => {
    const chars = Array.from({ length: 10 }, () => RECOVERY_ALPHABET[randomInt(RECOVERY_ALPHABET.length)]).join('')
    return `${chars.slice(0, 5)}-${chars.slice(5)}`
  })
}

/** Hash of a recovery code as typed (case, spaces and dashes don't matter) */
export function hashRecoveryCode(code: string): string {
  const normalized = code.toLowerCase().replace(/[\s-]+/g, '')
  return createHash('sha256').update(normalized).digest('hex')
}
