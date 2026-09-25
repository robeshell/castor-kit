/**
 * Card list page service layer
 *
 * Write behavior notes:
 * - Updates write only columns that actually changed; with no changes no UPDATE is sent and updated_at stays the same (onupdate semantics)
 * - Import persistence timing: a row's write is persisted to the DB only right before the next row's get_by_code query, and the last row on commit;
 *   if any row has errors everything is rolled back, so unpersisted writes never trigger DB errors
 */

import { ServiceError } from '@/common/errors'
import { notFound } from '@/common/http'
import { isPlainObject, pyStr, pyStrOrEmpty, pyTruthy } from '@/common/py'
import { buildTable, normalizeTableFileType, readTableFile, TableFileError, type UploadedFile } from '@/common/tabular'
import type { Db } from '@/db/client'
import { cardItemToDict, type CardItem } from '@/db/schema'
import { CardListPageRepository, type CardItemUpdate, type CardListFilters } from './repository'
import {
  buildErrorRow,
  EXPORT_FIELD_MAP,
  IMPORT_HEADER_MAP,
  isExportField,
  parseBool,
  parseInt,
  pyIterate,
  resolveIdList,
  STATUS_VALUES,
  TEMPLATE_HEADERS,
  TEMPLATE_ROWS,
  type ErrorRow,
} from './schema'

type Data = Record<string, unknown>

function has(data: Data, key: string): boolean {
  return Object.hasOwn(data, key)
}

/** `str(x or '').strip() or None` */
function strOrNone(value: unknown): string | null {
  return pyStrOrEmpty(value) || null
}

/** `str(x or 'general').strip() or 'general'` / `str(x or '').strip() or 'general'` (both yield the same result) */
function categoryOf(value: unknown): string {
  return pyStrOrEmpty(value) || 'general'
}

/** Keep only columns that differ from the current row (equal values don't count as changes) */
function changedValues(item: CardItem, next: CardItemUpdate): CardItemUpdate {
  const changes: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(next)) {
    if (value === undefined) continue
    if ((item as Record<string, unknown>)[key] !== value) changes[key] = value
  }
  return changes as CardItemUpdate
}

export class CardListPageService {
  private readonly repo: CardListPageRepository

  constructor(private readonly db: Db) {
    this.repo = new CardListPageRepository(db)
  }

  static normalizeStatus(value: unknown, fallback = 'draft'): string {
    if (value === null || value === undefined) return fallback
    const raw = pyStr(value).trim().toLowerCase()
    if (!raw) return fallback
    if (!STATUS_VALUES.has(raw)) throw new ServiceError('状态仅支持 draft/published/archived', 400)
    return raw
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

  async createItem(data: Data): Promise<[ReturnType<typeof cardItemToDict>, number]> {
    const title = pyStrOrEmpty(data.title)
    const cardCode = pyStrOrEmpty(data.card_code)
    if (!title) throw new ServiceError('标题不能为空', 400)
    if (!cardCode) throw new ServiceError('编码不能为空', 400)
    if (await this.repo.getByCode(cardCode)) throw new ServiceError('编码已存在', 400)

    const status = CardListPageService.normalizeStatus(data.status, 'draft')
    const item = await this.repo.insert({
      title,
      card_code: cardCode,
      subtitle: strOrNone(data.subtitle),
      category: categoryOf(data.category),
      cover_url: strOrNone(data.cover_url),
      tag: strOrNone(data.tag),
      status,
      owner: strOrNone(data.owner),
      priority: parseInt(data.priority, 0),
      is_active: parseBool(data.is_active, true),
      description: strOrNone(data.description),
    })
    return [cardItemToDict(item), 201]
  }

  async updateItem(item: CardItem, data: Data) {
    if (has(data, 'title') && !pyStrOrEmpty(data.title)) throw new ServiceError('标题不能为空', 400)

    if (has(data, 'card_code')) {
      const nextCode = pyStrOrEmpty(data.card_code)
      if (!nextCode) throw new ServiceError('编码不能为空', 400)
      if (await this.repo.existsOtherWithCode(nextCode, item.id)) throw new ServiceError('编码已存在', 400)
    }

    const next: CardItemUpdate = {}
    if (has(data, 'title')) next.title = pyStrOrEmpty(data.title)
    if (has(data, 'card_code')) next.card_code = pyStrOrEmpty(data.card_code)
    if (has(data, 'subtitle')) next.subtitle = strOrNone(data.subtitle)
    if (has(data, 'category')) next.category = categoryOf(data.category)
    if (has(data, 'cover_url')) next.cover_url = strOrNone(data.cover_url)
    if (has(data, 'tag')) next.tag = strOrNone(data.tag)
    if (has(data, 'owner')) next.owner = strOrNone(data.owner)
    if (has(data, 'priority')) next.priority = parseInt(data.priority, item.priority || 0)
    if (has(data, 'is_active')) next.is_active = parseBool(data.is_active, item.is_active)
    if (has(data, 'description')) next.description = strOrNone(data.description)
    if (has(data, 'status')) next.status = CardListPageService.normalizeStatus(data.status, item.status || 'draft')

    const changes = changedValues(item, next)
    if (Object.keys(changes).length === 0) return cardItemToDict(item)
    await this.repo.update(item.id, changes)
    return cardItemToDict((await this.repo.getById(item.id))!)
  }

  async deleteItem(item: CardItem) {
    await this.repo.delete(item.id)
    return { message: '删除成功' }
  }

  /** For method=GET, data is the query params (first value of each key); otherwise the JSON body */
  async exportItems(data: Data, requestMethod: string) {
    let ids: unknown
    let fields: unknown[]
    let exportMode: string
    let filters: unknown
    if (requestMethod === 'GET') {
      ids = []
      const fieldsRaw = pyStrOrEmpty(data.fields)
      fields = fieldsRaw ? fieldsRaw.split(',').map((f) => f.trim()).filter(Boolean) : []
      exportMode = 'filtered'
      filters = {
        search: data.search,
        category: data.category,
        owner: data.owner,
        is_active: data.is_active,
        status: data.status,
      }
    } else {
      ids = pyTruthy(data.ids) ? data.ids : []
      fields = pyTruthy(data.fields) ? pyIterate(data.fields) : []
      exportMode = pyTruthy(data.export_mode) ? pyStr(data.export_mode).trim() : 'selected'
      filters = pyTruthy(data.filters) ? data.filters : {}
    }
    const fileType = normalizeTableFileType(data.file_type)

    let validFields = fields.filter(isExportField)
    if (validFields.length === 0) validFields = Object.keys(EXPORT_FIELD_MAP)

    let items: CardItem[]
    if (exportMode === 'filtered') {
      // Return 500 when filters is not an object (e.g. list/str)
      if (!isPlainObject(filters)) throw new ServiceError("'filters' object has no attribute 'get'", 500)
      items = await this.repo.listAllOrdered({
        search: pyStrOrEmpty(filters.search),
        category: pyStrOrEmpty(filters.category),
        owner: pyStrOrEmpty(filters.owner),
        isActive: parseBool(filters.is_active, null),
        status: pyStrOrEmpty(filters.status),
      })
    } else {
      if (!Array.isArray(ids) || ids.length === 0) throw new ServiceError('请先勾选要导出的数据', 400)
      items = await this.repo.listByIdsOrdered(resolveIdList(ids))
    }

    const headers = validFields.map((f) => EXPORT_FIELD_MAP[f]![0])
    const rows = items.map((item) => validFields.map((f) => EXPORT_FIELD_MAP[f]![1](item)))
    return buildTable(headers, rows, 'card_list_page_export', fileType)
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

    return this.db.transaction(async (tx) => {
      const repo = new CardListPageRepository(tx)
      let created = 0
      let updated = 0
      const errors: ErrorRow[] = []
      // Previous row's write not yet flushed (the pending/dirty objects in the Session)
      let pending: (() => Promise<unknown>) | null = null
      const flush = async () => {
        if (!pending) return
        const op = pending
        pending = null
        await op()
      }

      for (const [line, row] of table.rows) {
        const mapped: Record<string, string> = {}
        for (const [key, value] of Object.entries(row)) {
          const field = headerMap.get(key)
          if (field) mapped[field] = value
        }

        const title = pyStrOrEmpty(mapped.title)
        const cardCode = pyStrOrEmpty(mapped.card_code)
        if (!title || !cardCode) {
          errors.push(buildErrorRow(line, '标题和编码不能为空', row))
          continue
        }

        const category = categoryOf(mapped.category)
        const status = CardListPageService.normalizeStatus(mapped.status, 'draft')
        const values = {
          title,
          subtitle: strOrNone(mapped.subtitle),
          category,
          tag: strOrNone(mapped.tag),
          status,
          owner: strOrNone(mapped.owner),
          priority: parseInt(mapped.priority, 0),
          is_active: parseBool(mapped.is_active, true),
          description: strOrNone(mapped.description),
        }

        await flush() // Query triggers autoflush
        const existing = await repo.getByCode(cardCode)
        if (existing) {
          const changes = changedValues(existing, values)
          if (Object.keys(changes).length > 0) pending = () => repo.update(existing.id, changes)
          updated += 1
        } else {
          pending = () => repo.insert({ ...values, card_code: cardCode })
          created += 1
        }
      }

      if (errors.length > 0) {
        throw new ServiceError('导入失败，存在错误数据', 400, {
          error_rows: errors.slice(0, 500),
          error_count: errors.length,
        })
      }
      await flush()
      return { message: '导入成功', created, updated }
    })
  }
}
