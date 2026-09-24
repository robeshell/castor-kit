/**
 * notifications / notification_reads
 * 对齐 AuraStack backend/app/admin/model/entities_notification.py
 *
 * `.$default()` / createdAt() 只是应用侧默认值（对应 SQLAlchemy `default=`），不进 DDL；
 * noti_type / is_global 另有库级 DEFAULT（DDL 里的 `.default()`，保持原样）。
 */

import { relations } from 'drizzle-orm'
import { boolean, foreignKey, integer, pgTable, serial, text, unique, varchar } from 'drizzle-orm/pg-core'
import { toIso } from '@/common/serialize'
import { createdAt } from '../columns'
import { admin_users } from './rbac'

export const notifications = pgTable('notifications', {
  id: serial().primaryKey().notNull(),
  title: varchar({ length: 200 }).notNull(),
  content: text(),
  noti_type: varchar({ length: 20 }).default('info').notNull(),
  link: varchar({ length: 500 }),
  is_global: boolean().default(true),
  user_id: integer(),
  created_at: createdAt(),
}, (table) => [
  foreignKey({
      columns: [table.user_id],
      foreignColumns: [admin_users.id],
      name: 'notifications_user_id_fkey'
    }).onDelete('cascade'),
])

export const notification_reads = pgTable('notification_reads', {
  id: serial().primaryKey().notNull(),
  notification_id: integer().notNull(),
  user_id: integer().notNull(),
  /** `default=datetime.utcnow` */
  read_at: createdAt(),
}, (table) => [
  foreignKey({
      columns: [table.notification_id],
      foreignColumns: [notifications.id],
      name: 'notification_reads_notification_id_fkey'
    }).onDelete('cascade'),
  foreignKey({
      columns: [table.user_id],
      foreignColumns: [admin_users.id],
      name: 'notification_reads_user_id_fkey'
    }).onDelete('cascade'),
  unique('notification_reads_notification_id_user_id_key').on(table.notification_id, table.user_id),
])

export const notifications_relations = relations(notifications, ({ one, many }) => ({
  user: one(admin_users, { fields: [notifications.user_id], references: [admin_users.id] }),
  reads: many(notification_reads),
}))

export const notification_reads_relations = relations(notification_reads, ({ one }) => ({
  notification: one(notifications, { fields: [notification_reads.notification_id], references: [notifications.id] }),
  user: one(admin_users, { fields: [notification_reads.user_id], references: [admin_users.id] }),
}))

export type Notification = typeof notifications.$inferSelect
export type NotificationRead = typeof notification_reads.$inferSelect

/** Notification.to_dict(is_read) */
export function notificationToDict(item: Notification, isRead = false) {
  return {
    id: item.id,
    title: item.title,
    content: item.content,
    noti_type: item.noti_type,
    link: item.link,
    is_global: item.is_global,
    user_id: item.user_id,
    created_at: toIso(item.created_at),
    is_read: isRead,
  }
}
