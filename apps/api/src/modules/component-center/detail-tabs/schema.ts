/**
 * Detail tabs page schema layer
 */

import { pyInt, pyStr, pyTruthy } from '@/common/py'

export const STATUS_VALUES = new Set(['active', 'leave', 'probation'])

/** `parse_bool(value, default=True)` */
export function parseBool<T>(value: unknown, fallback: T): boolean | T {
  if (value === null || value === undefined) return fallback
  if (typeof value === 'boolean') return value
  return ['true', '1', 'yes', '启用'].includes(pyStr(value).toLowerCase())
}

/** `parse_int(value, default=0)` */
export function parseIntOr<T>(value: unknown, fallback: T): number | T {
  try {
    return pyInt(value)
  } catch {
    return fallback
  }
}

/** `str(v or '').strip()` */
export function strOrEmpty(value: unknown): string {
  return pyTruthy(value) ? pyStr(value).trim() : ''
}

/** `str(v or '').strip() or None` */
export function strOrNull(value: unknown): string | null {
  return strOrEmpty(value) || null
}

/** `str(v or '#4080FF').strip() or '#4080FF'` */
export function colorOrDefault(value: unknown): string {
  return (pyTruthy(value) ? pyStr(value) : '#4080FF').trim() || '#4080FF'
}

/** `str(v or 'active').strip()`; falls back to 'active' when not in the enum */
export function normalizeStatus(value: unknown): string {
  const s = (pyTruthy(value) ? pyStr(value) : 'active').trim()
  return STATUS_VALUES.has(s) ? s : 'active'
}

export function hasKey(data: Record<string, unknown>, key: string): boolean {
  return Object.hasOwn(data, key)
}

/** Keep only fields that differ from the current row (UPDATE only fields whose value actually changed) */
export function changedFields<R extends Record<string, unknown>, P extends Partial<R>>(row: R, patch: P): P {
  const out: Partial<R> = {}
  for (const [k, v] of Object.entries(patch)) {
    if (row[k] !== v) (out as Record<string, unknown>)[k] = v
  }
  return out as P
}
