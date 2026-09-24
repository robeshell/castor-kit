/**
 * 带统计的列表页 repository 层（对齐 AuraStack backend/app/component_center/crud/stats_list_page.py
 * 以及 service 里直接拼的查询）
 */

import { and, asc, count, desc, eq, ilike, inArray, ne, or, sql, type SQL } from 'drizzle-orm'
import type { Executor } from '@/db/client'
import { stats_items, type StatsItem } from '@/db/schema'

export interface StatsListFilters {
  search: string
  category: string
  owner: string
  isActive: boolean | null
  status: string
}

export type StatsItemInsert = typeof stats_items.$inferInsert
export type StatsItemUpdate = Partial<Omit<StatsItemInsert, 'id' | 'created_at' | 'updated_at'>>

export class StatsListPageRepository {
  constructor(private readonly db: Executor) {}

  /** 对应 service._build_list_query */
  private listWhere(f: StatsListFilters): SQL | undefined {
    const conds: (SQL | undefined)[] = []
    if (f.search) {
      conds.push(
        or(
          ilike(stats_items.name, `%${f.search}%`),
          ilike(stats_items.item_code, `%${f.search}%`),
          ilike(stats_items.owner, `%${f.search}%`),
        ),
      )
    }
    if (f.category) conds.push(eq(stats_items.category, f.category))
    if (f.owner) conds.push(ilike(stats_items.owner, `%${f.owner}%`))
    if (f.isActive !== null) conds.push(eq(stats_items.is_active, f.isActive))
    if (f.status) conds.push(eq(stats_items.status, f.status))
    return conds.length > 0 ? and(...conds) : undefined
  }

  async listPage(page: number, perPage: number, filters: StatsListFilters) {
    const where = this.listWhere(filters)
    const [totalRow] = await this.db.select({ n: count() }).from(stats_items).where(where)
    const items = await this.db
      .select()
      .from(stats_items)
      .where(where)
      .orderBy(desc(stats_items.priority), desc(stats_items.id))
      .limit(perPage)
      .offset((page - 1) * perPage)
    return { total: totalRow?.n ?? 0, items }
  }

  async listAllOrdered(filters: StatsListFilters): Promise<StatsItem[]> {
    return this.db.select().from(stats_items).where(this.listWhere(filters)).orderBy(asc(stats_items.id))
  }

  async listByIdsOrdered(ids: number[]): Promise<StatsItem[]> {
    if (ids.length === 0) return []
    return this.db.select().from(stats_items).where(inArray(stats_items.id, ids)).orderBy(asc(stats_items.id))
  }

  async getById(id: number): Promise<StatsItem | null> {
    const [row] = await this.db.select().from(stats_items).where(eq(stats_items.id, id)).limit(1)
    return row ?? null
  }

  async getByCode(itemCode: string): Promise<StatsItem | null> {
    const [row] = await this.db.select().from(stats_items).where(eq(stats_items.item_code, itemCode)).limit(1)
    return row ?? null
  }

  async existsOtherWithCode(itemCode: string, excludeId: number): Promise<boolean> {
    const [row] = await this.db
      .select({ id: stats_items.id })
      .from(stats_items)
      .where(and(eq(stats_items.item_code, itemCode), ne(stats_items.id, excludeId)))
      .limit(1)
    return Boolean(row)
  }

  async insert(values: StatsItemInsert): Promise<StatsItem> {
    const [row] = await this.db.insert(stats_items).values(values).returning()
    return row!
  }

  /** 只在有变更列时调用（updated_at 由 $onUpdateFn 自动刷新，对齐 SQLAlchemy onupdate） */
  async update(id: number, values: StatsItemUpdate): Promise<void> {
    await this.db.update(stats_items).set(values).where(eq(stats_items.id, id))
  }

  async delete(id: number): Promise<void> {
    await this.db.delete(stats_items).where(eq(stats_items.id, id))
  }

  /** 对应 service.get_stats 的各项聚合（数值列保留 numeric 文本，由 service 按 Python float() 转换） */
  async aggregate() {
    const [counts] = await this.db
      .select({
        total: count(),
        active: sql<number>`count(*) filter (where ${stats_items.is_active} = true)`.mapWith(Number),
        published: sql<number>`count(*) filter (where ${stats_items.status} = 'published')`.mapWith(Number),
        draft: sql<number>`count(*) filter (where ${stats_items.status} = 'draft')`.mapWith(Number),
        archived: sql<number>`count(*) filter (where ${stats_items.status} = 'archived')`.mapWith(Number),
        sum: sql<string | null>`sum(${stats_items.amount})`,
        avg: sql<string | null>`avg(${stats_items.amount})`,
      })
      .from(stats_items)
    // 与 Python 相同：GROUP BY 不带 ORDER BY（行序由 PostgreSQL 决定）
    const categoryRows = await this.db
      .select({
        category: stats_items.category,
        count: sql<number>`count(${stats_items.id})`.mapWith(Number),
        sum: sql<string | null>`sum(${stats_items.amount})`,
      })
      .from(stats_items)
      .groupBy(stats_items.category)
    return { counts: counts!, categoryRows }
  }
}
