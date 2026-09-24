/**
 * announcements
 * 对齐 AuraStack backend/app/admin/model/entities_announcement.py
 *
 * `.$default()` / createdAt() / updatedAt() 只是应用侧默认值（对应 SQLAlchemy `default=`），不进 DDL。
 * SQLAlchemy 插入时会跳过值为 None 的列（从而触发 default），调用方插入前应把 null 转成 undefined。
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
