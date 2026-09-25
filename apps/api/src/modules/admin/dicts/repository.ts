/**
 * Data dictionary repository layer
 */

import { and, asc, count, eq, ilike, inArray, ne, or, type SQL } from 'drizzle-orm'
import type { Executor } from '@/db/client'
import { dict_items, dict_types, type DictItem, type DictType } from '@/db/schema'

export type DictTypeInsert = typeof dict_types.$inferInsert
export type DictTypeUpdate = Partial<DictTypeInsert>
export type DictItemInsert = typeof dict_items.$inferInsert
export type DictItemUpdate = Partial<DictItemInsert>

const ITEM_ORDER = [asc(dict_items.sort_order), asc(dict_items.id)]

export class DictsRepository {
  constructor(private readonly db: Executor) {}

  // ---------------------------------------------------------------- dict_types

  async getType(id: number): Promise<DictType | null> {
    const [row] = await this.db.select().from(dict_types).where(eq(dict_types.id, id)).limit(1)
    return row ?? null
  }

  async getTypeByCode(code: string): Promise<DictType | null> {
    const [row] = await this.db.select().from(dict_types).where(eq(dict_types.code, code)).limit(1)
    return row ?? null
  }

  async getTypeByCodeExcluding(code: string, excludeId: number): Promise<DictType | null> {
    const [row] = await this.db
      .select()
      .from(dict_types)
      .where(and(eq(dict_types.code, code), ne(dict_types.id, excludeId)))
      .limit(1)
    return row ?? null
  }

  async listActiveTypesByCodes(codes: string[]): Promise<DictType[]> {
    if (codes.length === 0) return []
    return this.db
      .select()
      .from(dict_types)
      .where(and(inArray(dict_types.code, codes), eq(dict_types.is_active, true)))
  }

  async listTypesPage(page: number, perPage: number, search: string, isActive: boolean | null) {
    const conds: SQL[] = []
    if (search) conds.push(or(ilike(dict_types.name, `%${search}%`), ilike(dict_types.code, `%${search}%`))!)
    if (isActive !== null) conds.push(eq(dict_types.is_active, isActive))
    const where = conds.length > 0 ? and(...conds) : undefined
    const [totalRow] = await this.db.select({ n: count() }).from(dict_types).where(where)
    const rows = await this.db
      .select()
      .from(dict_types)
      .where(where)
      .orderBy(asc(dict_types.sort_order), asc(dict_types.id))
      .limit(perPage)
      .offset((page - 1) * perPage)
    return { total: totalRow?.n ?? 0, rows }
  }

  /** Item count per dict type (item_count in DictType.to_dict) */
  async countItemsByTypeIds(typeIds: number[]): Promise<Map<number, number>> {
    const result = new Map<number, number>()
    if (typeIds.length === 0) return result
    const rows = await this.db
      .select({ typeId: dict_items.dict_type_id, n: count() })
      .from(dict_items)
      .where(inArray(dict_items.dict_type_id, typeIds))
      .groupBy(dict_items.dict_type_id)
    for (const row of rows) result.set(row.typeId, row.n)
    return result
  }

  async countItems(typeId: number): Promise<number> {
    const [row] = await this.db.select({ n: count() }).from(dict_items).where(eq(dict_items.dict_type_id, typeId))
    return row?.n ?? 0
  }

  async insertType(values: DictTypeInsert): Promise<DictType> {
    const [row] = await this.db.insert(dict_types).values(values).returning()
    return row!
  }

  async updateType(id: number, values: DictTypeUpdate): Promise<void> {
    await this.db.update(dict_types).set(values).where(eq(dict_types.id, id))
  }

  async deleteType(id: number): Promise<void> {
    await this.db.delete(dict_types).where(eq(dict_types.id, id))
  }

  // ---------------------------------------------------------------- dict_items

  async getItem(id: number): Promise<DictItem | null> {
    const [row] = await this.db.select().from(dict_items).where(eq(dict_items.id, id)).limit(1)
    return row ?? null
  }

  async getItemByTypeValue(typeId: number, value: string): Promise<DictItem | null> {
    const [row] = await this.db
      .select()
      .from(dict_items)
      .where(and(eq(dict_items.dict_type_id, typeId), eq(dict_items.value, value)))
      .limit(1)
    return row ?? null
  }

  async getItemDuplicate(typeId: number, value: string, excludeId: number): Promise<DictItem | null> {
    const [row] = await this.db
      .select()
      .from(dict_items)
      .where(and(eq(dict_items.dict_type_id, typeId), eq(dict_items.value, value), ne(dict_items.id, excludeId)))
      .limit(1)
    return row ?? null
  }

  async listItemsOrdered(typeId: number): Promise<DictItem[]> {
    return this.db
      .select()
      .from(dict_items)
      .where(eq(dict_items.dict_type_id, typeId))
      .orderBy(...ITEM_ORDER)
  }

  async listActiveItemsOrdered(typeId: number): Promise<DictItem[]> {
    return this.db
      .select()
      .from(dict_items)
      .where(and(eq(dict_items.dict_type_id, typeId), eq(dict_items.is_active, true)))
      .orderBy(...ITEM_ORDER)
  }

  async listItemsFiltered(typeId: number, search: string, isActive: boolean | null): Promise<DictItem[]> {
    const conds: SQL[] = [eq(dict_items.dict_type_id, typeId)]
    if (search) conds.push(or(ilike(dict_items.label, `%${search}%`), ilike(dict_items.value, `%${search}%`))!)
    if (isActive !== null) conds.push(eq(dict_items.is_active, isActive))
    return this.db
      .select()
      .from(dict_items)
      .where(and(...conds))
      .orderBy(...ITEM_ORDER)
  }

  async insertItem(values: DictItemInsert): Promise<DictItem> {
    const [row] = await this.db.insert(dict_items).values(values).returning()
    return row!
  }

  async updateItem(id: number, values: DictItemUpdate): Promise<void> {
    await this.db.update(dict_items).set(values).where(eq(dict_items.id, id))
  }

  async deleteItem(id: number): Promise<void> {
    await this.db.delete(dict_items).where(eq(dict_items.id, id))
  }

  /** Unset the default flag on all other items in the same dict (except excludeId) */
  async clearDefaultExcludingId(typeId: number, excludeId: number): Promise<void> {
    await this.db
      .update(dict_items)
      .set({ is_default: false })
      .where(and(eq(dict_items.dict_type_id, typeId), ne(dict_items.id, excludeId), eq(dict_items.is_default, true)))
  }

  /** Unset the default flag on all other items in the same dict (except keepValue) */
  async clearDefaultKeepingValue(typeId: number, keepValue: string): Promise<void> {
    await this.db
      .update(dict_items)
      .set({ is_default: false })
      .where(and(eq(dict_items.dict_type_id, typeId), ne(dict_items.value, keepValue), eq(dict_items.is_default, true)))
  }
}
