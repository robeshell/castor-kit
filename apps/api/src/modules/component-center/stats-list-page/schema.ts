/**
 * List page with stats schema layer: request bodies and import / export field mapping
 */

import { z } from 'zod'
import { formatDateTime } from '@/common/serialize'
import { exportBody, field } from '@/common/validation'
import { numericToFloat, type StatsItem } from '@/db/schema'

export const STATS_STATUSES = ['draft', 'published', 'archived'] as const
export const STATUS_ERROR = '状态仅支持 draft/published/archived'

export const statsItemBody = z.object({
  name: field.requiredText('名称', '名称不能为空'),
  item_code: field.requiredText('编码', '编码不能为空'),
  category: field.text('分类'),
  status: field.choice('发布状态', STATS_STATUSES, 'draft', STATUS_ERROR),
  amount: field.number('金额', 0),
  quantity: field.int('数量', 0),
  owner: field.text('负责人'),
  priority: field.int('优先级', 0),
  is_active: field.bool('状态', true),
  description: field.text('描述'),
})

export type StatsItemInput = z.output<typeof statsItemBody>

/** The filters mirror the list's query parameters (text) */
export const statsExportBody = exportBody({
  search: field.text('搜索'),
  category: field.text('分类'),
  owner: field.text('负责人'),
  is_active: field.text('状态'),
  status: field.text('发布状态'),
})

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

export interface ErrorRow {
  line: number
  reason: string
  row: Record<string, string>
}

export function buildErrorRow(line: number, reason: string, row: Record<string, string>): ErrorRow {
  return { line, reason, row }
}
