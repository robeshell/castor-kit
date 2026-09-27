/**
 * List page repository layer
 */

import { and, asc, count, desc, eq, ilike, inArray, ne, or, type SQL } from 'drizzle-orm'
import type { PgInsertValue, PgUpdateSetSource } from 'drizzle-orm/pg-core'
import { clearFileRefs, syncFileRefs } from '@/common/file-refs'
import type { Executor } from '@/db/client'
import { saved_query_versions, saved_queries, type SavedQuery } from '@/db/schema'

export interface ListPageFilters {
  search: string
  category: string
  owner: string
  isActive: boolean | null
  status: string
}

export type SavedQueryInsert = PgInsertValue<typeof saved_queries>
export type SavedQueryUpdate = PgUpdateSetSource<typeof saved_queries>
export type SavedQueryVersionInsert = PgInsertValue<typeof saved_query_versions>

export class ListPageRepository {
  constructor(private readonly db: Executor) {}

  private filterWhere(filters: ListPageFilters): SQL | undefined {
    const t = saved_queries
    const conds: (SQL | undefined)[] = []
    if (filters.search) {
      const like = `%${filters.search}%`
      conds.push(or(ilike(t.name, like), ilike(t.query_code, like), ilike(t.keyword, like), ilike(t.data_source, like), ilike(t.owner, like)))
    }
    if (filters.category) conds.push(eq(t.category, filters.category))
    if (filters.owner) conds.push(ilike(t.owner, `%${filters.owner}%`))
    if (filters.isActive !== null) conds.push(eq(t.is_active, filters.isActive))
    if (filters.status) conds.push(eq(t.status, filters.status))
    return conds.length > 0 ? and(...conds) : undefined
  }

  async listPage(filters: ListPageFilters, page: number, perPage: number) {
    const where = this.filterWhere(filters)
    const [totalRow] = await this.db.select({ n: count() }).from(saved_queries).where(where)
    const items = await this.db
      .select()
      .from(saved_queries)
      .where(where)
      .orderBy(desc(saved_queries.priority), desc(saved_queries.id))
      .limit(perPage)
      .offset((page - 1) * perPage)
    return { total: totalRow?.n ?? 0, items }
  }

  async listFiltered(filters: ListPageFilters): Promise<SavedQuery[]> {
    return this.db.select().from(saved_queries).where(this.filterWhere(filters)).orderBy(asc(saved_queries.id))
  }

  async listByIds(ids: number[]): Promise<SavedQuery[]> {
    if (ids.length === 0) return []
    return this.db.select().from(saved_queries).where(inArray(saved_queries.id, ids)).orderBy(asc(saved_queries.id))
  }

  async getById(id: number): Promise<SavedQuery | null> {
    const [row] = await this.db.select().from(saved_queries).where(eq(saved_queries.id, id)).limit(1)
    return row ?? null
  }

  async getByCode(queryCode: string): Promise<SavedQuery | null> {
    const [row] = await this.db.select().from(saved_queries).where(eq(saved_queries.query_code, queryCode)).limit(1)
    return row ?? null
  }

  /** Whether another row (other than excludeId) already has this code */
  async findDuplicateCode(queryCode: string, excludeId: number): Promise<SavedQuery | null> {
    const [row] = await this.db
      .select()
      .from(saved_queries)
      .where(and(eq(saved_queries.query_code, queryCode), ne(saved_queries.id, excludeId)))
      .limit(1)
    return row ?? null
  }

  async insert(values: SavedQueryInsert): Promise<SavedQuery> {
    const [row] = await this.db.insert(saved_queries).values(values).returning()
    await this.syncFiles(row!)
    return row!
  }

  async update(id: number, values: SavedQueryUpdate): Promise<SavedQuery> {
    const [row] = await this.db.update(saved_queries).set(values).where(eq(saved_queries.id, id)).returning()
    await this.syncFiles(row!)
    return row!
  }

  async delete(id: number): Promise<void> {
    await clearFileRefs(this.db, 'saved_queries', id)
    await this.db.delete(saved_queries).where(eq(saved_queries.id, id))
  }

  /** Images / attachments uploaded to the file center are registered as this row's references (other URLs are ignored) */
  private async syncFiles(row: SavedQuery) {
    await syncFileRefs(this.db, 'saved_queries', row.id, {
      images: urlList(row.image_urls),
      attachments: urlList(row.file_urls),
    })
  }

  async insertVersion(values: SavedQueryVersionInsert): Promise<void> {
    await this.db.insert(saved_query_versions).values(values)
  }

  async getVersionById(id: number) {
    const [row] = await this.db.select().from(saved_query_versions).where(eq(saved_query_versions.id, id)).limit(1)
    return row ?? null
  }

  async listVersionsPage(itemId: number, page: number, perPage: number) {
    const where = eq(saved_query_versions.query_id, itemId)
    const [totalRow] = await this.db.select({ n: count() }).from(saved_query_versions).where(where)
    const items = await this.db
      .select()
      .from(saved_query_versions)
      .where(where)
      .orderBy(desc(saved_query_versions.id))
      .limit(perPage)
      .offset((page - 1) * perPage)
    return { total: totalRow?.n ?? 0, items }
  }
}

/** URLs stored as a JSON array */
function urlList(json: string | null): string[] {
  let urls: string[] = []
  try {
    const parsed: unknown = json ? JSON.parse(json) : []
    if (Array.isArray(parsed)) urls = parsed.filter((v): v is string => typeof v === 'string')
  } catch {
    urls = []
  }
  return urls
}
