/**
 * Data dictionary schema layer: request bodies and import-file parsing
 */

import { z } from 'zod'
import { field } from '@/common/validation'

export const dictTypeBody = z.object({
  name: field.requiredText('字典名称', '字典名称不能为空'),
  code: field.requiredText('字典编码', '字典编码不能为空'),
  description: field.text('描述'),
  sort_order: field.int('排序', 0),
  is_active: field.bool('是否启用', true),
})

export const dictItemBody = z.object({
  dict_type_id: field.id('字典类型'),
  label: field.requiredText('字典标签', '字典标签不能为空'),
  value: field.requiredText('字典值', '字典值不能为空'),
  color: field.text('标签颜色'),
  sort_order: field.int('排序', 0),
  is_default: field.bool('是否默认', false),
  is_active: field.bool('是否启用', true),
  description: field.text('备注'),
})

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

/** A yes/no from a query string or an import cell; empty or unrecognised → null */
export function parseBoolText(value: string | null | undefined): boolean | null {
  const raw = (value ?? '').trim().toLowerCase()
  if (TRUE_VALUES.has(raw)) return true
  if (FALSE_VALUES.has(raw)) return false
  return null
}

/** An integer import cell; empty or not an integer → fallback */
export function parseIntText(value: string | null | undefined, fallback: number): number {
  const raw = (value ?? '').trim()
  return /^[+-]?\d+$/.test(raw) ? Number.parseInt(raw, 10) : fallback
}
