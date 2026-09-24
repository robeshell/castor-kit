/**
 * 自引用树（parent_id 指向同表 id）的公共工具
 */

import { sql } from 'drizzle-orm'
import type { Executor } from '@/db/client'

/** 向上追溯祖先的最大层数：库里已经存在环时也能终止 */
const MAX_DEPTH = 1000

/**
 * 把 nodeId 的父节点改成 newParentId 是否会成环：newParentId 等于 nodeId，或 nodeId 是 newParentId 的祖先。
 * 做法是从 newParentId 沿 parent_id 向上走，途中遇到 nodeId 即成环。
 * table 必须是代码里的常量表名（不接受用户输入）。
 */
export async function wouldCreateCycle(
  db: Executor,
  table: 'menus' | 'tree_nodes',
  nodeId: number,
  newParentId: number,
): Promise<boolean> {
  if (newParentId === nodeId) return true
  const t = sql.identifier(table)
  const result = await db.execute<{ hit: number }>(sql`
    WITH RECURSIVE ancestors(id, parent_id, depth) AS (
      SELECT id, parent_id, 0 FROM ${t} WHERE id = ${newParentId}
      UNION ALL
      SELECT p.id, p.parent_id, a.depth + 1
      FROM ${t} p JOIN ancestors a ON p.id = a.parent_id
      WHERE a.depth < ${MAX_DEPTH}
    )
    SELECT 1 AS hit FROM ancestors WHERE id = ${nodeId} LIMIT 1
  `)
  return result.rows.length > 0
}
