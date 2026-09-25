/**
 * Kanban page schema layer
 */

import { pyInt, pyStr, pyTruthy } from '@/common/py'

export const PRIORITY_VALUES = new Set(['low', 'medium', 'high', 'urgent'])

/** `parse_bool(value, default=True)`: None → default; bool as-is; otherwise str(value).lower() in (...) */
export function parseBool<T>(value: unknown, fallback: T): boolean | T {
  if (value === null || value === undefined) return fallback
  if (typeof value === 'boolean') return value
  return ['true', '1', 'yes', '启用'].includes(pyStr(value).toLowerCase())
}

/** `parse_int(value, default=0)`: int(value), falling back to the default on TypeError/ValueError */
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

/** `str(v or fallback).strip()` */
export function strOrFallback(value: unknown, fallback: string): string {
  return (pyTruthy(value) ? pyStr(value) : fallback).trim()
}

/** `str(v or '#4080FF').strip() or '#4080FF'` */
export function colorOrDefault(value: unknown): string {
  return strOrFallback(value, '#4080FF') || '#4080FF'
}

/** `str(v or 'medium').strip()`, falling back to 'medium' when not in the enum */
export function normalizePriority(value: unknown): string {
  const p = strOrFallback(value, 'medium')
  return PRIORITY_VALUES.has(p) ? p : 'medium'
}

/** `key in data` */
export function hasKey(data: Record<string, unknown>, key: string): boolean {
  return Object.hasOwn(data, key)
}

/**
 * Only send an UPDATE for fields whose value actually changed (updated_at is refreshed only when an UPDATE is sent):
 * filters out fields equal to the current row; when the result is empty the caller should not send an UPDATE.
 */
export function changedFields<R extends Record<string, unknown>, P extends Partial<R>>(row: R, patch: P): P {
  const out: Partial<R> = {}
  for (const [k, v] of Object.entries(patch)) {
    if (row[k] !== v) (out as Record<string, unknown>)[k] = v
  }
  return out as P
}
