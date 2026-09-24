/**
 * 菜单模块 repository 层（对齐 AuraStack backend/app/admin/crud/menu.py）
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

  /** 给定菜单 id 及其全部祖先 id（递归 CTE，替代 Python 逐级访问 menu.parent 的 N 次查询） */
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

  /** 按 id 取菜单，排序 sort_order ASC, id ASC（与 Python 一致，NULL sort_order 排最后） */
  async listByIdsOrdered(ids: number[]): Promise<Menu[]> {
    if (ids.length === 0) return []
    return this.db
      .select()
      .from(menus)
      .where(inArray(menus.id, ids))
      .orderBy(asc(menus.sort_order), asc(menus.id))
  }

  /** 树形列表的根节点（search 只过滤根节点） */
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
   * `menu.children.order_by('sort_order')`：只按 sort_order 排序（同值的先后由 PG 执行计划决定），
   * 所以逐节点执行与 SQLAlchemy 同形状的查询，而不是一次取全表后在内存里排序。
   */
  async listChildrenPyOrder(parentId: number): Promise<Menu[]> {
    return this.db.select().from(menus).where(eq(menus.parent_id, parentId)).orderBy(asc(menus.sort_order))
  }

  /** 同级菜单（parent_id IS NULL 或 = parentId），sort_order ASC, id ASC */
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

  /** 导出 parent_code：按 id 取 code */
  async mapCodesByIds(ids: number[]): Promise<Map<number, string>> {
    if (ids.length === 0) return new Map()
    const rows = await this.db.select({ id: menus.id, code: menus.code }).from(menus).where(inArray(menus.id, ids))
    return new Map(rows.map((r) => [r.id, r.code]))
  }

  async listForExportFiltered(search: string): Promise<Menu[]> {
    return this.listFlat(search)
  }

  /** `sync_id_sequence`：显式 ID 插入后把序列推到 MAX(id)+1 */
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

  /** 更新并刷新 updated_at（对应 onupdate=datetime.utcnow；调用方只在确有变化时调用） */
  async update(id: number, values: MenuUpdateValues): Promise<Menu> {
    const [row] = await this.db.update(menus).set(values).where(eq(menus.id, id)).returning()
    return row!
  }

  async delete(id: number): Promise<void> {
    await this.db.delete(menus).where(eq(menus.id, id))
  }
}
