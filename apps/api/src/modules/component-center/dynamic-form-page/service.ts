/**
 * Dynamic form page service layer
 *
 * Write behavior notes:
 * - Multi-step writes of a record + its dynamic fields run in one transaction and roll back as a whole on failure
 * - Updates write only columns that actually changed; with no changes no UPDATE is sent and updated_at stays the same (onupdate semantics);
 *   replacing only the dynamic fields doesn't make the record "dirty", so its updated_at stays the same too
 * - Import persistence timing: a row's write is persisted to the DB only right before the next row's get_by_code query, and the last row on commit;
 *   if any row has errors everything is rolled back, so unpersisted writes never trigger DB errors
 */

import { ServiceError } from '@/common/errors'
import { notFound } from '@/common/http'
import { isPlainObject, pyStr, pyStrOrEmpty, pyTruthy } from '@/common/py'
import { buildTable, normalizeTableFileType, readTableFile, TableFileError, type UploadedFile } from '@/common/tabular'
import type { Db } from '@/db/client'
import { dynamicFormRecordToDict, type DynamicFormRecord } from '@/db/schema'
import {
  DynamicFormPageRepository,
  type DynamicFormFieldInsert,
  type DynamicFormListFilters,
  type DynamicFormRecordUpdate,
} from './repository'
import {
  buildErrorRow,
  EXPORT_FIELD_MAP,
  IMPORT_HEADER_MAP,
  isExportField,
  MAX_FIELDS,
  parseBool,
  parseInt,
  pyIterate,
  pyLen,
  resolveIdList,
  STATUS_VALUES,
  TEMPLATE_HEADERS,
  TEMPLATE_ROWS,
  type DynamicFormExportRow,
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
function changedValues(record: DynamicFormRecord, next: DynamicFormRecordUpdate): DynamicFormRecordUpdate {
  const changes: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(next)) {
    if (value === undefined) continue
    if ((record as Record<string, unknown>)[key] !== value) changes[key] = value
  }
  return changes as DynamicFormRecordUpdate
}

/**
 * Builds field rows for `_upsert_fields`: iterates fields_data (non-dict elements have no .get → 500);
 * empty field_key entries are skipped, but the default sort_order still uses the original index.
 */
function buildFieldRows(recordId: number, fieldsData: unknown): DynamicFormFieldInsert[] {
  const rows: DynamicFormFieldInsert[] = []
  const items = pyTruthy(fieldsData) ? pyIterate(fieldsData) : []
  items.forEach((f, idx) => {
    if (!isPlainObject(f)) throw new ServiceError("object has no attribute 'get'", 500)
    const fieldKey = pyStrOrEmpty(f.field_key)
    if (!fieldKey) return
    rows.push({
      record_id: recordId,
      field_key: fieldKey,
      field_value: strOrNone(f.field_value),
      field_type: pyStrOrEmpty(f.field_type) || 'text',
      sort_order: parseInt(f.sort_order, idx),
      remark: strOrNone(f.remark),
    })
  })
  return rows
}

export class DynamicFormPageService {
  private readonly repo: DynamicFormPageRepository

  constructor(private readonly db: Db) {
    this.repo = new DynamicFormPageRepository(db)
  }

  static normalizeStatus(value: unknown, fallback = 'draft'): string {
    if (value === null || value === undefined) return fallback
    const raw = pyStr(value).trim().toLowerCase()
    if (!raw) return fallback
    if (!STATUS_VALUES.has(raw)) throw new ServiceError('状态仅支持 draft/published/archived', 400)
    return raw
  }

  async getItemOr404(id: number): Promise<DynamicFormRecord> {
    const record = await this.repo.getById(id)
    if (!record) throw notFound()
    return record
  }

  /** `record.to_dict(include_fields=True)` */
  async toDictWithFields(record: DynamicFormRecord, repo: DynamicFormPageRepository = this.repo) {
    const fields = await repo.listFields(record.id)
    return dynamicFormRecordToDict(record, fields.length, fields)
  }

  async listItems(page: number, perPage: number, filters: DynamicFormListFilters) {
    const { total, items } = await this.repo.listPage(page, perPage, filters)
    return {
      items: items.map((item) => dynamicFormRecordToDict(item, item.fields_count)),
      total,
      page,
      per_page: perPage,
    }
  }

  async createItem(data: Data): Promise<[Record<string, unknown>, number]> {
    const title = pyStrOrEmpty(data.title)
    const recordCode = pyStrOrEmpty(data.record_code)
    if (!title) throw new ServiceError('标题不能为空', 400)
    if (!recordCode) throw new ServiceError('记录编码不能为空', 400)
    if (await this.repo.getByCode(recordCode)) throw new ServiceError('记录编码已存在', 400)

    const fieldsData = pyTruthy(data.fields) ? data.fields : []
    if (pyLen(fieldsData) > MAX_FIELDS) throw new ServiceError('动态字段最多支持 20 条', 400)

    const status = DynamicFormPageService.normalizeStatus(data.status, 'draft')
    const result = await this.db.transaction(async (tx) => {
      const repo = new DynamicFormPageRepository(tx)
      const record = await repo.insert({
        title,
        record_code: recordCode,
        category: categoryOf(data.category),
        status,
        owner: strOrNone(data.owner),
        priority: parseInt(data.priority, 0),
        is_active: parseBool(data.is_active, true),
        description: strOrNone(data.description),
      })
      await repo.deleteFieldsByRecord(record.id)
      await repo.insertFields(buildFieldRows(record.id, fieldsData))
      return this.toDictWithFields(record, repo)
    })
    return [result, 201]
  }

  async updateItem(record: DynamicFormRecord, data: Data) {
    if (has(data, 'title') && !pyStrOrEmpty(data.title)) throw new ServiceError('标题不能为空', 400)

    const fieldsData = has(data, 'fields') ? data.fields : null
    if (fieldsData !== null && fieldsData !== undefined && pyLen(fieldsData) > MAX_FIELDS) {
      throw new ServiceError('动态字段最多支持 20 条', 400)
    }

    const next: DynamicFormRecordUpdate = {}
    if (has(data, 'title')) next.title = pyStrOrEmpty(data.title)
    if (has(data, 'category')) next.category = categoryOf(data.category)
    if (has(data, 'owner')) next.owner = strOrNone(data.owner)
    if (has(data, 'priority')) next.priority = parseInt(data.priority, record.priority || 0)
    if (has(data, 'is_active')) next.is_active = parseBool(data.is_active, record.is_active)
    if (has(data, 'description')) next.description = strOrNone(data.description)
    if (has(data, 'status')) next.status = DynamicFormPageService.normalizeStatus(data.status, record.status || 'draft')

    const changes = changedValues(record, next)
    return this.db.transaction(async (tx) => {
      const repo = new DynamicFormPageRepository(tx)
      if (Object.keys(changes).length > 0) await repo.update(record.id, changes)
      if (fieldsData !== null && fieldsData !== undefined) {
        await repo.deleteFieldsByRecord(record.id)
        await repo.insertFields(buildFieldRows(record.id, fieldsData))
      }
      const fresh = Object.keys(changes).length > 0 ? (await repo.getById(record.id))! : record
      return this.toDictWithFields(fresh, repo)
    })
  }

  async deleteItem(record: DynamicFormRecord) {
    await this.repo.delete(record.id)
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
        status: data.status,
        owner: data.owner,
        is_active: data.is_active,
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

    let items: DynamicFormExportRow[]
    if (exportMode === 'filtered') {
      // Return 500 when filters is not an object (e.g. list/str)
      if (!isPlainObject(filters)) throw new ServiceError("'filters' object has no attribute 'get'", 500)
      items = await this.repo.listAllOrdered({
        search: pyStrOrEmpty(filters.search),
        category: pyStrOrEmpty(filters.category),
        status: pyStrOrEmpty(filters.status),
        owner: pyStrOrEmpty(filters.owner),
        isActive: parseBool(filters.is_active, null),
      })
    } else {
      if (!Array.isArray(ids) || ids.length === 0) throw new ServiceError('请先勾选要导出的数据', 400)
      items = await this.repo.listByIdsOrdered(resolveIdList(ids))
    }

    const headers = validFields.map((f) => EXPORT_FIELD_MAP[f]![0])
    const rows = items.map((item) => validFields.map((f) => EXPORT_FIELD_MAP[f]![1](item)))
    return buildTable(headers, rows, 'dynamic_form_page_export', fileType)
  }

  async downloadTemplate(fileTypeRaw: unknown) {
    return buildTable(TEMPLATE_HEADERS, TEMPLATE_ROWS, 'dynamic_form_page_import_template', normalizeTableFileType(fileTypeRaw))
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
    if (!mappedFields.has('title') || !mappedFields.has('record_code')) {
      throw new ServiceError('导入文件缺少"标题/记录编码"列', 400)
    }

    return this.db.transaction(async (tx) => {
      const repo = new DynamicFormPageRepository(tx)
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
        const recordCode = pyStrOrEmpty(mapped.record_code)
        if (!title || !recordCode) {
          errors.push(buildErrorRow(line, '标题和记录编码不能为空', row))
          continue
        }

        const category = categoryOf(mapped.category)
        const status = DynamicFormPageService.normalizeStatus(mapped.status, 'draft')
        const values = {
          title,
          category,
          status,
          owner: strOrNone(mapped.owner),
          priority: parseInt(mapped.priority, 0),
          is_active: parseBool(mapped.is_active, true),
          description: strOrNone(mapped.description),
        }

        await flush() // Query triggers autoflush
        const existing = await repo.getByCode(recordCode)
        if (existing) {
          const changes = changedValues(existing, values)
          if (Object.keys(changes).length > 0) pending = () => repo.update(existing.id, changes)
          updated += 1
        } else {
          pending = () => repo.insert({ ...values, record_code: recordCode })
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
