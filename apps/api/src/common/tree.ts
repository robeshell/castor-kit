/**
 * Shared helpers for self-referencing trees (parent_id points to an id in the same table)
 */

import { sql } from 'drizzle-orm'
import type { Executor } from '@/db/client'

/** Max depth when walking up ancestors: guarantees termination even if the DB already contains a cycle */
const MAX_DEPTH = 1000

/**
 * Whether changing nodeId's parent to newParentId creates a cycle: newParentId equals nodeId, or nodeId is an ancestor of newParentId.
 * Walks up from newParentId along parent_id; meeting nodeId on the way means a cycle.
 * table must be a constant table name from code (never user input).
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
