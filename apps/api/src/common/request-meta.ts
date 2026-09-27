/**
 * Request metadata (client IP, User-Agent, request body text written to the operation log, etc.)
 */

import type { FastifyRequest } from 'fastify'

/**
 * Client IP: `request.ip` is authoritative. On direct connections it is the peer address; behind a trusted reverse proxy `trustProxy`
 * resolves it to the real IP. Never read the spoofable X-Forwarded-For directly.
 */
export function getClientIp(request: FastifyRequest): string {
  return request.ip || ''
}

export function getUserAgent(request: FastifyRequest): string {
  const ua = request.headers['user-agent'] ?? ''
  return [...ua].slice(0, 500).join('')
}

export const SENSITIVE_KEYS = new Set([
  'password',
  'old_password',
  'new_password',
  'confirm_password',
  'secret',
  'token',
  'access_token',
  'api_key',
  'recovery_code',
  'authorization',
])

/**
 * The last word of a compound key that marks a secret ("mail.smtp_password", "storage.s3_secret_key", "ai.api_key");
 * only the end counts, so "security.password_min_length" stays readable in the log
 */
const SENSITIVE_PART = /(^|[._-])(password|passwd|secret|token|api_key|apikey|access_key|secret_key)$/

/** Whether a request field holds a secret: an exact known name, or a compound key containing one */
export function isSensitiveKey(key: string): boolean {
  const lower = key.toLowerCase()
  return SENSITIVE_KEYS.has(lower) || SENSITIVE_PART.test(lower)
}

function maskSensitive(data: unknown): unknown {
  if (Array.isArray(data)) return data.map(maskSensitive)
  if (data !== null && typeof data === 'object') {
    return Object.fromEntries(
      Object.entries(data).map(([key, value]) => [key, isSensitiveKey(key) ? '***' : maskSensitive(value)]),
    )
  }
  return data
}

/** Serialize the request body with a length limit (sensitive fields are masked first) */
export function safePayload(payload: unknown): string | null {
  if (payload === null || payload === undefined) return null
  const text = JSON.stringify(maskSensitive(payload))
  const chars = [...text]
  if (chars.length > 2000) return `${chars.slice(0, 2000).join('')}...(truncated)`
  return text
}
