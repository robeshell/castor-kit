/**
 * 看板页 schema 层
 */

import { pyInt, pyStr, pyTruthy } from '@/common/py'

export const PRIORITY_VALUES = new Set(['low', 'medium', 'high', 'urgent'])

/** `parse_bool(value, default=True)`：None → default；bool 原样；否则 str(value).lower() in (...) */
export function parseBool<T>(value: unknown, fallback: T): boolean | T {
  if (value === null || value === undefined) return fallback
  if (typeof value === 'boolean') return value
  return ['true', '1', 'yes', '启用'].includes(pyStr(value).toLowerCase())
}

/** `parse_int(value, default=0)`：int(value)，TypeError/ValueError 时回落默认值 */
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

/** `str(v or 'medium').strip()`，不在枚举内回落 'medium' */
export function normalizePriority(value: unknown): string {
  const p = strOrFallback(value, 'medium')
  return PRIORITY_VALUES.has(p) ? p : 'medium'
}

/** `key in data` */
export function hasKey(data: Record<string, unknown>, key: string): boolean {
  return Object.hasOwn(data, key)
}

/**
 * 只对“值真的变了”的字段发 UPDATE（updated_at 也只在发 UPDATE 时刷新）：
 * 过滤掉与当前行相同的字段，返回空对象时调用方不应发 UPDATE。
 */
export function changedFields<R extends Record<string, unknown>, P extends Partial<R>>(row: R, patch: P): P {
  const out: Partial<R> = {}
  for (const [k, v] of Object.entries(patch)) {
    if (row[k] !== v) (out as Record<string, unknown>)[k] = v
  }
  return out as P
}
