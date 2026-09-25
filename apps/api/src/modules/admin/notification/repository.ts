/**
 * Notification repository layer
 */

import { and, count, desc, eq, inArray, notInArray, or, type SQL } from 'drizzle-orm'
import type { Executor } from '@/db/client'
import { utcNow } from '@/db/schema/columns'
import { notification_reads, notifications, type Notification } from '@/db/schema'

export type NotificationInsert = typeof notifications.$inferInsert

export class NotificationRepository {
  constructor(private readonly db: Executor) {}

  /** Visible to userId: global OR targeted at the user */
  private visible(userId: number): SQL {
    return or(eq(notifications.is_global, true), eq(notifications.user_id, userId))!
  }

  private readIds(userId: number) {
    return this.db
      .select({ id: notification_reads.notification_id })
      .from(notification_reads)
      .where(eq(notification_reads.user_id, userId))
  }

  async listPage(userId: number, page: number, perPage: number, isReadFilter: string) {
    const conds: SQL[] = [this.visible(userId)]
    if (isReadFilter === 'true') conds.push(inArray(notifications.id, this.readIds(userId)))
    else if (isReadFilter === 'false') conds.push(notInArray(notifications.id, this.readIds(userId)))
    const where = and(...conds)

    const [totalRow] = await this.db.select({ n: count() }).from(notifications).where(where)
    const rows = await this.db
      .select()
      .from(notifications)
      .where(where)
      .orderBy(desc(notifications.created_at))
      .limit(perPage)
      .offset((page - 1) * perPage)
    return { total: totalRow?.n ?? 0, rows }
  }

  /** Set of notification ids on this page already read by userId */
  async readSet(userId: number, ids: number[]): Promise<Set<number>> {
    if (ids.length === 0) return new Set()
    const rows = await this.db
      .select({ id: notification_reads.notification_id })
      .from(notification_reads)
      .where(and(inArray(notification_reads.notification_id, ids), eq(notification_reads.user_id, userId)))
    return new Set(rows.map((r) => r.id))
  }

  async insert(values: NotificationInsert): Promise<Notification> {
    const [row] = await this.db.insert(notifications).values(values).returning()
    return row!
  }

  async unreadCount(userId: number): Promise<number> {
    const [row] = await this.db
      .select({ n: count() })
      .from(notifications)
      .where(and(this.visible(userId), notInArray(notifications.id, this.readIds(userId))))
    return row?.n ?? 0
  }

  async getVisible(userId: number, id: number): Promise<Notification | null> {
    const [row] = await this.db
      .select()
      .from(notifications)
      .where(and(this.visible(userId), eq(notifications.id, id)))
      .limit(1)
    return row ?? null
  }

  async hasRead(userId: number, notificationId: number): Promise<boolean> {
    const [row] = await this.db
      .select({ id: notification_reads.id })
      .from(notification_reads)
      .where(and(eq(notification_reads.notification_id, notificationId), eq(notification_reads.user_id, userId)))
      .limit(1)
    return Boolean(row)
  }

  async insertRead(userId: number, notificationId: number): Promise<void> {
    await this.db.insert(notification_reads).values({ notification_id: notificationId, user_id: userId })
  }

  /** Mark all unread notifications visible to userId as read (same read_at); returns the number marked */
  async markAllRead(userId: number): Promise<number> {
    const unread = await this.db
      .select({ id: notifications.id })
      .from(notifications)
      .where(and(this.visible(userId), notInArray(notifications.id, this.readIds(userId))))
    if (unread.length === 0) return 0
    await this.db
      .insert(notification_reads)
      .values(unread.map((n) => ({ notification_id: n.id, user_id: userId, read_at: utcNow() })))
    return unread.length
  }

  async delete(id: number): Promise<void> {
    await this.db.delete(notifications).where(eq(notifications.id, id))
  }
}
