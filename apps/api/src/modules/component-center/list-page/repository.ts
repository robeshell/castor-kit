/**
 * List page repository layer
 */

import { and, asc, count, desc, eq, ilike, inArray, ne, or, type SQL } from 'drizzle-orm'
import type { PgInsertValue, PgUpdateSetSource } from 'drizzle-orm/pg-core'
import type { Executor } from '@/db/client'
import { query_management_versions, query_managements, type QueryManagement } from '@/db/schema'

export interface ListPageFilters {
  search: string
  category: string
  owner: string
  isActive: boolean | null
  status: string
}

export type QueryManagementInsert = PgInsertValue<typeof query_managements>
export type QueryManagementUpdate = PgUpdateSetSource<typeof query_managements>
export type QueryManagementVersionInsert = PgInsertValue<typeof query_management_versions>

export class ListPageRepository {
  constructor(private readonly db: Executor) {}

  private filterWhere(filters: ListPageFilters): SQL | undefined {
    const t = query_managements
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
    const [totalRow] = await this.db.select({ n: count() }).from(query_managements).where(where)
    const items = await this.db
      .select()
      .from(query_managements)
      .where(where)
      .orderBy(desc(query_managements.priority), desc(query_managements.id))
      .limit(perPage)
      .offset((page - 1) * perPage)
    return { total: totalRow?.n ?? 0, items }
  }

  async listFiltered(filters: ListPageFilters): Promise<QueryManagement[]> {
    return this.db.select().from(query_managements).where(this.filterWhere(filters)).orderBy(asc(query_managements.id))
  }

  async listByIds(ids: number[]): Promise<QueryManagement[]> {
    if (ids.length === 0) return []
    return this.db.select().from(query_managements).where(inArray(query_managements.id, ids)).orderBy(asc(query_managements.id))
  }

  async getById(id: number): Promise<QueryManagement | null> {
    const [row] = await this.db.select().from(query_managements).where(eq(query_managements.id, id)).limit(1)
    return row ?? null
  }

  async getByCode(queryCode: string): Promise<QueryManagement | null> {
    const [row] = await this.db.select().from(query_managements).where(eq(query_managements.query_code, queryCode)).limit(1)
    return row ?? null
  }

  /** Whether another row (other than excludeId) already has this code */
  async findDuplicateCode(queryCode: string, excludeId: number): Promise<QueryManagement | null> {
    const [row] = await this.db
      .select()
      .from(query_managements)
      .where(and(eq(query_managements.query_code, queryCode), ne(query_managements.id, excludeId)))
      .limit(1)
    return row ?? null
  }

  async insert(values: QueryManagementInsert): Promise<QueryManagement> {
    const [row] = await this.db.insert(query_managements).values(values).returning()
    return row!
  }

  async update(id: number, values: QueryManagementUpdate): Promise<QueryManagement> {
    const [row] = await this.db.update(query_managements).set(values).where(eq(query_managements.id, id)).returning()
    return row!
  }

  async delete(id: number): Promise<void> {
    await this.db.delete(query_managements).where(eq(query_managements.id, id))
  }

  async insertVersion(values: QueryManagementVersionInsert): Promise<void> {
    await this.db.insert(query_management_versions).values(values)
  }

  async getVersionById(id: number) {
    const [row] = await this.db.select().from(query_management_versions).where(eq(query_management_versions.id, id)).limit(1)
    return row ?? null
  }

  async listVersionsPage(itemId: number, page: number, perPage: number) {
    const where = eq(query_management_versions.query_management_id, itemId)
    const [totalRow] = await this.db.select({ n: count() }).from(query_management_versions).where(where)
    const items = await this.db
      .select()
      .from(query_management_versions)
      .where(where)
      .orderBy(desc(query_management_versions.id))
      .limit(perPage)
      .offset((page - 1) * perPage)
    return { total: totalRow?.n ?? 0, items }
  }
}
