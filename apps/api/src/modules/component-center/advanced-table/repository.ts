/**
 * Advanced table page repository layer (also holds the queries the service builds directly: list filters, stats)
 */

import { and, asc, count, desc, eq, ilike, ne, or, sql, type SQL } from 'drizzle-orm'
import type { Executor } from '@/db/client'
import { cc_advanced_table_rows as t, type AdvancedTableRow } from '@/db/schema'

const INT32_MIN = -2_147_483_648
const INT32_MAX = 2_147_483_647

export type AdvancedTableRowInsert = Omit<typeof t.$inferInsert, 'score'> & { score?: string | null }
export type AdvancedTableRowPatch = Partial<Omit<AdvancedTableRow, 'id' | 'created_at' | 'updated_at'>>

export interface ListFilters {
  search: string
  status: string
  category: string
  owner: string
  isActive: boolean | null
  pinnedOnly: boolean
}

const SORTABLE_FIELDS = {
  sort_order: t.sort_order,
  priority: t.priority,
  progress: t.progress,
  score: t.score,
  updated_at: t.updated_at,
  due_date: t.due_date,
  id: t.id,
} as const

/** Literal for each element when inlined into `id IN (...)`; bool / list / dict make the DB raise → 500 */
function idLiteral(value: unknown): SQL {
  if (value === null || value === undefined) return sql`NULL`
  if (typeof value === 'number' && Number.isFinite(value)) return sql.raw(String(value))
  if (typeof value === 'string') return sql`${value}`
  throw new Error(`can't adapt type ${Array.isArray(value) ? 'list' : typeof value} in id IN (...)`)
}

export class AdvancedTableRepository {
  constructor(private readonly db: Executor) {}

  private buildWhere(f: ListFilters): SQL | undefined {
    const conds: (SQL | undefined)[] = []
    if (f.search) {
      const like = `%${f.search}%`
      conds.push(or(ilike(t.name, like), ilike(t.row_code, like), ilike(t.tags, like), ilike(t.remark, like), ilike(t.owner, like)))
    }
    if (f.status) conds.push(eq(t.status, f.status))
    if (f.category) conds.push(eq(t.category, f.category))
    if (f.owner) conds.push(ilike(t.owner, `%${f.owner}%`))
    if (f.isActive !== null) conds.push(eq(t.is_active, f.isActive))
    if (f.pinnedOnly) conds.push(eq(t.is_pinned, true))
    return and(...conds)
  }

  async listPage(f: ListFilters, page: number, perPage: number, sortField: string, sortOrder: string) {
    const where = this.buildWhere(f)
    const column = SORTABLE_FIELDS[sortField as keyof typeof SORTABLE_FIELDS] ?? t.sort_order
    const orderClause = sortOrder.toLowerCase() === 'desc' ? desc(column) : asc(column)
    const [totalRow] = await this.db.select({ n: count() }).from(t).where(where)
    const items = await this.db
      .select()
      .from(t)
      .where(where)
      .orderBy(desc(t.is_pinned), orderClause, asc(t.id))
      .limit(perPage)
      .offset((page - 1) * perPage)
    return { total: totalRow?.n ?? 0, items }
  }

  async countWhere(where?: SQL): Promise<number> {
    const [row] = await this.db.select({ n: count() }).from(t).where(where)
    return row?.n ?? 0
  }

  async stats() {
    const total = await this.countWhere()
    const activeCount = await this.countWhere(eq(t.is_active, true))
    const pinnedCount = await this.countWhere(eq(t.is_pinned, true))
    const publishedCount = await this.countWhere(eq(t.status, 'published'))
    const [avgRow] = await this.db
      .select({ progress: sql<string | null>`avg(${t.progress})`, score: sql<string | null>`avg(${t.score})` })
      .from(t)
    const categoryRows = await this.db
      .select({ category: t.category, n: sql<number>`count(${t.id})`.mapWith(Number) })
      .from(t)
      .groupBy(t.category)
    return { total, activeCount, pinnedCount, publishedCount, avgRow: avgRow!, categoryRows }
  }

  async get(id: number): Promise<AdvancedTableRow | null> {
    if (!Number.isInteger(id) || id < INT32_MIN || id > INT32_MAX) return null
    const [row] = await this.db.select().from(t).where(eq(t.id, id))
    return row ?? null
  }

  async getByCode(code: string): Promise<AdvancedTableRow | null> {
    const [row] = await this.db.select().from(t).where(eq(t.row_code, code)).limit(1)
    return row ?? null
  }

  async getDuplicateCode(code: string, excludeId: number): Promise<AdvancedTableRow | null> {
    const [row] = await this.db
      .select()
      .from(t)
      .where(and(eq(t.row_code, code), ne(t.id, excludeId)))
      .limit(1)
    return row ?? null
  }

  /** `AdvancedTableRow.id.in_(ids)`: ids are the raw JSON values from the request body */
  async listByIds(ids: unknown[]): Promise<AdvancedTableRow[]> {
    const literals = ids.map(idLiteral)
    return this.db
      .select()
      .from(t)
      .where(sql`${t.id} IN (${sql.join(literals, sql`, `)})`)
  }

  async insert(values: AdvancedTableRowInsert): Promise<AdvancedTableRow> {
    const [row] = await this.db.insert(t).values(values).returning()
    return row!
  }

  async update(id: number, patch: AdvancedTableRowPatch): Promise<void> {
    await this.db.update(t).set(patch).where(eq(t.id, id))
  }

  async delete(id: number): Promise<void> {
    await this.db.delete(t).where(eq(t.id, id))
  }
}
