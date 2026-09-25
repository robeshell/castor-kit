/**
 * Notification schema layer: request normalization
 */

import { ServiceError } from '@/common/errors'
import { pyTruthy } from '@/common/py'

export const NOTI_TYPES = ['info', 'warning', 'success', 'error'] as const

/**
 * `(data.get(key) or '').strip()`: falsy → ''; truthy values must be strings,
 * otherwise it throws (uncaught → global 500).
 */
export function stripOrEmpty(value: unknown): string {
  if (!pyTruthy(value)) return ''
  if (typeof value !== 'string') throw new ServiceError(`'${typeof value}' object has no attribute 'strip'`, 500)
  return value.trim()
}

/** `noti_type = data.get('noti_type', 'info')`; not in the allowlist → 'info' */
export function normalizeNotiType(value: unknown): string {
  return typeof value === 'string' && (NOTI_TYPES as readonly string[]).includes(value) ? value : 'info'
}
