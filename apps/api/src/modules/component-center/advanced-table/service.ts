/**
 * Advanced table page service layer
 */

import type { z } from 'zod'
import { writeError } from '@/common/db-errors'
import { ServiceError } from '@/common/errors'
import { notFound } from '@/common/http'
import { changedFields } from '@/common/validation'
import type { Db, Executor } from '@/db/client'
import { advancedTableRowToDict, type AdvancedTableRow } from '@/db/schema'
import { AdvancedTableRepository, type AdvancedTableRowPatch, type ListFilters } from './repository'
import type { batchDeleteBody, batchUpdateBody, reorderItem, RowInput } from './schema'

/** Progress is a percentage: out-of-range values are clamped to 0–100 */
const clampProgress = (progress: number) => Math.max(0, Math.min(100, progress))

/** Column values from parsed input: progress clamped, score written as numeric text */
function columns(values: Partial<RowInput>): AdvancedTableRowPatch {
  const { score, progress, ...rest } = values
  return {
    ...rest,
    ...(progress !== undefined ? { progress: clampProgress(progress) } : {}),
    ...(score !== undefined ? { score: String(score) } : {}),
  }
}

/** Changed columns; score compares by value (the column holds numeric text such as '4.50') */
function changes(row: AdvancedTableRow, patch: AdvancedTableRowPatch): AdvancedTableRowPatch {
  const { score, ...rest } = patch
  const changed: AdvancedTableRowPatch = changedFields(row, rest as Partial<AdvancedTableRow>)
  if (score !== undefined && Number(score) !== Number(row.score)) changed.score = score
  return changed
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
      avg_progress: Number(s.avgRow.progress ?? 0),
      avg_score: Number(s.avgRow.score ?? 0),
      category_stats: s.categoryRows.map((r) => ({ category: r.category || 'general', count: r.n })),
    }
  }

  async createItem(values: RowInput) {
    if (await this.repo.getByCode(values.row_code)) throw new ServiceError('编码已存在')
    return advancedTableRowToDict(await this.repo.insert({ ...columns(values), name: values.name, row_code: values.row_code }))
  }

  async updateItem(item: AdvancedTableRow, values: Partial<RowInput>) {
    if (values.row_code !== undefined && (await this.repo.getDuplicateCode(values.row_code, item.id))) {
      throw new ServiceError('编码已存在')
    }
    const changed = changes(item, columns(values))
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
      throw writeError(err)
    }
  }

  /** Save the rows' positions; a row listed more than once keeps its last entry, unknown ids are skipped */
  async reorderRows(items: z.output<typeof reorderItem>[]) {
    return this.inTx(async (repo) => {
      const finalSort = new Map<number, number>()
      for (const item of items) if (item.id !== null) finalSort.set(item.id, item.sort_order)
      for (const [id, sortOrder] of finalSort) {
        const row = await repo.get(id)
        if (row && row.sort_order !== sortOrder) await repo.update(id, { sort_order: sortOrder })
      }
      return { message: '排序已保存' }
    })
  }

  async batchUpdate({ ids = [], ...values }: Partial<z.output<typeof batchUpdateBody>>) {
    if (ids.length === 0) throw new ServiceError('请先选择要操作的数据')
    const items = await this.repo.listByIds(ids)
    if (items.length === 0) throw new ServiceError('未找到可更新的数据')

    await this.inTx(async (repo) => {
      for (const item of items) {
        const changed = changes(item, columns(values))
        if (Object.keys(changed).length > 0) await repo.update(item.id, changed)
      }
    })
    return { message: `已更新 ${items.length} 条记录` }
  }

  async batchDelete({ ids }: z.output<typeof batchDeleteBody>) {
    if (ids.length === 0) throw new ServiceError('请先选择要删除的数据')
    const items = await this.repo.listByIds(ids)
    if (items.length === 0) throw new ServiceError('未找到可删除的数据')

    await this.inTx(async (repo) => {
      for (const item of items) await repo.delete(item.id)
    })
    return { message: `已删除 ${items.length} 条记录` }
  }
}
