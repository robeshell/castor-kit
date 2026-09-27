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

export const ITEM_TABLE_HEADERS = ['字典标签', '字典值', '标签颜色', '排序', '是否默认', '是否启用', '备注']
