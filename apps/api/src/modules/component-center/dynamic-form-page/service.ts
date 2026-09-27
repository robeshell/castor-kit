/**
 * Dynamic form page service layer
 *
 * - A record and its dynamic fields are written in one transaction
 * - Updates write only the columns that change; with no change no UPDATE is sent and updated_at stays (replacing only
 *   the dynamic fields leaves the record's updated_at too)
 */

import type { z } from 'zod'
import { writeError } from '@/common/db-errors'
import { ServiceError } from '@/common/errors'
import { notFound } from '@/common/http'
import { buildTable, normalizeTableFileType, readTableFile, TableFileError, type UploadedFile } from '@/common/tabular'
import { changedFields, exportColumns, parseIntText, parseYesNo } from '@/common/validation'
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
  FORM_STATUSES,
  IMPORT_HEADER_MAP,
  STATUS_ERROR,
  TEMPLATE_HEADERS,
  TEMPLATE_ROWS,
  type DynamicFormExportRow,
  type dynamicFormExportBody,
  type DynamicFormInput,
  type ErrorRow,
} from './schema'

/** An import cell: trimmed, blank → null */
const cell = (value: string | undefined) => (value ?? '').trim() || null

/** Record columns from parsed input (a blank category is 'general'); the dynamic fields are separate */
function columns(values: Partial<DynamicFormInput>): DynamicFormRecordUpdate {
  const { fields: _fields, category, ...rest } = values
  return category === undefined ? rest : { ...rest, category: category ?? 'general' }
}

/** Field rows: rows without a key are skipped; the default sort order is the row's position */
function fieldRows(recordId: number, fields: DynamicFormInput['fields']): DynamicFormFieldInsert[] {
  return fields.flatMap((f, idx) =>
    f.field_key
      ? [{ record_id: recordId, field_key: f.field_key, field_value: f.field_value, field_type: f.field_type ?? 'text', sort_order: f.sort_order ?? idx, remark: f.remark }]
      : [],
  )
}

export class DynamicFormPageService {
  private readonly repo: DynamicFormPageRepository

  constructor(private readonly db: Db) {
    this.repo = new DynamicFormPageRepository(db)
  }

  async getItemOr404(id: number): Promise<DynamicFormRecord> {
    const record = await this.repo.getById(id)
    if (!record) throw notFound()
    return record
  }

  /** A record with its dynamic fields */
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

  private async inTx<T>(fn: (repo: DynamicFormPageRepository) => Promise<T>): Promise<T> {
    try {
      return await this.db.transaction((tx) => fn(new DynamicFormPageRepository(tx)))
    } catch (err) {
      throw writeError(err)
    }
  }

  async createItem(values: DynamicFormInput): Promise<[Record<string, unknown>, number]> {
    if (await this.repo.getByCode(values.record_code)) throw new ServiceError('记录编码已存在', 400)
    const result = await this.inTx(async (repo) => {
      const record = await repo.insert({ ...columns(values), title: values.title, record_code: values.record_code })
      await repo.insertFields(fieldRows(record.id, values.fields))
      return this.toDictWithFields(record, repo)
    })
    return [result, 201]
  }

  async updateItem(record: DynamicFormRecord, values: Partial<DynamicFormInput>) {
    const changes = changedFields(record, columns(values))
    return this.inTx(async (repo) => {
      if (Object.keys(changes).length > 0) await repo.update(record.id, changes)
      if (values.fields !== undefined) {
        await repo.deleteFieldsByRecord(record.id)
        await repo.insertFields(fieldRows(record.id, values.fields))
      }
      const fresh = Object.keys(changes).length > 0 ? (await repo.getById(record.id))! : record
      return this.toDictWithFields(fresh, repo)
    })
  }

  async deleteItem(record: DynamicFormRecord) {
    await this.repo.delete(record.id)
    return { message: '删除成功' }
  }

  async exportItems(options: z.output<typeof dynamicFormExportBody>) {
    const validFields = exportColumns(options.fields, EXPORT_FIELD_MAP)

    let items: DynamicFormExportRow[]
    if (options.export_mode !== 'selected') {
      const { search, category, status, owner, is_active: isActive } = options.filters
      items = await this.repo.listAllOrdered({
        search: search ?? '',
        category: category ?? '',
        status: status ?? '',
        owner: owner ?? '',
        isActive: parseYesNo(isActive),
      })
    } else {
      if (options.ids.length === 0) throw new ServiceError('请先勾选要导出的数据', 400)
      items = await this.repo.listByIdsOrdered(options.ids)
    }

    const headers = validFields.map((f) => EXPORT_FIELD_MAP[f]![0])
    const rows = items.map((item) => validFields.map((f) => EXPORT_FIELD_MAP[f]![1](item)))
    return buildTable(headers, rows, 'dynamic_form_page_export', normalizeTableFileType(options.file_type))
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

        const title = cell(mapped.title)
        const recordCode = cell(mapped.record_code)
        if (!title || !recordCode) {
          errors.push(buildErrorRow(line, '标题和记录编码不能为空', row))
          continue
        }
        const status = (cell(mapped.status) ?? 'draft').toLowerCase()
        if (!(FORM_STATUSES as readonly string[]).includes(status)) {
          errors.push(buildErrorRow(line, STATUS_ERROR, row))
          continue
        }
        // Rows with errors are only collected: the transaction is rolled back below, so nothing written stays
        if (errors.length > 0) continue

        const values = {
          title,
          category: cell(mapped.category) ?? 'general',
          status,
          owner: cell(mapped.owner),
          priority: parseIntText(mapped.priority, 0),
          is_active: parseYesNo(mapped.is_active, true)!,
          description: cell(mapped.description),
        }
        const existing = await repo.getByCode(recordCode)
        if (existing) {
          const changes = changedFields(existing, values)
          if (Object.keys(changes).length > 0) await repo.update(existing.id, changes)
          updated += 1
        } else {
          await repo.insert({ ...values, record_code: recordCode })
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
