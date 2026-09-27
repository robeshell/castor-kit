/**
 * List page (query management) service layer
 *
 * - JSON settings are stored as JSON text in Text columns
 * - Each write (including the version snapshot) runs in one transaction
 * - Images / attachments are uploaded to the file center; the rows keep their URLs as JSON lists
 */

import type { z } from 'zod'
import { writeError } from '@/common/db-errors'
import { ServiceError } from '@/common/errors'
import { notFound } from '@/common/http'
import { utcNowIso } from '@/common/serialize'
import { buildTable, normalizeTableFileType, readTableFile, TableFileError, type UploadedFile } from '@/common/tabular'
import { exportColumns, parseIntText, parseYesNo } from '@/common/validation'
import type { Db } from '@/db/client'
import {
  savedQueryToDict,
  savedQueryVersionToDict,
  type SavedQuery,
  type SavedQueryVersion,
} from '@/db/schema'
import { utcNow } from '@/db/schema/columns'
import { ListPageRepository, type ListPageFilters, type SavedQueryUpdate } from './repository'
import type { saved_queries } from '@/db/schema'

type NewSavedQuery = typeof saved_queries.$inferInsert
import {
  buildErrorRow,
  EXPORT_FIELD_MAP,
  IMPORT_HEADER_MAP,
  LIST_STATUSES,
  listPageBody,
  parseUrlCell,
  STATUS_ERROR,
  titleCase,
  type ErrorRow,
  type listPageExportBody,
  type ListPageInput,
  type previewBody,
} from './schema'

const EMPTY_CONDITIONS = () => ({ groups: [], items: [] })

/** An import cell: trimmed, blank → null */
const cell = (value: string | undefined) => (value ?? '').trim() || null

function urlList(urls: string[]): string | null {
  return urls.length > 0 ? JSON.stringify(urls) : null
}

/** List filters from query-string text */
export function listFilters(source: { search?: string | null; category?: string | null; owner?: string | null; is_active?: string | null; status?: string | null }): ListPageFilters {
  return {
    search: source.search?.trim() ?? '',
    category: source.category?.trim() ?? '',
    owner: source.owner?.trim() ?? '',
    isActive: parseYesNo(source.is_active),
    status: source.status?.trim() ?? '',
  }
}

/** Column values for the fields present in `values` */
function columns(values: Partial<ListPageInput>): Partial<NewSavedQuery> {
  const set: Partial<NewSavedQuery> = {}
  for (const key of ['name', 'query_code', 'keyword', 'data_source', 'owner', 'priority', 'is_active', 'status', 'condition_logic', 'description'] as const) {
    if (values[key] !== undefined) (set as Record<string, unknown>)[key] = values[key]
  }
  if (values.category !== undefined) set.category = values.category ?? 'general'
  if (values.conditions !== undefined) set.conditions_json = JSON.stringify(values.conditions)
  if (values.display_config !== undefined) set.display_config = JSON.stringify(values.display_config)
  if (values.permission_config !== undefined) set.permission_config = JSON.stringify(values.permission_config)
  if (values.schema_config !== undefined) set.schema_config = values.schema_config
  if (values.image_urls !== undefined) set.image_urls = urlList(values.image_urls)
  if (values.file_urls !== undefined) set.file_urls = urlList(values.file_urls)
  return set
}

function buildSnapshot(item: SavedQuery): string {
  const { created_at: _c, updated_at: _u, ...payload } = savedQueryToDict(item)
  return JSON.stringify(payload)
}

// ---------------------------------------------------------------- service

export class ListPageService {
  private readonly repo: ListPageRepository

  constructor(
    private readonly db: Db,
  ) {
    this.repo = new ListPageRepository(db)
  }

  private async inTx<T>(fn: (repo: ListPageRepository) => Promise<T>): Promise<T> {
    try {
      return await this.db.transaction((tx) => fn(new ListPageRepository(tx)))
    } catch (err) {
      throw writeError(err)
    }
  }

  private async saveVersionSnapshot(repo: ListPageRepository, item: SavedQuery, action: string, operator: string) {
    await repo.insertVersion({
      query_id: item.id,
      version_no: item.version || 1,
      action,
      operator,
      snapshot_json: buildSnapshot(item),
    })
  }

  // ---- CRUD

  async getOr404(id: number): Promise<SavedQuery> {
    const item = await this.repo.getById(id)
    if (!item) throw notFound()
    return item
  }

  async getVersionOr404(id: number): Promise<SavedQueryVersion> {
    const version = await this.repo.getVersionById(id)
    if (!version) throw notFound()
    return version
  }

  toDict(item: SavedQuery) {
    return savedQueryToDict(item)
  }

  async listItems(page: number, perPage: number, filters: ListPageFilters) {
    const { total, items } = await this.repo.listPage(filters, page, perPage)
    return { items: items.map(savedQueryToDict), total, page, per_page: perPage }
  }

  async createItem(values: ListPageInput) {
    if (await this.repo.getByCode(values.query_code)) throw new ServiceError('查询编码已存在', 400)
    const set = columns(values)
    const item = await this.inTx(async (repo) => {
      const created = await repo.insert({
        ...set,
        name: values.name,
        query_code: values.query_code,
        version: 1,
        published_at: values.status === 'published' ? utcNow() : null,
      })
      await this.saveVersionSnapshot(repo, created, 'create', values.operator ?? 'system')
      return created
    })
    return savedQueryToDict(item)
  }

  async updateItem(item: SavedQuery, values: Partial<ListPageInput>) {
    if (values.query_code !== undefined && (await this.repo.findDuplicateCode(values.query_code, item.id))) {
      throw new ServiceError('查询编码已存在', 400)
    }
    const set: SavedQueryUpdate = columns(values)
    if (values.status === 'published' && !item.published_at) set.published_at = utcNow()
    set.version = (item.version || 1) + 1

    const updated = await this.inTx(async (repo) => {
      const row = await repo.update(item.id, set)
      await this.saveVersionSnapshot(repo, row, 'update', values.operator ?? 'system')
      return row
    })
    return savedQueryToDict(updated)
  }

  async deleteItem(item: SavedQuery) {
    await this.inTx((repo) => repo.delete(item.id))
    return { message: '删除成功' }
  }

  // ---- Preview / versions

  runPreview({ display_config: displayConfig, conditions }: z.output<typeof previewBody>) {
    const selected = Array.isArray(displayConfig.selected_fields) ? displayConfig.selected_fields : []
    const keys = selected.filter((f): f is string => typeof f === 'string').map((f) => f.trim()).filter(Boolean)
    const fields = keys.length > 0 ? keys : ['id', 'name', 'status', 'owner', 'updated_at']
    const requestedRows = displayConfig.preview_rows
    const rowCount = Math.max(1, Math.min(Number.isInteger(requestedRows) ? (requestedRows as number) : 8, 50))
    const columns = fields.map((key) => ({ title: titleCase(key.replace(/_/g, ' ')), dataIndex: key }))

    const rows: Record<string, unknown>[] = []
    for (let index = 0; index < rowCount; index += 1) {
      const row: Record<string, unknown> = {}
      for (const col of columns) {
        const key = col.dataIndex
        if (key === 'id' || key === 'priority') row[key] = index + 1
        else if (key === 'is_active') row[key] = index % 2 === 0
        else if (key === 'updated_at' || key === 'created_at') row[key] = utcNowIso()
        else if (key === 'status') row[key] = index % 2 === 0 ? 'published' : 'draft'
        else row[key] = `${key}_sample_${index + 1}`
      }
      rows.push(row)
    }

    const conditionCount = conditions.items.length
    return {
      message: '执行成功',
      elapsed_ms: 35 + columns.length * 6 + conditionCount * 11,
      columns,
      rows,
      total: rowCount,
      condition_count: conditionCount,
    }
  }

  async listVersions(item: SavedQuery, page: number, perPage: number) {
    const { total, items } = await this.repo.listVersionsPage(item.id, page, perPage)
    return { items: items.map(savedQueryVersionToDict), total, page, per_page: perPage }
  }

  async rollbackVersion(item: SavedQuery, versionItem: SavedQueryVersion, operator: string) {
    if (versionItem.query_id !== item.id) throw new ServiceError('版本不属于当前记录', 400)

    // A snapshot is the record's dict at that version, so it reads like a request body
    let parsed: unknown = null
    try {
      parsed = JSON.parse(versionItem.snapshot_json || 'null')
    } catch {
      parsed = null
    }
    const snapshot = listPageBody.safeParse(parsed)
    if (!snapshot.success) throw new ServiceError('版本快照无效', 400)
    const values = snapshot.data
    if (await this.repo.findDuplicateCode(values.query_code, item.id)) throw new ServiceError('回滚后查询编码冲突', 400)

    const set: SavedQueryUpdate = {
      ...columns(values),
      published_at: values.status === 'published' ? utcNow() : null,
      version: (item.version || 1) + 1,
    }
    const updated = await this.inTx(async (repo) => {
      const row = await repo.update(item.id, set)
      await this.saveVersionSnapshot(repo, row, 'rollback', operator)
      return row
    })
    return savedQueryToDict(updated)
  }

  // ---- Import/export

  async exportItems(options: z.output<typeof listPageExportBody>) {
    const validFields = exportColumns(options.fields, EXPORT_FIELD_MAP)

    let items: SavedQuery[]
    if (options.export_mode !== 'selected') {
      items = await this.repo.listFiltered(listFilters(options.filters))
    } else {
      if (options.ids.length === 0) throw new ServiceError('请先勾选要导出的查询数据', 400)
      items = await this.repo.listByIds(options.ids)
    }

    const headers = validFields.map((f) => EXPORT_FIELD_MAP[f]![0])
    const rows = items.map((item) => validFields.map((f) => EXPORT_FIELD_MAP[f]![1](item)))
    return buildTable(headers, rows, 'list_page_export', normalizeTableFileType(options.file_type, 'csv'))
  }

  async downloadTemplate(fileTypeRaw: unknown) {
    const fileType = normalizeTableFileType(fileTypeRaw, 'csv')
    const headers = [
      '查询名称', '查询编码', '查询分类', '关键字', '数据源', '负责人',
      '图片URL列表', '文件URL列表', '优先级', '状态', '发布状态', '描述',
    ]
    const rows = [[
      '订单主查询',
      'order_main_query',
      'order',
      '订单,时间范围',
      'orders',
      'admin',
      'https://example.com/1.png,https://example.com/2.png',
      'https://example.com/a.pdf,https://example.com/b.xlsx',
      10,
      '启用',
      'draft',
      '查询模板示例',
    ]]
    return buildTable(headers, rows, 'list_page_import_template', fileType)
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
    if (!mappedFields.has('name') || !mappedFields.has('query_code')) {
      throw new ServiceError('导入文件缺少“查询名称/查询编码”列', 400)
    }

    return this.inTx(async (repo) => {
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
        const queryCode = cell(mapped.query_code)
        if (!name || !queryCode) {
          errors.push(buildErrorRow(line, '查询名称和查询编码不能为空', row))
          continue
        }
        const status = (cell(mapped.status) ?? 'draft').toLowerCase()
        if (!(LIST_STATUSES as readonly string[]).includes(status)) {
          errors.push(buildErrorRow(line, STATUS_ERROR, row))
          continue
        }
        // Rows with errors are only collected: the transaction is rolled back below, so nothing written stays
        if (errors.length > 0) continue

        const values = {
          name,
          category: cell(mapped.category) ?? 'general',
          keyword: cell(mapped.keyword),
          data_source: cell(mapped.data_source),
          owner: cell(mapped.owner),
          image_urls: urlList(parseUrlCell(mapped.image_urls)),
          file_urls: urlList(parseUrlCell(mapped.file_urls)),
          priority: parseIntText(mapped.priority, 0),
          is_active: parseYesNo(mapped.is_active, true)!,
          status,
          description: cell(mapped.description),
        }

        const existing = await repo.getByCode(queryCode)
        if (existing) {
          const saved = await repo.update(existing.id, {
            ...values,
            version: (existing.version || 1) + 1,
            ...(status === 'published' && !existing.published_at ? { published_at: utcNow() } : {}),
          })
          await this.saveVersionSnapshot(repo, saved, 'import_update', 'import')
          updated += 1
        } else {
          const saved = await repo.insert({
            ...values,
            query_code: queryCode,
            condition_logic: 'AND',
            conditions_json: JSON.stringify(EMPTY_CONDITIONS()),
            display_config: '{}',
            permission_config: '{}',
            schema_config: '',
            version: 1,
            published_at: status === 'published' ? utcNow() : null,
          })
          await this.saveVersionSnapshot(repo, saved, 'import_create', 'import')
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
  }
}
