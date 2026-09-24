/**
 * 卡片列表页 schema 层（对齐 AuraStack backend/app/component_center/schema/card_list_page.py）
 */

import { z } from 'zod'
import { ServiceError } from '@/common/errors'
import { isPlainObject, pyInt, pyStr } from '@/common/py'
import { formatDateTime } from '@/common/serialize'
import type { CardItem } from '@/db/schema'

/** 移植期请求体：loose + 全可选，归一化在 service 里做 */
export const cardItemBodySchema = z.record(z.string(), z.unknown()).nullish()

export const STATUS_VALUES = new Set(['draft', 'published', 'archived'])
export const CATEGORY_VALUES = new Set(['general', 'product', 'article', 'event', 'promotion'])

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
