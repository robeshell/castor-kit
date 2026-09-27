/**
 * List page with stats service layer
 *
 * Updates write only the columns that change; with no change no UPDATE is sent and updated_at stays.
 */

import type { z } from 'zod'
import { writeError } from '@/common/db-errors'
import { ServiceError } from '@/common/errors'
import { notFound } from '@/common/http'
import { buildTable, normalizeTableFileType, readTableFile, TableFileError, type UploadedFile } from '@/common/tabular'
import { changedFields, exportColumns, parseIntText, parseNumberText, parseYesNo } from '@/common/validation'
import type { Db } from '@/db/client'
import { numericToFloat, statsItemToDict, type StatsItem } from '@/db/schema'
import { StatsListPageRepository, type StatsItemUpdate, type StatsListFilters } from './repository'
import {
  buildErrorRow,
  EXPORT_FIELD_MAP,
  IMPORT_HEADER_MAP,
  STATS_STATUSES,
  STATUS_ERROR,
  TEMPLATE_HEADERS,
  TEMPLATE_ROWS,
  type ErrorRow,
  type statsExportBody,
  type StatsItemInput,
} from './schema'

/** An import cell: trimmed, blank → null */
const cell = (value: string | undefined) => (value ?? '').trim() || null

/** Column values from parsed input: amount is numeric (written as text), a blank category is 'general' */
function columns(values: Partial<StatsItemInput>): StatsItemUpdate {
  const { amount, category, ...rest } = values
  return {
    ...rest,
    ...(amount !== undefined ? { amount: String(amount) } : {}),
    ...(category !== undefined ? { category: category ?? 'general' } : {}),
  }
}

/** Changed columns; amount compares by value (the column holds numeric text such as '12.50') */
function changes(item: StatsItem, values: StatsItemUpdate): StatsItemUpdate {
  const { amount, ...rest } = values
  const changed: StatsItemUpdate = changedFields(item, rest)
  if (amount !== undefined && Number(amount) !== Number(item.amount)) changed.amount = amount
  return changed
}

export class StatsListPageService {
  private readonly repo: StatsListPageRepository

  constructor(private readonly db: Db) {
    this.repo = new StatsListPageRepository(db)
  }

  async getItemOr404(id: number): Promise<StatsItem> {
    const item = await this.repo.getById(id)
    if (!item) throw notFound()
    return item
  }

  toDict(item: StatsItem) {
    return statsItemToDict(item)
  }

  async listItems(page: number, perPage: number, filters: StatsListFilters) {
    const { total, items } = await this.repo.listPage(page, perPage, filters)
    return { items: items.map(statsItemToDict), total, page, per_page: perPage }
  }

  async getStats() {
    const { counts, categoryRows } = await this.repo.aggregate()
    const total = counts.total
    const active = counts.active
    const totalAmount = counts.sum === null ? 0 : Number(counts.sum)
    const avgAmount = counts.avg === null ? 0 : Number(counts.avg)
    return {
      total,
      active_count: active,
      inactive_count: total - active,
      published_count: counts.published,
      draft_count: counts.draft,
      archived_count: counts.archived,
      total_amount: totalAmount,
      avg_amount: avgAmount,
      category_stats: categoryRows.map((row) => ({
        category: row.category || 'general',
        count: row.count,
        amount: numericToFloat(row.sum),
      })),
    }
  }

  async createItem(values: StatsItemInput): Promise<[ReturnType<typeof statsItemToDict>, number]> {
    if (await this.repo.getByCode(values.item_code)) throw new ServiceError('编码已存在', 400)
    const item = await this.repo.insert({ ...columns(values), name: values.name, item_code: values.item_code })
    return [statsItemToDict(item), 201]
  }

  async updateItem(item: StatsItem, values: Partial<StatsItemInput>) {
    if (values.item_code !== undefined && (await this.repo.existsOtherWithCode(values.item_code, item.id))) {
      throw new ServiceError('编码已存在', 400)
    }
    const changed = changes(item, columns(values))
    if (Object.keys(changed).length === 0) return statsItemToDict(item)
    await this.repo.update(item.id, changed)
    return statsItemToDict((await this.repo.getById(item.id))!)
  }

  async deleteItem(item: StatsItem) {
    await this.repo.delete(item.id)
    return { message: '删除成功' }
  }

  async exportItems(options: z.output<typeof statsExportBody>) {
    const validFields = exportColumns(options.fields, EXPORT_FIELD_MAP)

    let items: StatsItem[]
    if (options.export_mode !== 'selected') {
      const { search, category, owner, is_active: isActive, status } = options.filters
      items = await this.repo.listAllOrdered({
        search: search ?? '',
        category: category ?? '',
        owner: owner ?? '',
        isActive: parseYesNo(isActive),
        status: status ?? '',
      })
    } else {
      if (options.ids.length === 0) throw new ServiceError('请先勾选要导出的数据', 400)
      items = await this.repo.listByIdsOrdered(options.ids)
    }

    const headers = validFields.map((f) => EXPORT_FIELD_MAP[f]![0])
    const rows = items.map((item) => validFields.map((f) => EXPORT_FIELD_MAP[f]![1](item)))
    return buildTable(headers, rows, 'stats_list_page_export', normalizeTableFileType(options.file_type))
  }

  async downloadTemplate(fileTypeRaw: unknown) {
    return buildTable(TEMPLATE_HEADERS, TEMPLATE_ROWS, 'stats_list_page_import_template', normalizeTableFileType(fileTypeRaw))
  }

  async importItems(file: UploadedFile | null) {
    if (!file) throw new ServiceError('请上传导入文件', 400)
    let table
    try {
      table = await readTableFile(file)
    } catch (err) {
      if (err instanceof TableFileError) throw new ServiceError(err.message, 400)
      throw err
    }
    if (table.fieldnames.length === 0) throw new ServiceError('导入内容为空', 400)

    const headerMap = new Map<string, string>()
    for (const header of table.fieldnames) {
      const key = (header ?? '').trim()
      if (Object.hasOwn(IMPORT_HEADER_MAP, key)) headerMap.set(header, IMPORT_HEADER_MAP[key]!)
    }
    const mappedFields = new Set(headerMap.values())
    if (!mappedFields.has('name') || !mappedFields.has('item_code')) {
      throw new ServiceError('导入文件缺少"名称/编码"列', 400)
    }

    try {
      return await this.db.transaction(async (tx) => {
        const repo = new StatsListPageRepository(tx)
        let created = 0
        let updated = 0
        const errors: ErrorRow[] = []

        for (const [line, row] of table.rows) {
          const mapped: Record<string, string> = {}
          for (const [key, value] of Object.entries(row)) {
            const field = headerMap.get(key)
            if (field) mapped[field] = value
          }

          const name = cell(mapped.name)
          const itemCode = cell(mapped.item_code)
          if (!name || !itemCode) {
            errors.push(buildErrorRow(line, '名称和编码不能为空', row))
            continue
          }
          const status = (cell(mapped.status) ?? 'draft').toLowerCase()
          if (!(STATS_STATUSES as readonly string[]).includes(status)) {
            errors.push(buildErrorRow(line, STATUS_ERROR, row))
            continue
          }
          // Rows with errors are only collected: the transaction is rolled back below, so nothing written stays
          if (errors.length > 0) continue

          const values = columns({
            name,
            category: cell(mapped.category),
            status: status as StatsItemInput['status'],
            amount: parseNumberText(mapped.amount, 0),
            quantity: parseIntText(mapped.quantity, 0),
            owner: cell(mapped.owner),
            priority: parseIntText(mapped.priority, 0),
            is_active: parseYesNo(mapped.is_active, true)!,
            description: cell(mapped.description),
          })
          const existing = await repo.getByCode(itemCode)
          if (existing) {
            const changed = changes(existing, values)
            if (Object.keys(changed).length > 0) await repo.update(existing.id, changed)
            updated += 1
          } else {
            await repo.insert({ ...values, name, item_code: itemCode })
            created += 1
          }
        }

        if (errors.length > 0) {
          throw new ServiceError('导入失败，存在错误数据', 400, {
            error_rows: errors.slice(0, 500),
            error_count: errors.length,
          })
        }
        return { message: '导入成功', created, updated }
      })
    } catch (err) {
      throw writeError(err)
    }
  }
}
