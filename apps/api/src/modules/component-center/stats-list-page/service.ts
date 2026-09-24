/**
 * 带统计的列表页 service 层（对齐 AuraStack backend/app/component_center/service/stats_list_page.py）
 *
 * 与 SQLAlchemy 行为对齐的要点：
 * - 更新只写真正变化的列；没有变化时不发 UPDATE，updated_at 保持不变（onupdate 语义）
 * - 导入沿用 Session autoflush 时机：上一行的写入在下一行 get_by_code 查询前才落库，最后一行在提交时落库；
 *   有错误行时直接回滚，未落库的写入不会触发数据库错误
 */

import { ServiceError } from '@/common/errors'
import { notFound } from '@/common/http'
import { isPlainObject, pyStr, pyStrOrEmpty, pyTruthy } from '@/common/py'
import { buildTable, normalizeTableFileType, readTableFile, TableFileError, type UploadedFile } from '@/common/tabular'
import type { Db } from '@/db/client'
import { numericToFloat, statsItemToDict, type StatsItem } from '@/db/schema'
import { StatsListPageRepository, type StatsItemUpdate, type StatsListFilters } from './repository'
import {
  buildErrorRow,
  EXPORT_FIELD_MAP,
  floatEqualsNumeric,
  floatToNumericParam,
  IMPORT_HEADER_MAP,
  isExportField,
  parseBool,
  parseFloat,
  parseInt,
  pyIterate,
  pyRound2,
  resolveIdList,
  STATUS_VALUES,
  TEMPLATE_HEADERS,
  TEMPLATE_ROWS,
  type ErrorRow,
} from './schema'

type Data = Record<string, unknown>

/** 可写列的规范化值（amount 为 Python float，写库时转 numeric 文本） */
interface ItemValues {
  name?: string
  item_code?: string
  category?: string
  status?: string
  amount?: number
  quantity?: number
  owner?: string | null
  priority?: number
  is_active?: boolean | null
  description?: string | null
}

function has(data: Data, key: string): boolean {
  return Object.hasOwn(data, key)
}

/** `str(x or '').strip() or None` */
function strOrNone(value: unknown): string | null {
  return pyStrOrEmpty(value) || null
}

/** `str(x or 'general').strip() or 'general'` / `str(x or '').strip() or 'general'`（二者结果相同） */
function categoryOf(value: unknown): string {
  return pyStrOrEmpty(value) || 'general'
}

/** 只保留与当前行不同的列（SQLAlchemy 属性历史：值相等则不算变更） */
function changedValues(item: StatsItem, next: ItemValues): StatsItemUpdate {
  const changes: StatsItemUpdate = {}
  for (const [key, value] of Object.entries(next) as [keyof ItemValues, unknown][]) {
    if (value === undefined) continue
    if (key === 'amount') {
      if (!floatEqualsNumeric(value as number, item.amount)) changes.amount = floatToNumericParam(value as number)
      continue
    }
    if (item[key] !== value) (changes as Record<string, unknown>)[key] = value
  }
  return changes
}

export class StatsListPageService {
  private readonly repo: StatsListPageRepository

  constructor(private readonly db: Db) {
    this.repo = new StatsListPageRepository(db)
  }

  static normalizeStatus(value: unknown, fallback = 'draft'): string {
    if (value === null || value === undefined) return fallback
    const raw = pyStr(value).trim().toLowerCase()
    if (!raw) return fallback
    if (!STATUS_VALUES.has(raw)) throw new ServiceError('状态仅支持 draft/published/archived', 400)
    return raw
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
      avg_amount: pyRound2(avgAmount),
      category_stats: categoryRows.map((row) => ({
        category: row.category || 'general',
        count: row.count,
        amount: numericToFloat(row.sum),
      })),
    }
  }

  async createItem(data: Data): Promise<[ReturnType<typeof statsItemToDict>, number]> {
    const name = pyStrOrEmpty(data.name)
    const itemCode = pyStrOrEmpty(data.item_code)
    if (!name) throw new ServiceError('名称不能为空', 400)
    if (!itemCode) throw new ServiceError('编码不能为空', 400)
    if (await this.repo.getByCode(itemCode)) throw new ServiceError('编码已存在', 400)

    const status = StatsListPageService.normalizeStatus(data.status, 'draft')
    const item = await this.repo.insert({
      name,
      item_code: itemCode,
      category: categoryOf(data.category),
      status,
      amount: floatToNumericParam(parseFloat(data.amount, 0)),
      quantity: parseInt(data.quantity, 0),
      owner: strOrNone(data.owner),
      priority: parseInt(data.priority, 0),
      is_active: parseBool(data.is_active, true),
      description: strOrNone(data.description),
    })
    return [statsItemToDict(item), 201]
  }

  async updateItem(item: StatsItem, data: Data) {
    if (has(data, 'name') && !pyStrOrEmpty(data.name)) throw new ServiceError('名称不能为空', 400)

    if (has(data, 'item_code')) {
      const nextCode = pyStrOrEmpty(data.item_code)
      if (!nextCode) throw new ServiceError('编码不能为空', 400)
      if (await this.repo.existsOtherWithCode(nextCode, item.id)) throw new ServiceError('编码已存在', 400)
    }

    const next: ItemValues = {}
    if (has(data, 'name')) next.name = pyStrOrEmpty(data.name)
    if (has(data, 'item_code')) next.item_code = pyStrOrEmpty(data.item_code)
    if (has(data, 'category')) next.category = categoryOf(data.category)
    if (has(data, 'owner')) next.owner = strOrNone(data.owner)
    if (has(data, 'priority')) next.priority = parseInt(data.priority, item.priority || 0)
    if (has(data, 'is_active')) next.is_active = parseBool(data.is_active, item.is_active)
    if (has(data, 'description')) next.description = strOrNone(data.description)
    if (has(data, 'amount')) next.amount = parseFloat(data.amount, item.amount !== null ? Number(item.amount) : 0)
    if (has(data, 'quantity')) next.quantity = parseInt(data.quantity, item.quantity || 0)
    if (has(data, 'status')) next.status = StatsListPageService.normalizeStatus(data.status, item.status || 'draft')

    const changes = changedValues(item, next)
    if (Object.keys(changes).length === 0) return statsItemToDict(item)
    await this.repo.update(item.id, changes)
    return statsItemToDict((await this.repo.getById(item.id))!)
  }

  async deleteItem(item: StatsItem) {
    await this.repo.delete(item.id)
    return { message: '删除成功' }
  }

  /** method=GET 时 data 为 query 参数（每个键取第一个值），否则为 JSON 体 */
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

    let items: StatsItem[]
    if (exportMode === 'filtered') {
      // Python: filters.get(...)；非 dict（如 list/str）没有 .get → AttributeError → 500
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
    return buildTable(headers, rows, 'stats_list_page_export', fileType)
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

    return this.db.transaction(async (tx) => {
      const repo = new StatsListPageRepository(tx)
      let created = 0
      let updated = 0
      const errors: ErrorRow[] = []
      // 尚未 flush 的上一行写入（对应 Session 里的 pending/dirty 对象）
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

        const name = pyStrOrEmpty(mapped.name)
        const itemCode = pyStrOrEmpty(mapped.item_code)
        if (!name || !itemCode) {
          errors.push(buildErrorRow(line, '名称和编码不能为空', row))
          continue
        }

        const values = {
          name,
          category: categoryOf(mapped.category),
          status: StatsListPageService.normalizeStatus(mapped.status, 'draft'),
          amount: parseFloat(mapped.amount, 0),
          quantity: parseInt(mapped.quantity, 0),
          owner: strOrNone(mapped.owner),
          priority: parseInt(mapped.priority, 0),
          is_active: parseBool(mapped.is_active, true),
          description: strOrNone(mapped.description),
        }

        await flush() // Query 触发 autoflush
        const existing = await repo.getByCode(itemCode)
        if (existing) {
          const changes = changedValues(existing, values)
          if (Object.keys(changes).length > 0) pending = () => repo.update(existing.id, changes)
          updated += 1
        } else {
          pending = () => repo.insert({ ...values, item_code: itemCode, amount: floatToNumericParam(values.amount) })
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
