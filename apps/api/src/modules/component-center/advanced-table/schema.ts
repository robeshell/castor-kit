/**
 * 高级表格页 schema 层（对齐 AuraStack backend/app/component_center/schema/advanced_table_page.py）
 *
 * 注意这里的 parse_bool 与 kanban/detail_tabs 的不同：认 on/off/是/否，未知值回落默认值。
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
 * Python 发给 numeric 列的 float：psycopg2 按 `repr(float)` 内联（nan/inf 为 'NaN'/'Infinity'），
 * JS 的 `String(number)` 同为最短往返表示，数据库按 numeric(7,2) 舍入。
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

/** `Decimal(numeric) == float`：Python 按精确值比较（Decimal('0.10') != 0.1） */
export function numericEqualsFloat(numeric: string | null, value: number): boolean {
  if (numeric === null || numeric === 'NaN' || !Number.isFinite(value) || Math.abs(value) >= 1e21) return false
  const exact = stripDecimal(value.toFixed(100))
  if (exact === '0' && value !== 0) return false
  return exact === stripDecimal(numeric)
}

/** Python `round(x, 2)`：按精确二进制值舍入，恰好一半时取偶 */
export function pyRound2(x: number): number {
  if (!Number.isFinite(x)) return x
  const t = x * 8
  // 恰好落在 .xx5 上的 double 只有 m/8（m 为奇数）这一类
  if (Number.isInteger(t) && Math.abs(t) % 2 === 1) {
    const mag = Math.abs(x) * 100 // m*12.5，精确
    const lower = Math.floor(mag)
    const n = lower % 2 === 0 ? lower : lower + 1
    return (x < 0 ? -n : n) / 100
  }
  return Number(x.toFixed(2))
}
