/**
 * List page (query management) schema layer: request bodies, import / export field mapping and import-cell parsing
 */

import { z } from 'zod'
import { formatDateTime } from '@/common/serialize'
import { exportBody, field, invalidMessage } from '@/common/validation'
import type { QueryManagement } from '@/db/schema'

export const LIST_STATUSES = ['draft', 'published'] as const
export const STATUS_ERROR = '状态仅支持 draft/published'
const LOGICS = ['AND', 'OR'] as const

/** A JSON object setting (display / permission config); missing / null → {} */
const jsonObject = (label: string) =>
  z
    .record(z.string(), z.unknown(), { error: invalidMessage(label) })
    .nullish()
    .transform((v) => v ?? {})

/** Query conditions: items without a field or an operator are dropped */
const conditions = z
  .object(
    {
      groups: z
        .array(z.object({ name: field.text('分组名称'), logic: field.choice('分组逻辑', LOGICS, 'AND') }), { error: invalidMessage('条件配置') })
        .nullish(),
      items: z
        .array(
          z.object({
            field: field.text('条件字段'),
            operator: field.text('条件运算符'),
            value: z.unknown().optional(),
            logic: field.choice('条件逻辑', LOGICS, 'AND'),
          }),
          { error: invalidMessage('条件配置') },
        )
        .nullish(),
    },
    { error: invalidMessage('条件配置') },
  )
  .nullish()
  .transform((v) => ({
    groups: (v?.groups ?? []).map((g, i) => ({ name: g.name ?? `分组${i + 1}`, logic: g.logic })),
    items: (v?.items ?? [])
      .filter((item) => item.field && item.operator)
      .map((item) => ({ field: item.field!, operator: item.operator!, value: item.value ?? '', logic: item.logic })),
  }))

/** Schema config: text, or an object stored as indented JSON; missing / null → '' */
const schemaConfig = z
  .union([z.string(), z.record(z.string(), z.unknown())], { error: invalidMessage('Schema配置') })
  .nullish()
  .transform((v) => (v === null || v === undefined ? '' : typeof v === 'string' ? v.trim() : JSON.stringify(v, null, 2)))

export const listPageBody = z.object({
  name: field.requiredText('查询名称', '查询名称不能为空'),
  query_code: field.requiredText('查询编码', '查询编码不能为空'),
  category: field.text('查询分类'),
  keyword: field.text('关键字'),
  data_source: field.text('数据源'),
  owner: field.text('负责人'),
  image_urls: field.textList('图片URL列表'),
  file_urls: field.textList('文件URL列表'),
  priority: field.int('优先级', 0),
  is_active: field.bool('状态', true),
  status: field.choice('发布状态', LIST_STATUSES, 'draft', STATUS_ERROR),
  condition_logic: field.choice('条件逻辑', LOGICS, 'AND'),
  conditions,
  display_config: jsonObject('展示配置'),
  permission_config: jsonObject('权限配置'),
  schema_config: schemaConfig,
  description: field.text('描述'),
  operator: field.text('操作人'),
})

export type ListPageInput = z.output<typeof listPageBody>

export const previewBody = z.object({ display_config: jsonObject('展示配置'), conditions })

/** The filters mirror the list's query parameters (text) */
export const listPageExportBody = exportBody({
  search: field.text('搜索'),
  category: field.text('查询分类'),
  owner: field.text('负责人'),
  is_active: field.text('状态'),
  status: field.text('发布状态'),
})

function exportUrlList(raw: string | null): string {
  let urls: string[] = []
  if (raw) {
    try {
      const parsed: unknown = JSON.parse(raw)
      if (Array.isArray(parsed)) urls = parsed.map((v) => String(v).trim()).filter(Boolean)
    } catch {
      urls = []
    }
  }
  return urls.join(',')
}

export function exportImageUrls(item: QueryManagement): string {
  return exportUrlList(item.image_urls)
}

export function exportFileUrls(item: QueryManagement): string {
  return exportUrlList(item.file_urls)
}

export const EXPORT_FIELD_MAP: Record<string, [string, (item: QueryManagement) => unknown]> = {
  id: ['ID', (item) => item.id],
  name: ['名称', (item) => item.name],
  query_code: ['编码', (item) => item.query_code],
  category: ['分类', (item) => item.category || ''],
  keyword: ['关键字', (item) => item.keyword || ''],
  data_source: ['数据源', (item) => item.data_source || ''],
  owner: ['负责人', (item) => item.owner || ''],
  image_urls: ['图片URL列表', exportImageUrls],
  file_urls: ['文件URL列表', exportFileUrls],
  priority: ['优先级', (item) => (item.priority !== null ? item.priority : 0)],
  is_active: ['状态', (item) => (item.is_active ? '启用' : '停用')],
  status: ['发布状态', (item) => item.status || 'draft'],
  condition_logic: ['条件逻辑', (item) => item.condition_logic || 'AND'],
  conditions_json: ['条件配置JSON', (item) => item.conditions_json || ''],
  display_config: ['展示配置JSON', (item) => item.display_config || ''],
  permission_config: ['权限配置JSON', (item) => item.permission_config || ''],
  schema_config: ['Schema配置', (item) => item.schema_config || ''],
  version: ['版本号', (item) => (item.version !== null ? item.version : 1)],
  published_at: ['发布时间', (item) => formatDateTime(item.published_at)],
  description: ['描述', (item) => item.description || ''],
  created_at: ['创建时间', (item) => formatDateTime(item.created_at)],
  updated_at: ['更新时间', (item) => formatDateTime(item.updated_at)],
}

export const IMPORT_HEADER_MAP: Record<string, string> = {
  名称: 'name',
  编码: 'query_code',
  分类: 'category',
  查询名称: 'name',
  查询编码: 'query_code',
  查询分类: 'category',
  关键字: 'keyword',
  数据源: 'data_source',
  负责人: 'owner',
  图片URL列表: 'image_urls',
  文件URL列表: 'file_urls',
  优先级: 'priority',
  状态: 'is_active',
  描述: 'description',
  name: 'name',
  query_code: 'query_code',
  category: 'category',
  keyword: 'keyword',
  data_source: 'data_source',
  owner: 'owner',
  image_urls: 'image_urls',
  file_urls: 'file_urls',
  priority: 'priority',
  is_active: 'is_active',
  发布状态: 'status',
  status: 'status',
  description: 'description',
}

/** URLs from an import cell: a JSON array, or text separated by commas / semicolons / new lines */
export function parseUrlCell(text: string | undefined): string[] {
  const value = (text ?? '').trim()
  if (!value) return []
  try {
    const parsed: unknown = JSON.parse(value)
    if (Array.isArray(parsed)) return parsed.map((v) => String(v).trim()).filter(Boolean)
  } catch {
    // Not JSON: split on the separators
  }
  return value
    .split(/[,，;；\n]/)
    .map((v) => v.trim())
    .filter(Boolean)
}

export interface ErrorRow {
  line: number
  reason: string
  row: Record<string, string>
}

export function buildErrorRow(line: number, reason: string, row: Record<string, unknown>): ErrorRow {
  return {
    line,
    reason,
    row: Object.fromEntries(Object.entries(row ?? {}).map(([k, v]) => [k, v === null || v === undefined ? '' : String(v)])),
  }
}


/** `updated_at` → `Updated At` (preview column titles) */
export function titleCase(text: string): string {
  return text
    .split(' ')
    .map((word) => (word ? word[0]!.toUpperCase() + word.slice(1).toLowerCase() : word))
    .join(' ')
}
