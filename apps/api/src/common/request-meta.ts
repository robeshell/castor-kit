/**
 * 请求元信息（客户端 IP、User-Agent、写进操作日志的请求体文本等）
 */

import type { FastifyRequest } from 'fastify'

/**
 * 客户端 IP：以 `request.ip` 为准。直连时即对端地址；部署在可信反代后由 `trustProxy`
 * 修正为真实 IP。不直接读可伪造的 X-Forwarded-For。
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
 * 等价 Python `json.dumps(value, ensure_ascii=False)`：默认分隔符是 `", "` 与 `": "`，
 * 保证写进 operation_logs.payload 的文本格式与既有日志一致。
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

/** 序列化请求体并限制长度（敏感字段先脱敏） */
export function safePayload(payload: unknown): string | null {
  if (payload === null || payload === undefined) return null
  const text = pyJsonDumps(maskSensitive(payload))
  const chars = [...text]
  if (chars.length > 2000) return `${chars.slice(0, 2000).join('')}...(truncated)`
  return text
}
