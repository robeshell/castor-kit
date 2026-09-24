/**
 * tree_nodes
 * 对齐 AuraStack backend/app/component_center/model/entities_tree_list_page.py
 *
 * parent_id 外键 ON DELETE SET NULL；SQLAlchemy 的 children/parent 自引用关系对应下方 relations。
 */

import { relations } from 'drizzle-orm'
import { boolean, foreignKey, integer, pgTable, serial, text, unique, varchar } from 'drizzle-orm/pg-core'
import { toIso } from '@/common/serialize'
import { createdAt, updatedAt } from '../columns'

export const tree_nodes = pgTable('tree_nodes', {
  id: serial().primaryKey().notNull(),
  name: varchar({ length: 100 }).notNull(),
  node_code: varchar({ length: 120 }).notNull(),
  parent_id: integer(),
  node_type: varchar({ length: 50 }).default('category'),
  icon: varchar({ length: 100 }),
  description: text(),
  sort_order: integer().default(0),
  is_active: boolean().default(true),
  status: varchar({ length: 20 }).default('active'),
  owner: varchar({ length: 100 }),
  created_at: createdAt(),
  updated_at: updatedAt(),
}, (table) => [
  foreignKey({
      columns: [table.parent_id],
      foreignColumns: [table.id],
      name: 'tree_nodes_parent_id_fkey'
    }).onDelete('set null'),
  unique('tree_nodes_node_code_key').on(table.node_code),
])

export const tree_nodes_relations = relations(tree_nodes, ({ one, many }) => ({
  parent: one(tree_nodes, { fields: [tree_nodes.parent_id], references: [tree_nodes.id], relationName: 'tree_node_parent' }),
  children: many(tree_nodes, { relationName: 'tree_node_parent' }),
}))

export type TreeNode = typeof tree_nodes.$inferSelect

export function treeNodeToDict(node: TreeNode) {
  return {
    id: node.id,
    name: node.name,
    node_code: node.node_code,
    parent_id: node.parent_id,
    node_type: node.node_type || 'category',
    icon: node.icon,
    description: node.description,
    sort_order: node.sort_order ?? 0,
    is_active: node.is_active,
    status: node.status || 'active',
    owner: node.owner,
    created_at: toIso(node.created_at),
    updated_at: toIso(node.updated_at),
  }
}

/** Python `to_tree_dict()`：to_dict + 直接子节点数（childrenCount 由调用方查询） */
export function treeNodeToTreeDict(node: TreeNode, childrenCount: number) {
  return { ...treeNodeToDict(node), children_count: childrenCount }
}
