/**
 * stats_items
 * 对齐 AuraStack backend/app/component_center/model/entities_stats_list_page.py
 */

import { boolean, integer, numeric, pgTable, serial, text, unique, varchar } from 'drizzle-orm/pg-core'
import { toIso } from '@/common/serialize'
import { createdAt, updatedAt } from '../columns'

export const stats_items = pgTable('stats_items', {
  id: serial().primaryKey().notNull(),
  name: varchar({ length: 120 }).notNull(),
  item_code: varchar({ length: 120 }).notNull(),
  // Python: default='general'（应用侧默认，库里无 DEFAULT）
  category: varchar({ length: 50 }).$default(() => 'general'),
  status: varchar({ length: 20 }).default('draft').notNull(),
  amount: numeric({ precision: 14, scale: 2 }).default('0'),
  quantity: integer().default(0),
  owner: varchar({ length: 100 }),
  priority: integer().default(0),
  is_active: boolean().default(true),
  description: text(),
  created_at: createdAt(),
  updated_at: updatedAt(),
}, (table) => [
  unique('stats_items_item_code_key').on(table.item_code),
])

export type StatsItem = typeof stats_items.$inferSelect

/** Python `float(Decimal)`：numeric 文本 → JS number（该模块 to_dict 显式转 float，输出 JSON 数字） */
export function numericToFloat(value: string | null | undefined): number {
  return value === null || value === undefined ? 0 : Number(value)
}

export function statsItemToDict(item: StatsItem) {
  return {
    id: item.id,
    name: item.name,
    item_code: item.item_code,
    category: item.category,
    status: item.status || 'draft',
    amount: numericToFloat(item.amount),
    quantity: item.quantity ?? 0,
    owner: item.owner,
    priority: item.priority ?? 0,
    is_active: item.is_active,
    description: item.description,
    created_at: toIso(item.created_at),
    updated_at: toIso(item.updated_at),
  }
}
