/**
 * Announcement management service layer
 */

import { sql, type SQL } from 'drizzle-orm'
import { ServiceError } from '@/common/errors'
import { notFound } from '@/common/http'
import { pyInt, pyStr, pyTruthy } from '@/common/py'
import { buildTable, normalizeTableFileType, readTableFile, TableFileError, type UploadedFile } from '@/common/tabular'
import type { Db } from '@/db/client'
import { utcNow } from '@/db/schema/columns'
import { announcementToDict, type Announcement } from '@/db/schema'
import { bindText, omitNull, pyEq } from '@/common/sqla-bind'
import { AnnouncementRepository, type AnnouncementFilters, type AnnouncementUpdate } from './repository'
import {
  ANNOUNCE_TYPES,
  EXPORT_FIELD_MAP,
  IMPORT_HEADER_MAP,
  STATUSES,
  TEMPLATE_HEADERS,
  TEMPLATE_ROWS,
  idsForInClause,
  normalizeDbTimestamp,
  parsePublishAt,
  pickExportFields,
  stripOrEmpty,
  type PyDateTime,
} from './schema'

type Data = Record<string, unknown>

/** Integer conversion failures are treated as uncaught errors → global 500 */
function pyIntOr500(value: unknown): number {
  try {
    return pyInt(value)
  } catch (err) {
    throw new ServiceError(err instanceof Error ? err.message : String(err), 500)
  }
}

/** Value to write for publish_at: parsed result / current UTC time / None */
type PublishAtValue = PyDateTime | 'now' | null

function publishAtSql(value: PublishAtValue): SQL | string | null {
  if (value === null) return null
  if (value === 'now') return utcNow()
  // aware datetimes are sent as `'...'::timestamptz` and converted to the session time zone when stored in a timestamp column
  return value.aware ? sql`${value.text}::timestamptz` : value.text
}

/** Whether the publish time is unchanged: naive values compare by value; aware values never equal the naive DB value */
function publishAtEquals(value: PublishAtValue, current: string | null): boolean {
  if (value === null) return current === null
  if (value === 'now' || value.aware) return false
  return value.text === normalizeDbTimestamp(current)
}

/** SQLSTATE → error class name, used as the prefix of import row error reasons (keeps the existing error message format) */
const PG_ERROR_CLASS: Record<string, string> = {
  '22001': 'StringDataRightTruncation',
  '22003': 'NumericValueOutOfRange',
  '22P02': 'InvalidTextRepresentation',
  '23502': 'NotNullViolation',
}

function importRowReason(err: unknown): string {
  // Drizzle wraps the pg error in `cause`
  const e = ((err as { cause?: unknown }).cause ?? err) as { code?: string; message?: string }
  const cls = e.code && PG_ERROR_CLASS[e.code]
  const message = e.message ?? String(err)
  return cls ? `(psycopg2.errors.${cls}) ${message}` : message
}

export class AnnouncementService {
  private readonly repo: AnnouncementRepository

  constructor(private readonly db: Db) {
    this.repo = new AnnouncementRepository(db)
  }

  async getOr404(id: number): Promise<Announcement> {
    const item = await this.repo.get(id)
    if (!item) throw notFound()
    return item
  }

  async listItems(page: number, perPage: number, filters: AnnouncementFilters) {
    const { total, rows } = await this.repo.listPage(page, perPage, filters)
    return { items: rows.map(announcementToDict), total }
  }

  async createItem(data: Data) {
    const title = stripOrEmpty(data.title)
    if (!title) throw new ServiceError('标题不能为空', 400)

    const publishAt = pyTruthy(data.publish_at) ? parsePublishAt(data.publish_at) : null

    const content = bindText(pyTruthy(data.content) ? data.content : '')
    const announceType = bindText(pyTruthy(data.announce_type) ? data.announce_type : 'system')
    const status = bindText(pyTruthy(data.status) ? data.status : 'draft')
    const isTop = pyTruthy('is_top' in data ? data.is_top : false)
    const sortOrder = pyIntOr500(pyTruthy(data.sort_order) ? data.sort_order : 0)

    try {
      const created = await this.repo.insert({
        title,
        content: omitNull(content),
        announce_type: omitNull(announceType),
        status: omitNull(status),
        is_top: isTop,
        sort_order: sortOrder,
        publish_at: omitNull(publishAtSql(publishAt)) as string | undefined,
      })
      return announcementToDict(created)
    } catch (err) {
      throw new ServiceError(err instanceof Error ? err.message : String(err), 500)
    }
  }

  /** Compute final values in a fixed field order and write back only columns that differ from the current value (`==` semantics); no UPDATE when nothing changed */
  private async applyChanges(item: Announcement, assigned: Record<string, unknown>, publishAt?: PublishAtValue) {
    const changes: AnnouncementUpdate = {}
    for (const [field, value] of Object.entries(assigned)) {
      if (!pyEq(value, (item as Record<string, unknown>)[field])) {
        ;(changes as Record<string, unknown>)[field] = value
      }
    }
    if (publishAt !== undefined && !publishAtEquals(publishAt, item.publish_at)) {
      changes.publish_at = publishAtSql(publishAt) as string | null
    }
    if (Object.keys(changes).length === 0) return announcementToDict(item)

    // Bind by column type before writing (PG assignment-cast semantics)
    for (const field of ['content', 'announce_type', 'status'] as const) {
      if (field in changes) changes[field] = bindText(changes[field]) as never
    }
    try {
      return announcementToDict(await this.repo.update(item.id, changes))
    } catch (err) {
      throw new ServiceError(err instanceof Error ? err.message : String(err), 500)
    }
  }

  async updateItem(item: Announcement, data: Data) {
    const assigned: Record<string, unknown> = {}
    let publishAt: PublishAtValue | undefined

    if ('title' in data) {
      const title = stripOrEmpty(data.title)
      if (!title) throw new ServiceError('标题不能为空', 400)
      assigned.title = title
    }
    if ('content' in data) assigned.content = pyTruthy(data.content) ? data.content : ''
    if ('announce_type' in data) assigned.announce_type = data.announce_type
    if ('status' in data) {
      assigned.status = data.status
      if (data.status === 'published' && item.publish_at === null) publishAt = 'now'
    }
    if ('is_top' in data) assigned.is_top = pyTruthy(data.is_top)
    if ('sort_order' in data) assigned.sort_order = pyIntOr500(pyTruthy(data.sort_order) ? data.sort_order : 0)
    if ('publish_at' in data) {
      if (pyTruthy(data.publish_at)) {
        const parsed = parsePublishAt(data.publish_at)
        if (parsed) publishAt = parsed
      } else {
        publishAt = null
      }
    }
    return this.applyChanges(item, assigned, publishAt)
  }

  async deleteItem(item: Announcement) {
    try {
      await this.repo.delete(item.id)
    } catch (err) {
      throw new ServiceError(err instanceof Error ? err.message : String(err), 500)
    }
    return { message: '删除成功' }
  }

  async publishItem(item: Announcement) {
    return this.applyChanges(item, { status: 'published' }, item.publish_at === null ? 'now' : undefined)
  }

  async unpublishItem(item: Announcement) {
    return this.applyChanges(item, { status: 'draft' })
  }

  exportFields() {
    return Object.entries(EXPORT_FIELD_MAP).map(([value, [label]]) => ({ label, value }))
  }

  async exportItems(data: Data) {
    const fieldsRaw = pyTruthy(data.fields) ? data.fields : []
    const fileType = normalizeTableFileType(data.file_type, 'xlsx')
    const ids = pyTruthy(data.ids) ? data.ids : []
    const exportMode = pyStr(pyTruthy(data.export_mode) ? data.export_mode : 'all').trim()

    let validFields = pickExportFields(fieldsRaw)
    if (validFields.length === 0) validFields = Object.keys(EXPORT_FIELD_MAP)

    const items =
      exportMode === 'selected' && pyTruthy(ids)
        ? await this.repo.listByIdsOrdered(idsForInClause(ids))
        : await this.repo.listAllForExport()

    const headers = validFields.map((f) => EXPORT_FIELD_MAP[f]![0])
    const rows = items.map((item) => validFields.map((f) => EXPORT_FIELD_MAP[f]![1](item)))
    return buildTable(headers, rows, 'announcements_export', fileType)
  }

  async downloadTemplate(fileTypeRaw: unknown) {
    return buildTable(TEMPLATE_HEADERS, TEMPLATE_ROWS, 'announcements_import_template', normalizeTableFileType(fileTypeRaw, 'xlsx'))
  }

  /** Commit row by row: successful rows are kept, failed rows go to error_rows (no overall rollback) */
  async importItems(file: UploadedFile | null) {
    if (!file) throw new ServiceError('请上传导入文件', 400)
    let table
    try {
      table = await readTableFile(file)
    } catch (err) {
      if (err instanceof TableFileError) throw new ServiceError(err.message, 400)
      throw err
    }
    if (table.fieldnames.length === 0) throw new ServiceError('文件为空或格式错误', 400)

    // Note: keys are the stripped headers, but lookups check the raw headers (a header with surrounding whitespace is not mapped; preserves existing behavior)
    const colMap = new Map<string, string>()
    for (const col of table.fieldnames) {
      const key = col.trim()
      if (Object.hasOwn(IMPORT_HEADER_MAP, key)) colMap.set(key, IMPORT_HEADER_MAP[key]!)
    }

    let created = 0
    const errorRows: { line: number; reason: string; row: Record<string, string> }[] = []
    for (const [line, row] of table.rows) {
      const mapped: Record<string, string> = {}
      for (const [k, v] of Object.entries(row)) {
        const field = colMap.get(k)
        if (field) mapped[field] = v
      }
      const title = (mapped.title || '').trim()
      if (!title) {
        errorRows.push({ line, reason: '标题不能为空', row })
        continue
      }
      const isTop = ['是', 'true', 'True', '1'].includes((mapped.is_top || '').trim())
      let sortOrder: number
      try {
        sortOrder = pyInt(mapped.sort_order || 0)
      } catch {
        sortOrder = 0
      }
      let announceType = (mapped.announce_type || 'system').trim()
      if (!ANNOUNCE_TYPES.includes(announceType)) announceType = 'system'
      let status = (mapped.status || 'draft').trim()
      if (!STATUSES.includes(status)) status = 'draft'
      try {
        await this.repo.insert({
          title,
          content: mapped.content || '',
          announce_type: announceType,
          status,
          is_top: isTop,
          sort_order: sortOrder,
        })
        created += 1
      } catch (err) {
        errorRows.push({ line, reason: importRowReason(err), row })
      }
    }

    if (errorRows.length > 0) return { created, updated: 0, error_rows: errorRows }
    return { created, updated: 0 }
  }
}
