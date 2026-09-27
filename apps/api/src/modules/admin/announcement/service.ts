/**
 * Announcement management service layer
 */

import { sql, type SQL } from 'drizzle-orm'
import type { z } from 'zod'
import { dbConstraintError, writeError } from '@/common/db-errors'
import { internalError, ServiceError } from '@/common/errors'
import { notFound } from '@/common/http'
import { buildTable, normalizeTableFileType, readTableFile, TableFileError, type UploadedFile } from '@/common/tabular'
import { changedFields } from '@/common/validation'
import type { Db } from '@/db/client'
import { utcNow } from '@/db/schema/columns'
import { announcementToDict, type Announcement } from '@/db/schema'
import { AnnouncementRepository, type AnnouncementFilters, type AnnouncementUpdate } from './repository'
import {
  ANNOUNCE_TYPES,
  EXPORT_FIELD_MAP,
  IMPORT_HEADER_MAP,
  STATUSES,
  TEMPLATE_HEADERS,
  TEMPLATE_ROWS,
  type AnnouncementInput,
  type announcementExportBody,
} from './schema'

/** Value to write for publish_at: a parsed date-time, the current time, or none */
type PublishAt = string | 'now' | null

/** A date-time with an offset is cast to timestamptz, which PostgreSQL converts to the session time zone on store */
function publishAtSql(value: PublishAt): SQL | string | null {
  if (value === null) return null
  if (value === 'now') return utcNow()
  return /[+-]\d{2}:\d{2}$/.test(value) ? sql`${value}::timestamptz` : value
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

  async createItem(values: AnnouncementInput) {
    try {
      const created = await this.repo.insert({
        ...values,
        content: values.content ?? '',
        publish_at: publishAtSql(values.publish_at) as string | null,
      })
      return announcementToDict(created)
    } catch (err) {
      throw writeError(err)
    }
  }

  /** Writes only the columns that change (none → no UPDATE, updated_at stays); a publish_at that is given is always written */
  private async applyChanges(item: Announcement, values: AnnouncementUpdate, publishAt?: PublishAt) {
    const changes: AnnouncementUpdate = changedFields(item, values)
    if (publishAt !== undefined && !(publishAt === null && item.publish_at === null)) {
      changes.publish_at = publishAtSql(publishAt) as string | null
    }
    if (Object.keys(changes).length === 0) return announcementToDict(item)
    try {
      return announcementToDict(await this.repo.update(item.id, changes))
    } catch (err) {
      throw writeError(err)
    }
  }

  async updateItem(item: Announcement, values: Partial<AnnouncementInput>) {
    const { publish_at: givenPublishAt, content, ...rest } = values
    let publishAt: PublishAt | undefined = givenPublishAt
    // Publishing an announcement that was never published stamps the publish time, unless the request sets one
    if (publishAt === undefined && rest.status === 'published' && item.publish_at === null) publishAt = 'now'
    return this.applyChanges(item, content === undefined ? rest : { ...rest, content: content ?? '' }, publishAt)
  }

  async deleteItem(item: Announcement) {
    try {
      await this.repo.delete(item.id)
    } catch (err) {
      throw writeError(err)
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

  async exportItems(options: z.output<typeof announcementExportBody>) {
    const fileType = normalizeTableFileType(options.file_type, 'xlsx')
    let validFields = options.fields.filter((f) => Object.hasOwn(EXPORT_FIELD_MAP, f))
    if (validFields.length === 0) validFields = Object.keys(EXPORT_FIELD_MAP)

    const items =
      options.export_mode === 'selected' && options.ids.length > 0
        ? await this.repo.listByIdsOrdered(options.ids)
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

    const colMap = new Map<string, string>()
    for (const col of table.fieldnames) {
      const key = col.trim()
      if (Object.hasOwn(IMPORT_HEADER_MAP, key)) colMap.set(col, IMPORT_HEADER_MAP[key]!)
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
      const isTop = ['是', 'true', '1'].includes((mapped.is_top || '').trim().toLowerCase())
      const sortText = (mapped.sort_order || '').trim()
      const sortOrder = /^[+-]?\d+$/.test(sortText) ? Number.parseInt(sortText, 10) : 0
      let announceType = (mapped.announce_type || 'system').trim()
      if (!(ANNOUNCE_TYPES as readonly string[]).includes(announceType)) announceType = 'system'
      let status = (mapped.status || 'draft').trim()
      if (!(STATUSES as readonly string[]).includes(status)) status = 'draft'
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
        const rejected = dbConstraintError(err)
        if (!rejected) throw internalError(err)
        errorRows.push({ line, reason: rejected.message, row })
      }
    }

    if (errorRows.length > 0) return { created, updated: 0, error_rows: errorRows }
    return { created, updated: 0 }
  }
}
