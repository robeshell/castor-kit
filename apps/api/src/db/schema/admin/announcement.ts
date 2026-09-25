/**
 * announcements
 *
 * `.$default()` / createdAt() / updatedAt() 只是应用侧默认值（库里没有 DEFAULT），不进 DDL。
 * 插入时值为 null 的列要转成 undefined（省略该列）才会触发应用侧默认值。
 */

import { boolean, integer, pgTable, serial, text, timestamp, varchar } from 'drizzle-orm/pg-core'
import { toIso } from '@/common/serialize'
import { createdAt, updatedAt } from '../columns'

export const announcements = pgTable('announcements', {
  id: serial().primaryKey().notNull(),
  title: varchar({ length: 100 }).notNull(),
  content: text(),
  announce_type: varchar({ length: 20 }).notNull().$default(() => 'system'),
  status: varchar({ length: 20 }).notNull().$default(() => 'draft'),
  is_top: boolean().$default(() => false),
  sort_order: integer().$default(() => 0),
  publish_at: timestamp({ mode: 'string' }),
  created_at: createdAt(),
  updated_at: updatedAt(),
})

export type Announcement = typeof announcements.$inferSelect

export function announcementToDict(item: Announcement) {
  return {
    id: item.id,
    title: item.title,
    content: item.content,
    announce_type: item.announce_type,
    status: item.status,
    is_top: item.is_top,
    sort_order: item.sort_order,
    publish_at: toIso(item.publish_at),
    created_at: toIso(item.created_at),
    updated_at: toIso(item.updated_at),
  }
}
