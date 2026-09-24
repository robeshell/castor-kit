/**
 * 树形列表页 schema 层（对齐 AuraStack backend/app/component_center/schema/tree_list_page.py）
 */

import { z } from 'zod'
import { ServiceError } from '@/common/errors'
import { isPlainObject, pyInt, pyStr } from '@/common/py'
import { formatDateTime } from '@/common/serialize'
import type { TreeNode } from '@/db/schema'

/** 移植期请求体：loose + 全可选，归一化在 service 里做 */
export const treeNodeBodySchema = z.record(z.string(), z.unknown()).nullish()

export const STATUS_VALUES = new Set(['active', 'inactive', 'archived'])
export const NODE_TYPE_VALUES = new Set(['category', 'item', 'group'])

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

/** Python `int(x)`，失败（ValueError/TypeError）返回 null */
export function tryInt(value: unknown): number | null {
  try {
    return pyInt(value)
  } catch {
    return null
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

// ---------------------------------------------------------------- Python 语义辅助

/**
 * Python `for f in fields`（POST 导出的 fields 可能不是列表）：list → 元素，str → 字符，dict → 键；
 * 其余真值（数字 / True）不可迭代 → TypeError → 500。
 */
export function pyIterate(value: unknown): unknown[] {
  if (Array.isArray(value)) return value
  if (typeof value === 'string') return Array.from(value)
  if (isPlainObject(value)) return Object.keys(value)
  throw new ServiceError(`'${typeof value}' object is not iterable`, 500)
}

/** Python `f in EXPORT_FIELD_MAP`：list/dict 不可哈希 → TypeError → 500 */
export function isExportField(field: unknown): field is string {
  if (field !== null && typeof field === 'object') throw new ServiceError('unhashable type', 500)
  return typeof field === 'string' && Object.hasOwn(EXPORT_FIELD_MAP, field)
}

const PG_INT_MIN = -2_147_483_648
const PG_INT_MAX = 2_147_483_647

/** 能作为 integer 参数与 int4 列比较（超范围的 Python int 在 PostgreSQL 里比较不会命中，而不是报错） */
export function isPgInt(n: number): boolean {
  return Number.isInteger(n) && n >= PG_INT_MIN && n <= PG_INT_MAX
}

/**
 * SQLAlchemy `id.in_(ids)`（psycopg2 客户端插值）在 PostgreSQL 上的效果：
 * - 整数 → 匹配；非整数/超出 int4 的数字 → 与 integer 比较不会命中（不报错）；None → 不命中
 * - 字符串 → 按 int4 输入解析（'2' 可命中，'abc'/超范围 → 数据库报错 → 500）
 * - bool / list / dict → 类型错误 → 500
 */
export function resolveIdList(ids: unknown[]): number[] {
  const result: number[] = []
  for (const raw of ids) {
    if (raw === null || raw === undefined) continue
    if (typeof raw === 'number') {
      if (isPgInt(raw)) result.push(raw)
      continue
    }
    if (typeof raw === 'string' && /^\s*[+-]?\d+\s*$/.test(raw)) {
      const n = Number(raw.trim())
      if (isPgInt(n)) {
        result.push(n)
        continue
      }
    }
    throw new ServiceError(`invalid id: ${pyStr(raw)}`, 500)
  }
  return result
}
