/**
 * Advanced table page schema layer
 *
 * Note this parse_bool differs from kanban/detail_tabs: it accepts on/off/'是'/'否' and falls back to the default for unknown values.
 */

import { pyFloat, pyInt, pyStr, pyTruthy } from '@/common/py'

export const STATUS_VALUES = new Set(['draft', 'published', 'archived'])
export const CATEGORY_VALUES = new Set(['general', 'order', 'user', 'finance', 'risk'])

/** `parse_bool(value, default=None)` */
export function parseBool<T>(value: unknown, fallback: T): boolean | T {
  if (value === null || value === undefined) return fallback
  if (typeof value === 'boolean') return value
  const raw = pyStr(value).trim().toLowerCase()
  if (['true', '1', 'yes', 'on', '启用', '是'].includes(raw)) return true
  if (['false', '0', 'no', 'off', '停用', '否'].includes(raw)) return false
  return fallback
}

/** `parse_int(value, default=0)` */
export function parseIntOr<T>(value: unknown, fallback: T): number | T {
  if (value === null || value === undefined) return fallback
  try {
    return pyInt(value)
  } catch {
    return fallback
  }
}

/** `parse_float(value, default=0.0)` */
export function parseFloatOr(value: unknown, fallback: number): number {
  if (value === null || value === undefined) return fallback
  try {
    return pyFloat(value)
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

export function hasKey(data: Record<string, unknown>, key: string): boolean {
  return Object.hasOwn(data, key)
}

/**
 * Float → numeric parameter text: `String(number)` is the shortest round-trip representation (NaN/±Infinity use PG literals);
 * the DB rounds to numeric(7,2).
 */
export function floatToNumericParam(value: number): string {
  if (Number.isNaN(value)) return 'NaN'
  if (!Number.isFinite(value)) return value > 0 ? 'Infinity' : '-Infinity'
  return String(value)
}

function stripDecimal(text: string): string {
  let t = text.startsWith('-') ? text.slice(1) : text
  const neg = text.startsWith('-')
  if (t.includes('.')) t = t.replace(/0+$/, '').replace(/\.$/, '')
  t = t.replace(/^0+(?=\d)/, '')
  return t === '0' ? '0' : `${neg ? '-' : ''}${t}`
}

/** Compare numeric and float by exact value ('0.10' is not equal to 0.1) */
export function numericEqualsFloat(numeric: string | null, value: number): boolean {
  if (numeric === null || numeric === 'NaN' || !Number.isFinite(value) || Math.abs(value) >= 1e21) return false
  const exact = stripDecimal(value.toFixed(100))
  if (exact === '0' && value !== 0) return false
  return exact === stripDecimal(numeric)
}

/** Round to 2 decimals with Python `round(x, 2)` semantics: rounds the exact binary value, ties go to even */
export function pyRound2(x: number): number {
  if (!Number.isFinite(x)) return x
  const t = x * 8
  // Only doubles of the form m/8 (m odd) land exactly on .xx5
  if (Number.isInteger(t) && Math.abs(t) % 2 === 1) {
    const mag = Math.abs(x) * 100 // m*12.5, exact
    const lower = Math.floor(mag)
    const n = lower % 2 === 0 ? lower : lower + 1
    return (x < 0 ? -n : n) / 100
  }
  return Number(x.toFixed(2))
}
