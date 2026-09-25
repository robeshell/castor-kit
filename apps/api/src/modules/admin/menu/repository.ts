/**
 * Menu module repository layer
 */

import { and, asc, count, eq, ilike, inArray, isNull, or, sql, type SQL } from 'drizzle-orm'
import type { Executor } from '@/db/client'
import { menus, type Menu } from '@/db/schema'

export type NewMenuValues = typeof menus.$inferInsert
export type MenuUpdateValues = Partial<Omit<NewMenuValues, 'id' | 'created_at' | 'updated_at'>>

export class MenuRepository {
  constructor(private readonly db: Executor) {}

  private searchWhere(search: string): SQL | undefined {
    return search ? or(ilike(menus.name, `%${search}%`), ilike(menus.code, `%${search}%`)) : undefined
  }

  /** The given menu ids plus all their ancestor ids (one recursive CTE instead of N queries walking up parent by parent) */
  async listIdsWithAncestors(ids: number[]): Promise<number[]> {
    if (ids.length === 0) return []
    const result = await this.db.execute<{ id: number }>(sql`
      WITH RECURSIVE chain AS (
        SELECT id, parent_id FROM ${menus} WHERE id IN ${ids}
        UNION
        SELECT m.id, m.parent_id FROM ${menus} m JOIN chain c ON m.id = c.parent_id
      )
      SELECT id FROM chain
    `)
    return result.rows.map((r) => r.id)
  }

  /** Fetch menus by id, ordered by sort_order ASC, id ASC (NULL sort_order last) */
  async listByIdsOrdered(ids: number[]): Promise<Menu[]> {
    if (ids.length === 0) return []
    return this.db
      .select()
      .from(menus)
      .where(inArray(menus.id, ids))
      .orderBy(asc(menus.sort_order), asc(menus.id))
  }

  /** Root nodes (search matches the root node itself only; tree search is handled by service.searchTree) */
  async listRoots(search: string): Promise<Menu[]> {
    return this.db
      .select()
      .from(menus)
      .where(and(this.searchWhere(search), isNull(menus.parent_id)))
      .orderBy(asc(menus.sort_order), asc(menus.id))
  }

  async listFlat(search: string): Promise<Menu[]> {
    return this.db.select().from(menus).where(this.searchWhere(search)).orderBy(asc(menus.sort_order), asc(menus.id))
  }

  /**
   * Direct children of a menu: ordered by sort_order only (ties are ordered by the PG query plan),
   * so we run a fixed-shape query per node to keep the existing order, instead of loading the whole table and sorting in memory.
   */
  async listChildrenPyOrder(parentId: number): Promise<Menu[]> {
    return this.db.select().from(menus).where(eq(menus.parent_id, parentId)).orderBy(asc(menus.sort_order))
  }

  /** Sibling menus (parent_id IS NULL or = parentId), sort_order ASC, id ASC */
  async listSiblings(parentId: number | null): Promise<Menu[]> {
    return this.db
      .select()
      .from(menus)
      .where(parentId === null ? isNull(menus.parent_id) : eq(menus.parent_id, parentId))
      .orderBy(asc(menus.sort_order), asc(menus.id))
  }

  async getById(id: number): Promise<Menu | null> {
    const [row] = await this.db.select().from(menus).where(eq(menus.id, id)).limit(1)
    return row ?? null
  }

  async getByCode(code: string): Promise<Menu | null> {
    const [row] = await this.db.select().from(menus).where(eq(menus.code, code)).limit(1)
    return row ?? null
  }

  async listAll(): Promise<Menu[]> {
    return this.db.select().from(menus)
  }

  async countChildren(id: number): Promise<number> {
    const [row] = await this.db.select({ n: count() }).from(menus).where(eq(menus.parent_id, id))
    return row?.n ?? 0
  }

  /** parent_code for export: look up code by id */
  async mapCodesByIds(ids: number[]): Promise<Map<number, string>> {
    if (ids.length === 0) return new Map()
    const rows = await this.db.select({ id: menus.id, code: menus.code }).from(menus).where(inArray(menus.id, ids))
    return new Map(rows.map((r) => [r.id, r.code]))
  }

  async listForExportFiltered(search: string): Promise<Menu[]> {
    return this.listFlat(search)
  }

  /** `sync_id_sequence`: after inserts with explicit ids, advance the sequence to MAX(id)+1 */
  async syncIdSequence(): Promise<void> {
    await this.db.execute(sql`
      SELECT setval(
        pg_get_serial_sequence('menus', 'id'),
        COALESCE((SELECT MAX(id) FROM menus), 0) + 1,
        false
      )
    `)
  }

  async insert(values: NewMenuValues): Promise<Menu> {
    const [row] = await this.db.insert(menus).values(values).returning()
    return row!
  }

  /** Update and refresh updated_at (matches onupdate=datetime.utcnow; callers only call this when something actually changed) */
  async update(id: number, values: MenuUpdateValues): Promise<Menu> {
    const [row] = await this.db.update(menus).set(values).where(eq(menus.id, id)).returning()
    return row!
  }

  async delete(id: number): Promise<void> {
    await this.db.delete(menus).where(eq(menus.id, id))
  }
}
