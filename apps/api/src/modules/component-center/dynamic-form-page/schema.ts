/**
 * Dynamic form page schema layer
 */

import { z } from 'zod'
import { ServiceError } from '@/common/errors'
import { isPlainObject, pyInt, pyStr } from '@/common/py'
import { formatDateTime } from '@/common/serialize'
import type { DynamicFormRecord } from '@/db/schema'

/** Loose request-body validation: any keys, all optional; normalization happens in the service */
export const dynamicFormBodySchema = z.record(z.string(), z.unknown()).nullish()

/** Export row: record + field count (equivalent of `item.fields.count()`) */
export type DynamicFormExportRow = DynamicFormRecord & { fields_count: number }

export const EXPORT_FIELD_MAP: Record<string, [string, (item: DynamicFormExportRow) => unknown]> = {
  id: ['ID', (item) => item.id],
  title: ['标题', (item) => item.title],
  record_code: ['记录编码', (item) => item.record_code],
  category: ['分类', (item) => item.category || 'general'],
  status: ['发布状态', (item) => item.status || 'draft'],
  owner: ['负责人', (item) => item.owner || ''],
  priority: ['优先级', (item) => item.priority ?? 0],
  is_active: ['启用', (item) => (item.is_active ? '启用' : '停用')],
  fields_count: ['字段数量', (item) => item.fields_count],
  description: ['描述', (item) => item.description || ''],
  created_at: ['创建时间', (item) => formatDateTime(item.created_at)],
  updated_at: ['更新时间', (item) => formatDateTime(item.updated_at)],
}

export const IMPORT_HEADER_MAP: Record<string, string> = {
  ID: 'id',
  标题: 'title',
  记录编码: 'record_code',
  分类: 'category',
  发布状态: 'status',
  负责人: 'owner',
  优先级: 'priority',
  启用: 'is_active',
  描述: 'description',
}

export const VALID_FIELD_TYPES = new Set(['text', 'number', 'boolean', 'date'])
export const STATUS_VALUES = new Set(['draft', 'published', 'archived'])
export const CATEGORY_VALUES = new Set(['general', 'config', 'profile', 'spec'])

/** Max number of dynamic fields on a single record */
export const MAX_FIELDS = 20

export const TEMPLATE_HEADERS = ['标题', '记录编码', '分类', '发布状态', '负责人', '优先级', '启用', '描述']
export const TEMPLATE_ROWS = [['示例表单A', 'form_001', 'general', 'draft', 'admin', 0, '启用', '示例描述']]

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

export interface ErrorRow {
  line: number
  reason: string
  row: Record<string, string>
}

export function buildErrorRow(line: number, reason: string, row: Record<string, string>): ErrorRow {
  return { line, reason, row }
}

// ---------------------------------------------------------------- Value helpers

/** Length: list / str (in characters) / dict (key count); anything else (numbers, bool) → 500 */
export function pyLen(value: unknown): number {
  if (Array.isArray(value)) return value.length
  if (typeof value === 'string') return Array.from(value).length
  if (isPlainObject(value)) return Object.keys(value).length
  throw new ServiceError(`object of type '${typeof value}' has no len()`, 500)
}

/**
 * Expand x with iterable semantics: list → elements, str → characters, dict → keys;
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
