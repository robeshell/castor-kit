/**
 * Tree list page schema layer: request bodies and import / export field mapping
 */

import { z } from 'zod'
import { formatDateTime } from '@/common/serialize'
import { exportBody, field } from '@/common/validation'
import type { TreeNode } from '@/db/schema'

export const TREE_STATUSES = ['active', 'inactive', 'archived'] as const
export const STATUS_ERROR = '状态仅支持 active/inactive/archived'

export const treeNodeBody = z.object({
  name: field.requiredText('节点名称', '节点名称不能为空'),
  node_code: field.requiredText('节点编码', '节点编码不能为空'),
  parent_id: field.id('父节点'),
  node_type: field.text('节点类型'),
  icon: field.text('图标'),
  description: field.text('描述'),
  sort_order: field.int('排序', 0),
  is_active: field.bool('启用', true),
  status: field.choice('状态', TREE_STATUSES, 'active', STATUS_ERROR),
  owner: field.text('负责人'),
})

export type TreeNodeInput = z.output<typeof treeNodeBody>

/** The filters mirror the list's query parameters (text) */
export const treeExportBody = exportBody({
  search: field.text('搜索'),
  node_type: field.text('节点类型'),
  status: field.text('状态'),
  owner: field.text('负责人'),
  is_active: field.text('启用'),
})

export const EXPORT_FIELD_MAP: Record<string, [string, (item: TreeNode) => unknown]> = {
  id: ['ID', (item) => item.id],
  name: ['节点名称', (item) => item.name],
  node_code: ['节点编码', (item) => item.node_code],
  parent_id: ['父节点ID', (item) => item.parent_id || ''],
  node_type: ['节点类型', (item) => item.node_type || 'category'],
  icon: ['图标', (item) => item.icon || ''],
  status: ['状态', (item) => item.status || 'active'],
  owner: ['负责人', (item) => item.owner || ''],
  sort_order: ['排序', (item) => item.sort_order ?? 0],
  is_active: ['启用', (item) => (item.is_active ? '启用' : '停用')],
  description: ['描述', (item) => item.description || ''],
  created_at: ['创建时间', (item) => formatDateTime(item.created_at)],
  updated_at: ['更新时间', (item) => formatDateTime(item.updated_at)],
}

export const IMPORT_HEADER_MAP: Record<string, string> = {
  ID: 'id',
  节点名称: 'name',
  节点编码: 'node_code',
  父节点ID: 'parent_id',
  节点类型: 'node_type',
  图标: 'icon',
  状态: 'status',
  负责人: 'owner',
  排序: 'sort_order',
  启用: 'is_active',
  描述: 'description',
}

export const TEMPLATE_HEADERS = ['节点名称', '节点编码', '父节点ID', '节点类型', '图标', '状态', '负责人', '排序', '启用', '描述']
export const TEMPLATE_ROWS = [['根节点示例', 'root_001', '', 'category', '', 'active', 'admin', 0, '启用', '示例描述']]

export interface ErrorRow {
  line: number
  reason: string
  row: Record<string, string>
}

export function buildErrorRow(line: number, reason: string, row: Record<string, string>): ErrorRow {
  return { line, reason, row }
}
