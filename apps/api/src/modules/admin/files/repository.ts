/**
 * Files module repository layer
 */

import { and, count, desc, eq, ilike, inArray, like, lt, notInArray, or, sql, type SQL } from 'drizzle-orm'
import type { Executor } from '@/db/client'
import { admin_users, file_references, files, type FileRecord, type NewFileRecord } from '@/db/schema'
import type { FileKind } from './schema'

export interface FileFilters {
  search: string
  kind: FileKind | ''
  /** 'yes' = referenced by some record, 'no' = not referenced, '' = all */
  referenced: 'yes' | 'no' | ''
}

const refCount = sql<number>`(SELECT count(*)::int FROM ${file_references} WHERE ${file_references.file_id} = ${files.id})`
const DOCUMENT_MIME = ['application/pdf', 'text/%', 'application/msword', 'application/vnd.%']

export class FileRepository {
  constructor(private readonly db: Executor) {}

  private where({ search, kind, referenced }: FileFilters): SQL | undefined {
    return and(
      search ? ilike(files.original_name, `%${search}%`) : undefined,
      kind === 'image' ? like(files.mime_type, 'image/%') : undefined,
      kind === 'document' ? or(...DOCUMENT_MIME.map((m) => like(files.mime_type, m))) : undefined,
      kind === 'other'
        ? and(sql`${files.mime_type} NOT LIKE 'image/%'`, ...DOCUMENT_MIME.map((m) => sql`${files.mime_type} NOT LIKE ${m}`))
        : undefined,
      referenced === 'yes' ? sql`${refCount} > 0` : referenced === 'no' ? sql`${refCount} = 0` : undefined,
    )
  }

  async listPage(page: number, perPage: number, filters: FileFilters) {
    const where = this.where(filters)
    const [totalRow] = await this.db.select({ n: count() }).from(files).where(where)
    const items = await this.db
      .select({ file: files, uploader_name: sql<string | null>`coalesce(${admin_users.nickname}, ${admin_users.username})`, ref_count: refCount })
      .from(files)
      .leftJoin(admin_users, eq(admin_users.id, files.uploader_id))
      .where(where)
      .orderBy(desc(files.created_at), desc(files.id))
      .limit(perPage)
      .offset((page - 1) * perPage)
    return { total: totalRow?.n ?? 0, items: items.map((r) => ({ ...r.file, uploader_name: r.uploader_name, ref_count: r.ref_count })) }
  }

  async getById(id: string): Promise<FileRecord | null> {
    const [row] = await this.db.select().from(files).where(eq(files.id, id)).limit(1)
    return row ?? null
  }

  async insert(values: NewFileRecord): Promise<FileRecord> {
    const [row] = await this.db.insert(files).values(values).returning()
    return row!
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(files).where(eq(files.id, id))
  }

  /** Whether another row already stores this content in this driver (then the object exists) */
  async objectInUse(storage: string, objectKey: string, excludeIds: string[] = []): Promise<boolean> {
    const [row] = await this.db
      .select({ id: files.id })
      .from(files)
      .where(
        and(eq(files.storage, storage), eq(files.object_key, objectKey), excludeIds.length ? notInArray(files.id, excludeIds) : undefined),
      )
      .limit(1)
    return Boolean(row)
  }

  async countRefs(id: string): Promise<number> {
    const [row] = await this.db.select({ n: count() }).from(file_references).where(eq(file_references.file_id, id))
    return row?.n ?? 0
  }

  /** Where a file is used */
  async listRefs(id: string) {
    return this.db
      .select({ ref_table: file_references.ref_table, ref_id: file_references.ref_id, ref_field: file_references.ref_field })
      .from(file_references)
      .where(eq(file_references.file_id, id))
  }

  /** Unreferenced files uploaded more than `hours` ago (oldest first) */
  async listOrphans(hours: number, limit: number): Promise<FileRecord[]> {
    return this.db
      .select()
      .from(files)
      .where(and(lt(files.created_at, sql`timezone('utc', now()) - make_interval(hours => ${hours})`), sql`${refCount} = 0`))
      .orderBy(files.created_at)
      .limit(limit)
  }

  /** Delete the given files, re-checking that none got referenced since they were listed */
  async deleteUnreferenced(ids: string[]): Promise<FileRecord[]> {
    if (ids.length === 0) return []
    return this.db
      .delete(files)
      .where(and(inArray(files.id, ids), sql`${refCount} = 0`))
      .returning()
  }

  /** Transaction-scoped advisory lock: only one process runs the orphan cleanup at a time */
  async tryCleanupLock(): Promise<boolean> {
    const result = await this.db.execute<{ locked: boolean }>(sql`SELECT pg_try_advisory_xact_lock(hashtext('castor_file_cleanup')) AS locked`)
    return Boolean(result.rows[0]?.locked)
  }
}
