/**
 * 树形列表页 repository 层（对齐 AuraStack backend/app/component_center/crud/tree_list_page.py
 * 以及 service 里直接拼的查询）
 */

import { and, asc, count, eq, ilike, inArray, isNull, ne, or, sql, type SQL } from 'drizzle-orm'
import type { Executor } from '@/db/client'
import { utcNow } from '@/db/schema/columns'
import { tree_nodes, type TreeNode } from '@/db/schema'
import { isPgInt } from './schema'

export interface TreeListFilters {
  search: string
  nodeType: string
  status: string
  owner: string
  isActive: boolean | null
}

export type TreeNodeInsert = typeof tree_nodes.$inferInsert
export type TreeNodeUpdate = Partial<Omit<TreeNodeInsert, 'id' | 'created_at' | 'updated_at'>>

/** `parent_id == n`：超出 int4 的整数不会命中 */
function parentEquals(parentId: number): SQL {
  return isPgInt(parentId) ? eq(tree_nodes.parent_id, parentId) : sql`false`
}

export class TreeListPageRepository {
  constructor(private readonly db: Executor) {}

  /** 对应 service._build_flat_query */
  private flatWhere(f: TreeListFilters): SQL[] {
    const conds: SQL[] = []
    if (f.search) {
      conds.push(
        or(
          ilike(tree_nodes.name, `%${f.search}%`),
          ilike(tree_nodes.node_code, `%${f.search}%`),
          ilike(tree_nodes.owner, `%${f.search}%`),
        )!,
      )
    }
    if (f.nodeType) conds.push(eq(tree_nodes.node_type, f.nodeType))
    if (f.status) conds.push(eq(tree_nodes.status, f.status))
    if (f.owner) conds.push(ilike(tree_nodes.owner, `%${f.owner}%`))
    if (f.isActive !== null) conds.push(eq(tree_nodes.is_active, f.isActive))
    return conds
  }

  /** 左侧树：按 sort_order、id 升序的平铺节点 */
  async listForTree(filters: TreeListFilters): Promise<TreeNode[]> {
    const conds = this.flatWhere(filters)
    return this.db
      .select()
      .from(tree_nodes)
      .where(conds.length > 0 ? and(...conds) : undefined)
      .orderBy(asc(tree_nodes.sort_order), asc(tree_nodes.id))
  }

  /** 右侧表格：parentId 为 'root' 取根节点，为数字取该父节点下的子节点，为 null 不限 */
  async listPage(page: number, perPage: number, filters: TreeListFilters, parentId: 'root' | number | null) {
    const conds = this.flatWhere(filters)
    if (parentId === 'root') conds.push(isNull(tree_nodes.parent_id))
    else if (parentId !== null) conds.push(parentEquals(parentId))
    const where = conds.length > 0 ? and(...conds) : undefined
    const [totalRow] = await this.db.select({ n: count() }).from(tree_nodes).where(where)
    const items = await this.db
      .select()
      .from(tree_nodes)
      .where(where)
      .orderBy(asc(tree_nodes.sort_order), asc(tree_nodes.id))
      .limit(perPage)
      .offset((page - 1) * perPage)
    return { total: totalRow?.n ?? 0, items }
  }

  async listAllOrdered(filters: TreeListFilters): Promise<TreeNode[]> {
    const conds = this.flatWhere(filters)
    return this.db
      .select()
      .from(tree_nodes)
      .where(conds.length > 0 ? and(...conds) : undefined)
      .orderBy(asc(tree_nodes.id))
  }

  async listByIdsOrdered(ids: number[]): Promise<TreeNode[]> {
    if (ids.length === 0) return []
    return this.db.select().from(tree_nodes).where(inArray(tree_nodes.id, ids)).orderBy(asc(tree_nodes.id))
  }

  async getById(id: number): Promise<TreeNode | null> {
    const [row] = await this.db.select().from(tree_nodes).where(eq(tree_nodes.id, id)).limit(1)
    return row ?? null
  }

  async exists(id: number): Promise<boolean> {
    if (!isPgInt(id)) return false
    const [row] = await this.db.select({ id: tree_nodes.id }).from(tree_nodes).where(eq(tree_nodes.id, id)).limit(1)
    return Boolean(row)
  }

  async getByCode(nodeCode: string): Promise<TreeNode | null> {
    const [row] = await this.db.select().from(tree_nodes).where(eq(tree_nodes.node_code, nodeCode)).limit(1)
    return row ?? null
  }

  async existsOtherWithCode(nodeCode: string, excludeId: number): Promise<boolean> {
    const [row] = await this.db
      .select({ id: tree_nodes.id })
      .from(tree_nodes)
      .where(and(eq(tree_nodes.node_code, nodeCode), ne(tree_nodes.id, excludeId)))
      .limit(1)
    return Boolean(row)
  }

  async insert(values: TreeNodeInsert): Promise<TreeNode> {
    const [row] = await this.db.insert(tree_nodes).values(values).returning()
    return row!
  }

  /** 只在有变更列时调用（updated_at 由 $onUpdateFn 自动刷新，对齐 SQLAlchemy onupdate） */
  async update(id: number, values: TreeNodeUpdate): Promise<void> {
    await this.db.update(tree_nodes).set(values).where(eq(tree_nodes.id, id))
  }

  /**
   * 删除节点。SQLAlchemy 的 children 关系（未设 passive_deletes）会在 DELETE 前把子节点逐个
   * `UPDATE parent_id = NULL`（触发 onupdate，子节点 updated_at 刷新），这里显式做同样的事；
   * 库里的 ON DELETE SET NULL 兜底。
   */
  async deleteWithChildrenDetached(id: number): Promise<void> {
    await this.db
      .update(tree_nodes)
      .set({ parent_id: null, updated_at: utcNow() })
      .where(eq(tree_nodes.parent_id, id))
    await this.db.delete(tree_nodes).where(eq(tree_nodes.id, id))
  }
}
