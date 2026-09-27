/**
 * Dynamic form page schema layer: request bodies and import / export field mapping
 */

import { z } from 'zod'
import { formatDateTime } from '@/common/serialize'
import { exportBody, field, invalidMessage } from '@/common/validation'
import type { DynamicFormRecord } from '@/db/schema'

export const FORM_STATUSES = ['draft', 'published', 'archived'] as const
export const STATUS_ERROR = '状态仅支持 draft/published/archived'

/** Max number of dynamic fields on a single record */
export const MAX_FIELDS = 20

/** One dynamic field; rows without a key are dropped */
const formField = z.object({
  field_key: field.text('字段名'),
  field_value: field.text('字段值'),
  field_type: field.text('字段类型'),
  sort_order: field.optionalInt('字段排序'),
  remark: field.text('字段备注'),
})

export const dynamicFormBody = z.object({
  title: field.requiredText('标题', '标题不能为空'),
  record_code: field.requiredText('记录编码', '记录编码不能为空'),
  category: field.text('分类'),
  status: field.choice('发布状态', FORM_STATUSES, 'draft', STATUS_ERROR),
  owner: field.text('负责人'),
  priority: field.int('优先级', 0),
  is_active: field.bool('启用', true),
  description: field.text('描述'),
  fields: z
    .array(formField, { error: invalidMessage('动态字段') })
    .max(MAX_FIELDS, { error: '动态字段最多支持 20 条' })
    .nullish()
    .transform((v) => v ?? []),
})

export type DynamicFormInput = z.output<typeof dynamicFormBody>

/** Edit: the record code can't change, so it isn't read */
export const dynamicFormUpdateBody = dynamicFormBody.omit({ record_code: true })

/** The filters mirror the list's query parameters (text) */
export const dynamicFormExportBody = exportBody({
  search: field.text('搜索'),
  category: field.text('分类'),
  status: field.text('发布状态'),
  owner: field.text('负责人'),
  is_active: field.text('启用'),
})

/** Export row: record + its field count */
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
export const CATEGORY_VALUES = new Set(['general', 'config', 'profile', 'spec'])


export const TEMPLATE_HEADERS = ['标题', '记录编码', '分类', '发布状态', '负责人', '优先级', '启用', '描述']
export const TEMPLATE_ROWS = [['示例表单A', 'form_001', 'general', 'draft', 'admin', 0, '启用', '示例描述']]

export interface ErrorRow {
  line: number
  reason: string
  row: Record<string, string>
}

export function buildErrorRow(line: number, reason: string, row: Record<string, string>): ErrorRow {
  return { line, reason, row }
}
