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

function maskSensitive(data: unknown): unknown {
  if (Array.isArray(data)) return data.map(maskSensitive)
  if (data !== null && typeof data === 'object') {
    return Object.fromEntries(
      Object.entries(data).map(([key, value]) => [
        key,
        SENSITIVE_KEYS.has(key.toLowerCase()) ? '***' : maskSensitive(value),
      ]),
    )
  }
  return data
}

/**
 * Equivalent to Python `json.dumps(value, ensure_ascii=False)`: default separators are `", "` and `": "`,
 * so the text written to operation_logs.payload matches the format of existing logs.
 */
export function pyJsonDumps(value: unknown): string {
  if (value === null || value === undefined) return 'null'
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'number') {
    if (Number.isNaN(value)) return 'NaN'
    if (!Number.isFinite(value)) return value > 0 ? 'Infinity' : '-Infinity'
    return String(value)
  }
  if (typeof value === 'string') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(pyJsonDumps).join(', ')}]`
  if (typeof value === 'object') {
    const parts = Object.entries(value).map(([k, v]) => `${JSON.stringify(k)}: ${pyJsonDumps(v)}`)
    return `{${parts.join(', ')}}`
  }
  return JSON.stringify(String(value))
}

/** Serialize the request body with a length limit (sensitive fields are masked first) */
export function safePayload(payload: unknown): string | null {
  if (payload === null || payload === undefined) return null
  const text = pyJsonDumps(maskSensitive(payload))
  const chars = [...text]
  if (chars.length > 2000) return `${chars.slice(0, 2000).join('')}...(truncated)`
  return text
}
