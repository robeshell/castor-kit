/**
 * Data dictionary schema layer
 */

import { pyInt, pyStr, pyStrOrEmpty } from '@/common/py'

export const CSV_HEADER_TO_FIELD: Record<string, string> = {
  字典标签: 'label',
  字典值: 'value',
  标签颜色: 'color',
  排序: 'sort_order',
  是否默认: 'is_default',
  是否启用: 'is_active',
  备注: 'description',
}

export const LEGACY_CSV_HEADER_TO_FIELD: Record<string, string> = {
  label: 'label',
  value: 'value',
  color: 'color',
  sort_order: 'sort_order',
  is_default: 'is_default',
  is_active: 'is_active',
  description: 'description',
}

export const ITEM_TABLE_HEADERS = ['字典标签', '字典值', '标签颜色', '排序', '是否默认', '是否启用', '备注']

const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on', '是', '启用'])
const FALSE_VALUES = new Set(['0', 'false', 'no', 'off', '否', '停用'])

/** parse_bool: None / '' → null; bools pass through; anything else is matched against the string sets, unrecognized → null */
export function parseBool(value: unknown): boolean | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'boolean') return value
  const raw = pyStr(value).trim().toLowerCase()
  if (TRUE_VALUES.has(raw)) return true
  if (FALSE_VALUES.has(raw)) return false
  return null
}

/** parse_int：int(value)，TypeError/ValueError → default */
export function parseInt(value: unknown, fallback = 0): number {
  try {
    return pyInt(value)
  } catch {
    return fallback
  }
}

/** normalize_string：str(value or '').strip() */
export function normalizeString(value: unknown): string {
  return pyStrOrEmpty(value)
}
