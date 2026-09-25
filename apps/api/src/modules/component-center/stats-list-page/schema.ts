/**
 * 带统计的列表页 schema 层
 */

import { z } from 'zod'
import { isPlainObject, pyFloat, pyInt, pyStr } from '@/common/py'
import { ServiceError } from '@/common/errors'
import { formatDateTime } from '@/common/serialize'
import { numericToFloat, type StatsItem } from '@/db/schema'

/** 请求体宽松校验：任意键、全部可选，归一化在 service 里做 */
export const statsItemBodySchema = z.record(z.string(), z.unknown()).nullish()

export const STATUS_VALUES = new Set(['draft', 'published', 'archived'])
export const CATEGORY_VALUES = new Set(['general', 'order', 'user', 'finance', 'risk'])

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

export function parseFloat(value: unknown, fallback = 0): number {
  if (value === null || value === undefined) return fallback
  try {
    return pyFloat(value)
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

// ---------------------------------------------------------------- 值处理辅助

/** 浮点数 → numeric 参数文本（最短往返表示；NaN/±Infinity 用 PG 的字面量） */
export function floatToNumericParam(value: number): string {
  if (Number.isNaN(value)) return 'NaN'
  if (!Number.isFinite(value)) return value > 0 ? 'Infinity' : '-Infinity'
  return String(value)
}

/**
 * 浮点数与 numeric 值按精确值比较（判断字段是否变更用）。
 * numeric(14,2) 的值只有 x.00/.25/.50/.75 才可能与二进制浮点精确相等。
 */
export function floatEqualsNumeric(value: number, stored: string | null): boolean {
  if (stored === null || !Number.isFinite(value)) return false
  return Number.isInteger(value * 4) && Number(stored) === value
}

/** 保留 2 位小数，Python `round(x, 2)` 语义（浮点、银行家舍入只在二进制精确的 .xx5 上生效） */
export function pyRound2(x: number): number {
  if (!Number.isFinite(x) || Math.abs(x) >= 1e21) return x
  if (Number.isInteger(x * 8) && !Number.isInteger(x * 4)) {
    // 精确的 .xx5：round-half-even
    const lo = Math.floor(x * 100)
    const n = ((lo % 2) + 2) % 2 === 0 ? lo : lo + 1
    return n / 100
  }
  return Number(x.toFixed(2))
}

/**
 * 遍历 fields（POST 导出的 fields 可能不是列表）：list → 元素，str → 字符，dict → 键；
 * 其余真值（数字 / true）不可迭代 → 500。
 */
export function pyIterate(value: unknown): unknown[] {
  if (Array.isArray(value)) return value
  if (typeof value === 'string') return Array.from(value)
  if (isPlainObject(value)) return Object.keys(value)
  throw new ServiceError(`'${typeof value}' object is not iterable`, 500)
}

/** 判断 f 是否为可导出字段；f 为 list/dict（不能作为字段名）时返回 500 */
export function isExportField(field: unknown): field is string {
  if (field !== null && typeof field === 'object') throw new ServiceError('unhashable type', 500)
  return typeof field === 'string' && Object.hasOwn(EXPORT_FIELD_MAP, field)
}

const PG_INT_MIN = -2_147_483_648
const PG_INT_MAX = 2_147_483_647

/**
 * ids 中各元素内联进 `id IN (...)` 后在 PostgreSQL 上的效果：
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

