/**
 * service 层模板 → apps/api/src/modules/<domain>/<resource>/service.ts
 *
 * TODO: 替换 <Resource> 为类型名（大驼峰），<resource> 为资源名（下划线）
 *
 * 职责：业务逻辑 + 错误处理，抛 ServiceError(message, status, payload)；不碰 reply/session 等 HTTP 对象。
 * 一个请求一次提交：多步写操作放进 inTx（db.transaction），失败整体回滚。
 */

import { ServiceError } from '@/common/errors'
import { notFound } from '@/common/http'
import { pyStr, pyTruthy } from '@/common/py'
import { buildTable, normalizeTableFileType, readTableFile, TableFileError, type UploadedFile } from '@/common/tabular'
import type { Db } from '@/db/client'
import { <resource>ToDict, type <Resource> } from '@/db/schema'
import { <Resource>Repository } from './repository'
import { buildErrorRow, buildValues, EXPORT_FIELD_MAP, IMPORT_HEADER_MAP, type ErrorRow } from './schema'

type Data = Record<string, unknown>

export class <Resource>Service {
  private readonly repo: <Resource>Repository

  constructor(private readonly db: Db) {
    this.repo = new <Resource>Repository(db)
  }

  private async inTx<T>(fn: (repo: <Resource>Repository) => Promise<T>): Promise<T> {
    try {
      return await this.db.transaction((tx) => fn(new <Resource>Repository(tx)))
    } catch (err) {
      if (err instanceof ServiceError) throw err
      throw new ServiceError(err instanceof Error ? err.message : String(err), 500)
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
    // TODO: 补充唯一性校验（如需要）
    const values = { ...buildValues(data, false), name: pyStr(data.name) }
    const created = await this.inTx((repo) => repo.insert(values))
    return <resource>ToDict(created)
  }

  async updateItem(item: <Resource>, data: Data) {
    const values = buildValues(data, true)
    if (Object.keys(values).length === 0) return <resource>ToDict(item)
    const updated = await this.inTx((repo) => repo.update(item.id, values))
    if (!updated) throw notFound()
    return <resource>ToDict(updated)
  }

  async deleteItem(item: <Resource>) {
    await this.inTx((repo) => repo.delete(item.id))
    return { message: '删除成功' }
  }

  /** 导出：fields 缺省为全部导出字段；ids 为空导出全部；默认 xlsx */
  async exportItems(data: Data) {
    const fileType = normalizeTableFileType(data.file_type, 'xlsx')
    const rawFields = pyTruthy(data.fields) && Array.isArray(data.fields) ? data.fields : Object.keys(EXPORT_FIELD_MAP)
    const fields = rawFields.map((f) => String(f))
    const ids =
      pyTruthy(data.ids) && Array.isArray(data.ids) ? data.ids.filter((v): v is number => Number.isInteger(v)) : null

    const items = await this.repo.listForExport(ids)
    const headers = fields.map((f) => EXPORT_FIELD_MAP[f] ?? f)
    const rows = items.map((item) => {
      const dict: Record<string, unknown> = <resource>ToDict(item)
      return fields.map((f) => (f in dict ? dict[f] : ''))
    })
    return buildTable(headers, rows, '<resource>_export', fileType)
  }

  async downloadTemplate(fileTypeRaw: unknown) {
    const fileType = normalizeTableFileType(fileTypeRaw, 'xlsx')
    return buildTable(Object.keys(IMPORT_HEADER_MAP), [], '<resource>_import_template', fileType)
  }

  /** 导入：整批一个事务，存在错误行时整体回滚并返回 400 + error_rows */
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
        await repo.insert({ ...values, name: (row[requiredHeader] ?? '').trim() })
        created += 1
      }
      if (errors.length > 0) {
        // 抛错让事务整体回滚
        throw new ServiceError('导入失败，存在错误数据', 400, {
          error_rows: errors.slice(0, 500),
          error_count: errors.length,
        })
      }
      return { message: '导入成功', created, updated: 0 }
    })
  }
}
