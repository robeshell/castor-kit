/**
 * Card list page schema layer: request bodies and import / export field mapping
 */

import { z } from 'zod'
import { formatDateTime } from '@/common/serialize'
import { exportBody, field } from '@/common/validation'
import type { CardItem } from '@/db/schema'

export const CARD_STATUSES = ['draft', 'published', 'archived'] as const
export const STATUS_ERROR = '状态仅支持 draft/published/archived'

export const cardItemBody = z.object({
  title: field.requiredText('标题', '标题不能为空'),
  card_code: field.requiredText('编码', '编码不能为空'),
  subtitle: field.text('副标题'),
  category: field.text('分类'),
  cover_url: field.text('封面'),
  tag: field.text('标签'),
  status: field.choice('发布状态', CARD_STATUSES, 'draft', STATUS_ERROR),
  owner: field.text('负责人'),
  priority: field.int('优先级', 0),
  is_active: field.bool('状态', true),
  description: field.text('描述'),
})

export type CardItemInput = z.output<typeof cardItemBody>

/** The filters mirror the list's query parameters (text) */
export const cardExportBody = exportBody({
  search: field.text('搜索'),
  category: field.text('分类'),
  owner: field.text('负责人'),
  is_active: field.text('状态'),
  status: field.text('发布状态'),
})

export const EXPORT_FIELD_MAP: Record<string, [string, (item: CardItem) => unknown]> = {
  id: ['ID', (item) => item.id],
  title: ['标题', (item) => item.title],
  card_code: ['编码', (item) => item.card_code],
  subtitle: ['副标题', (item) => item.subtitle || ''],
  category: ['分类', (item) => item.category || ''],
  tag: ['标签', (item) => item.tag || ''],
  status: ['发布状态', (item) => item.status || 'draft'],
  owner: ['负责人', (item) => item.owner || ''],
  priority: ['优先级', (item) => item.priority ?? 0],
  is_active: ['状态', (item) => (item.is_active ? '启用' : '停用')],
  description: ['描述', (item) => item.description || ''],
  created_at: ['创建时间', (item) => formatDateTime(item.created_at)],
  updated_at: ['更新时间', (item) => formatDateTime(item.updated_at)],
}

export const IMPORT_HEADER_MAP: Record<string, string> = {
  ID: 'id',
  标题: 'title',
  编码: 'card_code',
  副标题: 'subtitle',
  分类: 'category',
  标签: 'tag',
  发布状态: 'status',
  负责人: 'owner',
  优先级: 'priority',
  状态: 'is_active',
  描述: 'description',
}

export const TEMPLATE_HEADERS = ['标题', '编码', '副标题', '分类', '标签', '发布状态', '负责人', '优先级', '状态', '描述']
export const TEMPLATE_ROWS = [['示例卡片A', 'card_001', '副标题示例', 'product', '新品', 'draft', 'admin', 10, '启用', '示例描述']]

export interface ErrorRow {
  line: number
  reason: string
  row: Record<string, string>
}

export function buildErrorRow(line: number, reason: string, row: Record<string, string>): ErrorRow {
  return { line, reason, row }
}
