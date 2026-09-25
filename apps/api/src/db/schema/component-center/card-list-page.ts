/**
 * card_items
 */

import { boolean, integer, pgTable, serial, text, unique, varchar } from 'drizzle-orm/pg-core'
import { toIso } from '@/common/serialize'
import { createdAt, updatedAt } from '../columns'

export const card_items = pgTable('card_items', {
  id: serial().primaryKey().notNull(),
  title: varchar({ length: 120 }).notNull(),
  card_code: varchar({ length: 120 }).notNull(),
  subtitle: varchar({ length: 200 }),
  // 应用侧默认 'general'（库里无 DEFAULT）
  category: varchar({ length: 50 }).$default(() => 'general'),
  cover_url: varchar({ length: 500 }),
  tag: varchar({ length: 50 }),
  status: varchar({ length: 20 }).default('draft').notNull(),
  owner: varchar({ length: 100 }),
  priority: integer().default(0),
  is_active: boolean().default(true),
  description: text(),
  created_at: createdAt(),
  updated_at: updatedAt(),
}, (table) => [
  unique('card_items_card_code_key').on(table.card_code),
])

export type CardItem = typeof card_items.$inferSelect

export function cardItemToDict(item: CardItem) {
  return {
    id: item.id,
    title: item.title,
    card_code: item.card_code,
    subtitle: item.subtitle,
    category: item.category,
    cover_url: item.cover_url,
    tag: item.tag,
    status: item.status || 'draft',
    owner: item.owner,
    priority: item.priority ?? 0,
    is_active: item.is_active,
    description: item.description,
    created_at: toIso(item.created_at),
    updated_at: toIso(item.updated_at),
  }
}
