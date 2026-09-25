/**
 * Tree list page repository layer (includes queries the service builds directly)
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

/** `parent_id == n`: integers outside int4 never match */
function parentEquals(parentId: number): SQL {
  return isPgInt(parentId) ? eq(tree_nodes.parent_id, parentId) : sql`false`
}

export class TreeListPageRepository {
  constructor(private readonly db: Executor) {}

  /** Equivalent of service._build_flat_query */
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

  /** Left-side tree: flat nodes ordered by sort_order, id ascending */
  async listForTree(filters: TreeListFilters): Promise<TreeNode[]> {
    const conds = this.flatWhere(filters)
    return this.db
      .select()
      .from(tree_nodes)
      .where(conds.length > 0 ? and(...conds) : undefined)
      .orderBy(asc(tree_nodes.sort_order), asc(tree_nodes.id))
  }

  /** Right-side table: parentId 'root' → root nodes; a number → children of that parent; null → no filter */
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

  /** Only called when some column changed (updated_at is refreshed automatically by $onUpdateFn) */
  async update(id: number, values: TreeNodeUpdate): Promise<void> {
    await this.db.update(tree_nodes).set(values).where(eq(tree_nodes.id, id))
  }

  /**
   * Delete a node: before the DELETE, children are detached one by one via `UPDATE parent_id = NULL` (refreshing their updated_at);
   * the DB's ON DELETE SET NULL acts as a fallback.
   */
  async deleteWithChildrenDetached(id: number): Promise<void> {
    await this.db
      .update(tree_nodes)
      .set({ parent_id: null, updated_at: utcNow() })
      .where(eq(tree_nodes.parent_id, id))
    await this.db.delete(tree_nodes).where(eq(tree_nodes.id, id))
  }
}
