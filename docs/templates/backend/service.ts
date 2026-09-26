/**
 * Service layer template → apps/api/src/modules/<domain>/<resource>/service.ts
 *
 * TODO: replace <Resource> with the type name (PascalCase) and <resource> with the resource name (snake_case)
 *
 * Responsibility: business logic + error handling, throwing ServiceError(message, status, payload); never touches HTTP objects like reply/session.
 * One commit per request: multi-step writes go inside inTx (db.transaction) and roll back entirely on failure.
 */

import { dbConstraintError } from '@/common/db-errors'
import { ServiceError } from '@/common/errors'
import { notFound } from '@/common/http'
import { pyStr, pyTruthy } from '@/common/py'
import { buildTable, normalizeTableFileType, readTableFile, TableFileError, type UploadedFile } from '@/common/tabular'
import type { EventBus } from '@/common/webhooks'
import type { Db } from '@/db/client'
import { <resource>ToDict, type <Resource> } from '@/db/schema'
import { <Resource>Repository } from './repository'
import { buildErrorRow, buildValues, EXPORT_FIELD_MAP, fieldLabel, IMPORT_HEADER_MAP, type ErrorRow } from './schema'

type Data = Record<string, unknown>

export class <Resource>Service {
  private readonly repo: <Resource>Repository

  constructor(
    private readonly db: Db,
    /** Webhook events (<resource>.created / updated / deleted), emitted after the write committed */
    private readonly events?: Pick<EventBus, 'emit'>,
  ) {
    this.repo = new <Resource>Repository(db)
  }

  private async inTx<T>(fn: (repo: <Resource>Repository) => Promise<T>): Promise<T> {
    try {
      return await this.db.transaction((tx) => fn(new <Resource>Repository(tx)))
    } catch (err) {
      if (err instanceof ServiceError) throw err
      // Input problems like unique conflicts / too long / numeric overflow → 400; everything else → 500
      throw dbConstraintError(err) ?? new ServiceError(err instanceof Error ? err.message : String(err), 500)
    }
  }

  async listItems(page: number, perPage: number, search: string) {
    const { total, items } = await this.repo.listPage(page, perPage, search)
    return { items: items.map(<resource>ToDict), total, page, per_page: perPage }
  }

  async getOr404(id: number): Promise<<Resource>> {
    const item = await this.repo.getById(id)
    if (!item) throw notFound()
    return item
  }

  getItem(item: <Resource>) {
    return <resource>ToDict(item)
  }

  async createItem(data: Data) {
    if (!pyTruthy(data.name)) throw new ServiceError('名称不能为空', 400)
    // TODO: add uniqueness checks (if needed)
    const values = { ...buildValues(data, false), name: pyStr(data.name) }
    const created = await this.inTx((repo) => repo.insert(values))
    const dict = <resource>ToDict(created)
    await this.events?.emit('<resource>.created', dict)
    return dict
  }

  async updateItem(item: <Resource>, data: Data) {
    const values = buildValues(data, true)
    if (Object.keys(values).length === 0) return <resource>ToDict(item)
    const updated = await this.inTx((repo) => repo.update(item.id, values))
    if (!updated) throw notFound()
    const dict = <resource>ToDict(updated)
    await this.events?.emit('<resource>.updated', dict)
    return dict
  }

  async deleteItem(item: <Resource>) {
    await this.inTx((repo) => repo.delete(item.id))
    await this.events?.emit('<resource>.deleted', { id: item.id })
    return { message: '删除成功' }
  }

  /** Export: fields defaults to all exportable fields; empty ids exports everything; xlsx by default */
  async exportItems(data: Data) {
    const fileType = normalizeTableFileType(data.file_type, 'xlsx')
    const rawFields = pyTruthy(data.fields) && Array.isArray(data.fields) ? data.fields : Object.keys(EXPORT_FIELD_MAP)
    const fields = rawFields.map((f) => String(f))
    const ids =
      pyTruthy(data.ids) && Array.isArray(data.ids) ? data.ids.filter((v): v is number => Number.isInteger(v)) : null

    const items = await this.repo.listForExport(ids)
    const headers = fields.map((f) => fieldLabel(f))
    const rows = items.map((item) => {
      const dict: Record<string, unknown> = <resource>ToDict(item)
      return fields.map((f) => {
        const column = EXPORT_FIELD_MAP[f]
        if (Array.isArray(column)) return column[1](item)
        return f in dict ? dict[f] : ''
      })
    })
    return buildTable(headers, rows, '<resource>_export', fileType)
  }

  async downloadTemplate(fileTypeRaw: unknown) {
    const fileType = normalizeTableFileType(fileTypeRaw, 'xlsx')
    return buildTable(Object.keys(IMPORT_HEADER_MAP), [], '<resource>_import_template', fileType)
  }

  /** Import: the whole batch is one transaction; if any row has errors, roll back entirely and return 400 + error_rows */
  async importItems(file: UploadedFile | null) {
    let table
    try {
      table = await readTableFile(file)
    } catch (err) {
      if (err instanceof TableFileError) throw new ServiceError(err.message, 400)
      throw err
    }
    const requiredHeader = Object.keys(IMPORT_HEADER_MAP)[0] ?? ''

    return this.inTx(async (repo) => {
      let created = 0
      const errors: ErrorRow[] = []
      for (const [line, row] of table.rows) {
        if (!(row[requiredHeader] ?? '').trim()) {
          errors.push(buildErrorRow(line, '名称不能为空', row))
          continue
        }
        const mapped: Data = {}
        for (const [header, value] of Object.entries(row)) {
          const field = IMPORT_HEADER_MAP[header]
          if (field && value) mapped[field] = value
        }
        let values
        try {
          values = buildValues(mapped, true)
        } catch (err) {
          if (!(err instanceof ServiceError)) throw err
          errors.push(buildErrorRow(line, err.message, row))
          continue
        }
        try {
          await repo.insert({ ...values, name: (row[requiredHeader] ?? '').trim() })
        } catch (err) {
          // The database rejected this row (unique conflict, too long, etc.): the transaction is aborted, so return along with the error rows found so far
          const rowError = dbConstraintError(err)
          if (!rowError) throw err
          errors.push(buildErrorRow(line, rowError.message, row))
          throw new ServiceError('导入失败，存在错误数据', 400, { error_rows: errors.slice(0, 500), error_count: errors.length })
        }
        created += 1
      }
      if (errors.length > 0) {
        // Throw so the whole transaction rolls back
        throw new ServiceError('导入失败，存在错误数据', 400, {
          error_rows: errors.slice(0, 500),
          error_count: errors.length,
        })
      }
      return { message: '导入成功', created, updated: 0 }
    })
  }
}
