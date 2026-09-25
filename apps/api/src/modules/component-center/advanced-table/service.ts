/**
 * Advanced table page service layer
 */

import { ServiceError } from '@/common/errors'
import { notFound } from '@/common/http'
import { isPlainObject, pyStr, pyTruthy } from '@/common/py'
import type { Db, Executor } from '@/db/client'
import { advancedTableRowToDict, type AdvancedTableRow } from '@/db/schema'
import { parseLooseDate } from '@/common/py-date'
import { AdvancedTableRepository, type AdvancedTableRowPatch, type ListFilters } from './repository'
import {
  CATEGORY_VALUES,
  STATUS_VALUES,
  floatToNumericParam,
  hasKey,
  numericEqualsFloat,
  parseBool,
  parseFloatOr,
  parseIntOr,
  pyRound2,
  strOrEmpty,
  strOrNull,
} from './schema'

type Data = Record<string, unknown>

const INT32_MIN = -2147483648
const INT32_MAX = 2147483647

export function normalizeStatus(value: unknown, fallback: string): string {
  if (value === null || value === undefined) return fallback
  const raw = pyStr(value).trim().toLowerCase()
  if (!raw) return fallback
  if (!STATUS_VALUES.has(raw)) throw new ServiceError('状态仅支持 draft/published/archived', 400)
  return raw
}

export function normalizeCategory(value: unknown, fallback = 'general'): string {
  const raw = (pyTruthy(value) ? pyStr(value) : '').trim().toLowerCase() || fallback
  return CATEGORY_VALUES.has(raw) ? raw : fallback
}

export function normalizeProgress(value: unknown, fallback = 0): number {
  const progress = parseIntOr(value, fallback)
  if (progress < 0) return 0
  if (progress > 100) return 100
  return progress
}

export function normalizeSortOrder(value: unknown, fallback = 0): number {
  const sortOrder = parseIntOr(value, fallback)
  if (sortOrder < INT32_MIN || sortOrder > INT32_MAX) throw new ServiceError('排序值超出范围', 400)
  return sortOrder
}

/** Keep only fields that differ from the current row (UPDATE only fields whose value actually changed; score compares numeric and float by exact value) */
function changedFields(row: AdvancedTableRow, patch: AdvancedTableRowPatch, newScore?: number): AdvancedTableRowPatch {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(patch)) {
    if (k === 'score') {
      if (newScore === undefined || !numericEqualsFloat(row.score, newScore)) out[k] = v
    } else if ((row as Record<string, unknown>)[k] !== v) {
      out[k] = v
    }
  }
  return out as AdvancedTableRowPatch
}

/** `except Exception as e: rollback; raise ServiceError(str(e), 500)`: every exception in the transaction (including 400 business errors) becomes a 500 */
function as500(err: unknown): ServiceError {
  return new ServiceError(err instanceof Error ? err.message : String(err), 500)
}

export class AdvancedTableService {
  private readonly repo: AdvancedTableRepository

  constructor(private readonly db: Db) {
    this.repo = new AdvancedTableRepository(db)
  }

  async getOr404(id: number): Promise<AdvancedTableRow> {
    const item = await this.repo.get(id)
    if (!item) throw notFound()
    return item
  }

  async listItems(page: number, perPage: number, filters: ListFilters, sortField: string, sortOrder: string) {
    const { total, items } = await this.repo.listPage(filters, page, perPage, sortField, sortOrder)
    return { items: items.map(advancedTableRowToDict), total, page, per_page: perPage }
  }

  async getStats() {
    const s = await this.repo.stats()
    return {
      total: s.total,
      active_count: s.activeCount,
      inactive_count: s.total - s.activeCount,
      pinned_count: s.pinnedCount,
      published_count: s.publishedCount,
      avg_progress: pyRound2(Number(s.avgRow.progress ?? 0)),
      avg_score: pyRound2(Number(s.avgRow.score ?? 0)),
      category_stats: s.categoryRows.map((r) => ({ category: r.category || 'general', count: r.n })),
    }
  }

  async createItem(data: Data) {
    const name = strOrEmpty(data.name)
    const rowCode = strOrEmpty(data.row_code)
    if (!name) throw new ServiceError('名称不能为空')
    if (!rowCode) throw new ServiceError('编码不能为空')
    if (await this.repo.getByCode(rowCode)) throw new ServiceError('编码已存在')

    // Fields are validated in this order: status before sort_order (if both are invalid, the status error is reported first)
    const values = {
      name,
      row_code: rowCode,
      category: normalizeCategory(data.category),
      owner: strOrNull(data.owner),
      status: normalizeStatus(data.status, 'draft'),
      priority: parseIntOr(data.priority, 0),
      progress: normalizeProgress(data.progress, 0),
      score: floatToNumericParam(parseFloatOr(data.score, 0.0)),
      tags: strOrNull(data.tags),
      is_active: parseBool(data.is_active, true),
      is_pinned: parseBool(data.is_pinned, false),
      due_date: parseLooseDate(data.due_date),
      sort_order: normalizeSortOrder(data.sort_order, 0),
      remark: strOrNull(data.remark),
    }
    return advancedTableRowToDict(await this.repo.insert(values))
  }

  async updateItem(item: AdvancedTableRow, data: Data) {
    if (hasKey(data, 'name') && !strOrEmpty(data.name)) throw new ServiceError('名称不能为空')

    if (hasKey(data, 'row_code')) {
      const nextCode = strOrEmpty(data.row_code)
      if (!nextCode) throw new ServiceError('编码不能为空')
      if (await this.repo.getDuplicateCode(nextCode, item.id)) throw new ServiceError('编码已存在')
    }

    const patch: AdvancedTableRowPatch = {}
    let newScore: number | undefined
    if (hasKey(data, 'name')) patch.name = strOrEmpty(data.name)
    if (hasKey(data, 'row_code')) patch.row_code = strOrEmpty(data.row_code)
    if (hasKey(data, 'category')) patch.category = normalizeCategory(data.category, item.category || 'general')
    if (hasKey(data, 'owner')) patch.owner = strOrNull(data.owner)
    if (hasKey(data, 'priority')) patch.priority = parseIntOr(data.priority, item.priority || 0)
    if (hasKey(data, 'progress')) patch.progress = normalizeProgress(data.progress, item.progress || 0)
    if (hasKey(data, 'score')) {
      newScore = parseFloatOr(data.score, item.score !== null ? Number(item.score) : 0.0)
      patch.score = floatToNumericParam(newScore)
    }
    if (hasKey(data, 'tags')) patch.tags = strOrNull(data.tags)
    if (hasKey(data, 'is_active')) patch.is_active = parseBool(data.is_active, item.is_active)
    if (hasKey(data, 'is_pinned')) patch.is_pinned = parseBool(data.is_pinned, item.is_pinned)
    if (hasKey(data, 'sort_order')) patch.sort_order = normalizeSortOrder(data.sort_order, item.sort_order || 0)
    if (hasKey(data, 'remark')) patch.remark = strOrNull(data.remark)
    if (hasKey(data, 'status')) patch.status = normalizeStatus(data.status, item.status || 'draft')
    if (hasKey(data, 'due_date')) patch.due_date = parseLooseDate(data.due_date)

    const changed = changedFields(item, patch, newScore)
    if (Object.keys(changed).length > 0) await this.repo.update(item.id, changed)
    return advancedTableRowToDict((await this.repo.get(item.id))!)
  }

  async deleteItem(item: AdvancedTableRow) {
    await this.repo.delete(item.id)
    return { message: '删除成功' }
  }

  private async inTx<T>(fn: (repo: AdvancedTableRepository, tx: Executor) => Promise<T>): Promise<T> {
    try {
      return await this.db.transaction((tx) => fn(new AdvancedTableRepository(tx), tx))
    } catch (err) {
      throw as500(err)
    }
  }

  async reorderRows(items: unknown) {
    if (!Array.isArray(items)) throw new ServiceError('参数格式错误，需要数组')
    return this.inTx(async (repo) => {
      // identity map: when the same row appears multiple times the last one wins; compared with the original value on commit
      const loaded = new Map<number, AdvancedTableRow | null>()
      const finalSort = new Map<number, number>()
      for (const item of items) {
        if (!isPlainObject(item)) throw new Error(`'${typeof item}' object has no attribute 'get'`)
        const rowId = parseIntOr(item.id, 0)
        const sortOrder = normalizeSortOrder(item.sort_order, 0)
        if (!rowId) continue
        if (!loaded.has(rowId)) loaded.set(rowId, await repo.get(rowId))
        if (loaded.get(rowId)) finalSort.set(rowId, sortOrder)
      }
      for (const [id, sortOrder] of finalSort) {
        if (loaded.get(id)!.sort_order !== sortOrder) await repo.update(id, { sort_order: sortOrder })
      }
      return { message: '排序已保存' }
    })
  }

  async batchUpdate(data: Data) {
    const ids = pyTruthy(data.ids) ? data.ids : []
    if (!Array.isArray(ids) || ids.length === 0) throw new ServiceError('请先选择要操作的数据')

    const items = await this.repo.listByIds(ids)
    if (items.length === 0) throw new ServiceError('未找到可更新的数据')

    await this.inTx(async (repo) => {
      for (const item of items) {
        const patch: AdvancedTableRowPatch = {}
        if (hasKey(data, 'status')) patch.status = normalizeStatus(data.status, item.status)
        if (hasKey(data, 'owner')) patch.owner = strOrNull(data.owner)
        if (hasKey(data, 'is_active')) patch.is_active = parseBool(data.is_active, item.is_active)
        if (hasKey(data, 'is_pinned')) patch.is_pinned = parseBool(data.is_pinned, item.is_pinned)
        if (hasKey(data, 'priority')) patch.priority = parseIntOr(data.priority, item.priority || 0)
        const changed = changedFields(item, patch)
        if (Object.keys(changed).length > 0) await repo.update(item.id, changed)
      }
    })
    return { message: `已更新 ${items.length} 条记录` }
  }

  async batchDelete(data: Data) {
    const ids = pyTruthy(data.ids) ? data.ids : []
    if (!Array.isArray(ids) || ids.length === 0) throw new ServiceError('请先选择要删除的数据')

    const items = await this.repo.listByIds(ids)
    if (items.length === 0) throw new ServiceError('未找到可删除的数据')

    await this.inTx(async (repo) => {
      for (const item of items) await repo.delete(item.id)
    })
    return { message: `已删除 ${items.length} 条记录` }
  }
}
