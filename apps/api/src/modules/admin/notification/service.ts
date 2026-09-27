/**
 * Notification service layer
 */

import { writeError } from '@/common/db-errors'
import { internalError, ServiceError } from '@/common/errors'
import type { Db } from '@/db/client'
import { notificationToDict } from '@/db/schema'
import { NotificationRepository } from './repository'
import type { NotificationInput } from './schema'

const PG_INT_MAX = 2_147_483_647

function inIntRange(id: number): boolean {
  return Number.isSafeInteger(id) && id <= PG_INT_MAX
}

export class NotificationService {
  private readonly repo: NotificationRepository

  constructor(private readonly db: Db) {
    this.repo = new NotificationRepository(db)
  }

  async listItems(userId: number, page: number, perPage: number, isReadFilter: string) {
    const { total, rows } = await this.repo.listPage(userId, page, perPage, isReadFilter)
    const readSet = await this.repo.readSet(userId, rows.map((r) => r.id))
    return {
      items: rows.map((n) => notificationToDict(n, readSet.has(n.id))),
      total,
      page,
      per_page: perPage,
    }
  }

  async createItem(values: NotificationInput) {
    const targetUserId = values.is_global ? null : values.user_id
    // A notification for one user needs that user: without one nobody would ever see it
    if (!values.is_global) {
      if (targetUserId === null) throw new ServiceError('请选择接收通知的用户', 400)
      if (!inIntRange(targetUserId) || !(await this.repo.userExists(targetUserId))) throw new ServiceError('接收通知的用户不存在', 400)
    }

    try {
      const created = await this.repo.insert({
        title: values.title,
        content: values.content ?? '',
        noti_type: values.noti_type,
        link: values.link || null,
        is_global: values.is_global,
        user_id: targetUserId,
      })
      return notificationToDict(created, false)
    } catch (err) {
      throw writeError(err)
    }
  }

  async unreadCount(userId: number) {
    return this.repo.unreadCount(userId)
  }

  async markRead(userId: number, notiId: number) {
    const notif = inIntRange(notiId) ? await this.repo.getVisible(userId, notiId) : null
    if (!notif) throw new ServiceError('通知不存在或无权限', 404)
    if (!(await this.repo.hasRead(userId, notiId))) {
      try {
        await this.repo.insertRead(userId, notiId)
      } catch (err) {
        throw internalError(err)
      }
    }
    return { success: true }
  }

  async markAllRead(userId: number) {
    let marked: number
    try {
      marked = await this.db.transaction((tx) => new NotificationRepository(tx).markAllRead(userId))
    } catch (err) {
      throw internalError(err)
    }
    return { success: true, marked }
  }

  async deleteItem(userId: number, notiId: number, canDeleteGlobal: boolean) {
    const notif = inIntRange(notiId) ? await this.repo.getVisible(userId, notiId) : null
    if (!notif) throw new ServiceError('通知不存在或无权限', 404)
    if (notif.is_global && !canDeleteGlobal) throw new ServiceError('无权限删除全局通知', 403)
    try {
      await this.repo.delete(notif.id)
    } catch (err) {
      throw internalError(err)
    }
    return { success: true }
  }
}
