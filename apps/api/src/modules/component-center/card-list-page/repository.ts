/**
 * 卡片列表页 repository 层（对齐 AuraStack backend/app/component_center/crud/card_list_page.py
 * 以及 service 里直接拼的查询）
 */

import { and, asc, count, desc, eq, ilike, inArray, ne, or, type SQL } from 'drizzle-orm'
import type { Executor } from '@/db/client'
import { card_items, type CardItem } from '@/db/schema'

export interface CardListFilters {
  search: string
  category: string
  owner: string
  isActive: boolean | null
  status: string
}

export type CardItemInsert = typeof card_items.$inferInsert
export type CardItemUpdate = Partial<Omit<CardItemInsert, 'id' | 'created_at' | 'updated_at'>>

export class CardListPageRepository {
  constructor(private readonly db: Executor) {}

  /** 对应 service._build_list_query */
  private listWhere(f: CardListFilters): SQL | undefined {
    const conds: (SQL | undefined)[] = []
    if (f.search) {
      conds.push(
        or(
          ilike(card_items.title, `%${f.search}%`),
          ilike(card_items.card_code, `%${f.search}%`),
          ilike(card_items.owner, `%${f.search}%`),
        ),
      )
    }
    if (f.category) conds.push(eq(card_items.category, f.category))
    if (f.owner) conds.push(ilike(card_items.owner, `%${f.owner}%`))
    if (f.isActive !== null) conds.push(eq(card_items.is_active, f.isActive))
    if (f.status) conds.push(eq(card_items.status, f.status))
    return conds.length > 0 ? and(...conds) : undefined
  }

  async listPage(page: number, perPage: number, filters: CardListFilters) {
    const where = this.listWhere(filters)
    const [totalRow] = await this.db.select({ n: count() }).from(card_items).where(where)
    const items = await this.db
      .select()
      .from(card_items)
      .where(where)
      .orderBy(desc(card_items.priority), desc(card_items.id))
      .limit(perPage)
      .offset((page - 1) * perPage)
    return { total: totalRow?.n ?? 0, items }
  }

  async listAllOrdered(filters: CardListFilters): Promise<CardItem[]> {
    return this.db.select().from(card_items).where(this.listWhere(filters)).orderBy(asc(card_items.id))
  }

  async listByIdsOrdered(ids: number[]): Promise<CardItem[]> {
    if (ids.length === 0) return []
    return this.db.select().from(card_items).where(inArray(card_items.id, ids)).orderBy(asc(card_items.id))
  }

  async getById(id: number): Promise<CardItem | null> {
    const [row] = await this.db.select().from(card_items).where(eq(card_items.id, id)).limit(1)
    return row ?? null
  }

  async getByCode(cardCode: string): Promise<CardItem | null> {
    const [row] = await this.db.select().from(card_items).where(eq(card_items.card_code, cardCode)).limit(1)
    return row ?? null
  }

  async existsOtherWithCode(cardCode: string, excludeId: number): Promise<boolean> {
    const [row] = await this.db
      .select({ id: card_items.id })
      .from(card_items)
      .where(and(eq(card_items.card_code, cardCode), ne(card_items.id, excludeId)))
      .limit(1)
    return Boolean(row)
  }

  async insert(values: CardItemInsert): Promise<CardItem> {
    const [row] = await this.db.insert(card_items).values(values).returning()
    return row!
  }

  /** 只在有变更列时调用（updated_at 由 $onUpdateFn 自动刷新，对齐 SQLAlchemy onupdate） */
  async update(id: number, values: CardItemUpdate): Promise<void> {
    await this.db.update(card_items).set(values).where(eq(card_items.id, id))
  }

  async delete(id: number): Promise<void> {
    await this.db.delete(card_items).where(eq(card_items.id, id))
  }
}
