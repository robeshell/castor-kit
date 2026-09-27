/**
 * Card list page service layer
 *
 * Updates write only the columns that change; with no change no UPDATE is sent and updated_at stays.
 */

import type { z } from 'zod'
import { writeError } from '@/common/db-errors'
import { ServiceError } from '@/common/errors'
import { notFound } from '@/common/http'
import { buildTable, normalizeTableFileType, readTableFile, TableFileError, type UploadedFile } from '@/common/tabular'
import { changedFields, exportColumns, parseIntText, parseYesNo } from '@/common/validation'
import type { Db } from '@/db/client'
import { cardItemToDict, type CardItem } from '@/db/schema'
import { CardListPageRepository, type CardListFilters } from './repository'
import {
  buildErrorRow,
  CARD_STATUSES,
  EXPORT_FIELD_MAP,
  IMPORT_HEADER_MAP,
  STATUS_ERROR,
  TEMPLATE_HEADERS,
  TEMPLATE_ROWS,
  type cardExportBody,
  type CardItemInput,
  type ErrorRow,
} from './schema'

/** An import cell: trimmed, blank → null */
const cell = (value: string | undefined) => (value ?? '').trim() || null

export class CardListPageService {
  private readonly repo: CardListPageRepository

  constructor(private readonly db: Db) {
    this.repo = new CardListPageRepository(db)
  }

  async getItemOr404(id: number): Promise<CardItem> {
    const item = await this.repo.getById(id)
    if (!item) throw notFound()
    return item
  }

  toDict(item: CardItem) {
    return cardItemToDict(item)
  }

  async listItems(page: number, perPage: number, filters: CardListFilters) {
    const { total, items } = await this.repo.listPage(page, perPage, filters)
    return { items: items.map(cardItemToDict), total, page, per_page: perPage }
  }

  async createItem(values: CardItemInput): Promise<[ReturnType<typeof cardItemToDict>, number]> {
    if (await this.repo.getByCode(values.card_code)) throw new ServiceError('编码已存在', 400)
    const item = await this.repo.insert({ ...values, category: values.category ?? 'general' })
    return [cardItemToDict(item), 201]
  }

  async updateItem(item: CardItem, values: Partial<CardItemInput>) {
    if (values.card_code !== undefined && (await this.repo.existsOtherWithCode(values.card_code, item.id))) {
      throw new ServiceError('编码已存在', 400)
    }
    const next = values.category === null ? { ...values, category: 'general' } : values
    const changes = changedFields(item, next)
    if (Object.keys(changes).length === 0) return cardItemToDict(item)
    await this.repo.update(item.id, changes)
    return cardItemToDict((await this.repo.getById(item.id))!)
  }

  async deleteItem(item: CardItem) {
    await this.repo.delete(item.id)
    return { message: '删除成功' }
  }

  async exportItems(options: z.output<typeof cardExportBody>) {
    const validFields = exportColumns(options.fields, EXPORT_FIELD_MAP)

    let items: CardItem[]
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
    return buildTable(headers, rows, 'card_list_page_export', normalizeTableFileType(options.file_type))
  }

  async downloadTemplate(fileTypeRaw: unknown) {
    return buildTable(TEMPLATE_HEADERS, TEMPLATE_ROWS, 'card_list_page_import_template', normalizeTableFileType(fileTypeRaw))
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
    if (!mappedFields.has('title') || !mappedFields.has('card_code')) {
      throw new ServiceError('导入文件缺少"标题/编码"列', 400)
    }

    try {
      return await this.db.transaction(async (tx) => {
        const repo = new CardListPageRepository(tx)
        let created = 0
        let updated = 0
        const errors: ErrorRow[] = []

        for (const [line, row] of table.rows) {
          const mapped: Record<string, string> = {}
          for (const [key, value] of Object.entries(row)) {
            const field = headerMap.get(key)
            if (field) mapped[field] = value
          }

          const title = cell(mapped.title)
          const cardCode = cell(mapped.card_code)
          if (!title || !cardCode) {
            errors.push(buildErrorRow(line, '标题和编码不能为空', row))
            continue
          }
          const status = (cell(mapped.status) ?? 'draft').toLowerCase()
          if (!(CARD_STATUSES as readonly string[]).includes(status)) {
            errors.push(buildErrorRow(line, STATUS_ERROR, row))
            continue
          }
          // Rows with errors are only collected: the transaction is rolled back below, so nothing written stays
          if (errors.length > 0) continue

          const values = {
            title,
            subtitle: cell(mapped.subtitle),
            category: cell(mapped.category) ?? 'general',
            tag: cell(mapped.tag),
            status,
            owner: cell(mapped.owner),
            priority: parseIntText(mapped.priority, 0),
            is_active: parseYesNo(mapped.is_active, true)!,
            description: cell(mapped.description),
          }
          const existing = await repo.getByCode(cardCode)
          if (existing) {
            const changes = changedFields(existing, values)
            if (Object.keys(changes).length > 0) await repo.update(existing.id, changes)
            updated += 1
          } else {
            await repo.insert({ ...values, card_code: cardCode })
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
