/**
 * List page with stats schema layer
 */

import { z } from 'zod'
import { isPlainObject, pyFloat, pyInt, pyStr } from '@/common/py'
import { ServiceError } from '@/common/errors'
import { formatDateTime } from '@/common/serialize'
import { numericToFloat, type StatsItem } from '@/db/schema'

/** Loose request-body validation: any keys, all optional; normalization happens in the service */
export const statsItemBodySchema = z.record(z.string(), z.unknown()).nullish()

export const STATUS_VALUES = new Set(['draft', 'published', 'archived'])
export const CATEGORY_VALUES = new Set(['general', 'order', 'user', 'finance', 'risk'])

export const EXPORT_FIELD_MAP: Record<string, [string, (item: StatsItem) => unknown]> = {
  id: ['ID', (item) => item.id],
  name: ['名称', (item) => item.name],
  item_code: ['编码', (item) => item.item_code],
  category: ['分类', (item) => item.category || ''],
  status: ['发布状态', (item) => item.status || 'draft'],
  amount: ['金额', (item) => numericToFloat(item.amount)],
  quantity: ['数量', (item) => item.quantity ?? 0],
  owner: ['负责人', (item) => item.owner || ''],
  priority: ['优先级', (item) => item.priority ?? 0],
  is_active: ['状态', (item) => (item.is_active ? '启用' : '停用')],
  description: ['描述', (item) => item.description || ''],
  created_at: ['创建时间', (item) => formatDateTime(item.created_at)],
  updated_at: ['更新时间', (item) => formatDateTime(item.updated_at)],
}

export const IMPORT_HEADER_MAP: Record<string, string> = {
  ID: 'id',
  名称: 'name',
  编码: 'item_code',
  分类: 'category',
  发布状态: 'status',
  金额: 'amount',
  数量: 'quantity',
  负责人: 'owner',
  优先级: 'priority',
  状态: 'is_active',
  描述: 'description',
}

export const TEMPLATE_HEADERS = ['名称', '编码', '分类', '发布状态', '金额', '数量', '负责人', '优先级', '状态', '描述']
export const TEMPLATE_ROWS = [['示例商品A', 'item_001', 'order', 'draft', 9999.0, 100, 'admin', 10, '启用', '示例描述']]

export function parseBool<D>(value: unknown, fallback: D): boolean | D {
  if (value === null || value === undefined) return fallback
  if (typeof value === 'boolean') return value
  const raw = pyStr(value).trim().toLowerCase()
  if (['true', '1', 'yes', '启用'].includes(raw)) return true
  if (['false', '0', 'no', '停用'].includes(raw)) return false
  return fallback
}

export function parseInt(value: unknown, fallback = 0): number {
  if (value === null || value === undefined) return fallback
  try {
    return pyInt(value)
  } catch {
    return fallback
  }
}

export function parseFloat(value: unknown, fallback = 0): number {
  if (value === null || value === undefined) return fallback
  try {
    return pyFloat(value)
  } catch {
    return fallback
  }
}

export interface ErrorRow {
  line: number
  reason: string
  row: Record<string, string>
}

export function buildErrorRow(line: number, reason: string, row: Record<string, string>): ErrorRow {
  return { line, reason, row }
}

// ---------------------------------------------------------------- Value helpers

/** Float → numeric parameter text (shortest round-trip representation; NaN/±Infinity use PG literals) */
export function floatToNumericParam(value: number): string {
  if (Number.isNaN(value)) return 'NaN'
  if (!Number.isFinite(value)) return value > 0 ? 'Infinity' : '-Infinity'
  return String(value)
}

/**
 * Compare a float and a numeric value exactly (used to detect whether a field changed).
 * A numeric(14,2) value can only equal a binary float exactly when it is x.00/.25/.50/.75.
 */
export function floatEqualsNumeric(value: number, stored: string | null): boolean {
  if (stored === null || !Number.isFinite(value)) return false
  return Number.isInteger(value * 4) && Number(stored) === value
}

/** Round to 2 decimals with Python `round(x, 2)` semantics (float-based; banker's rounding only applies to binary-exact .xx5 values) */
export function pyRound2(x: number): number {
  if (!Number.isFinite(x) || Math.abs(x) >= 1e21) return x
  if (Number.isInteger(x * 8) && !Number.isInteger(x * 4)) {
    // Exact .xx5: round-half-even
    const lo = Math.floor(x * 100)
    const n = ((lo % 2) + 2) % 2 === 0 ? lo : lo + 1
    return n / 100
  }
  return Number(x.toFixed(2))
}

/**
 * Iterate fields (fields in a POST export may not be a list): list → elements, str → characters, dict → keys;
 * other truthy values (numbers / true) are not iterable → 500.
 */
export function pyIterate(value: unknown): unknown[] {
  if (Array.isArray(value)) return value
  if (typeof value === 'string') return Array.from(value)
  if (isPlainObject(value)) return Object.keys(value)
  throw new ServiceError(`'${typeof value}' object is not iterable`, 500)
}

/** Whether f is an exportable field; returns 500 when f is a list/dict (not usable as a field name) */
export function isExportField(field: unknown): field is string {
  if (field !== null && typeof field === 'object') throw new ServiceError('unhashable type', 500)
  return typeof field === 'string' && Object.hasOwn(EXPORT_FIELD_MAP, field)
}

const PG_INT_MIN = -2_147_483_648
const PG_INT_MAX = 2_147_483_647

/**
 * How each element of ids behaves on PostgreSQL once inlined into `id IN (...)`:
 * - integer → matches; non-integer / out-of-int4 numbers → never match against integer (no error); None → no match
 * - string → parsed as int4 input ('2' can match; 'abc' / out of range → DB error → 500)
 * - bool / list / dict → type error → 500
 */
export function resolveIdList(ids: unknown[]): number[] {
  const result: number[] = []
  for (const raw of ids) {
    if (raw === null || raw === undefined) continue
    if (typeof raw === 'number') {
      if (Number.isInteger(raw) && raw >= PG_INT_MIN && raw <= PG_INT_MAX) result.push(raw)
      continue
    }
    if (typeof raw === 'string' && /^\s*[+-]?\d+\s*$/.test(raw)) {
      const n = Number(raw.trim())
      if (n >= PG_INT_MIN && n <= PG_INT_MAX) {
        result.push(n)
        continue
      }
    }
    throw new ServiceError(`invalid id: ${pyStr(raw)}`, 500)
  }
  return result
}

