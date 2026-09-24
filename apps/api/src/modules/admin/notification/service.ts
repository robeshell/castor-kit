/**
 * 通知消息 service 层（对齐 AuraStack backend/app/admin/service/notification.py）
 */

import { ServiceError } from '@/common/errors'
import { pyTruthy } from '@/common/py'
import type { Db } from '@/db/client'
import { notificationToDict } from '@/db/schema'
import { bindInt, bindText, omitNull } from '@/common/sqla-bind'
import { NotificationRepository } from './repository'
import { normalizeNotiType, stripOrEmpty } from './schema'

type Data = Record<string, unknown>

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

  async createItem(data: Data) {
    const title = stripOrEmpty(data.title)
    if (!title) throw new ServiceError('标题不能为空', 400)
    const notiType = normalizeNotiType('noti_type' in data ? data.noti_type : 'info')
    const isGlobal = pyTruthy('is_global' in data ? data.is_global : true)
    const targetUserId = isGlobal ? null : data.user_id

    try {
      const created = await this.repo.insert({
        title,
        content: omitNull(bindText(pyTruthy(data.content) ? data.content : '')),
        noti_type: notiType,
        link: omitNull(bindText(pyTruthy(data.link) ? data.link : null)),
        is_global: isGlobal,
        user_id: omitNull(bindInt(targetUserId)),
      })
      return notificationToDict(created, false)
    } catch {
      throw new ServiceError('创建通知失败，请稍后重试', 500)
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
      } catch {
        throw new ServiceError('操作失败，请稍后重试', 500)
      }
    }
    return { success: true }
  }

  async markAllRead(userId: number) {
    let marked: number
    try {
      marked = await this.db.transaction((tx) => new NotificationRepository(tx).markAllRead(userId))
    } catch {
      throw new ServiceError('操作失败，请稍后重试', 500)
    }
    return { success: true, marked }
  }

  async deleteItem(userId: number, notiId: number, canDeleteGlobal: boolean) {
    const notif = inIntRange(notiId) ? await this.repo.getVisible(userId, notiId) : null
    if (!notif) throw new ServiceError('通知不存在或无权限', 404)
    if (notif.is_global && !canDeleteGlobal) throw new ServiceError('无权限删除全局通知', 403)
    try {
      await this.repo.delete(notif.id)
    } catch {
      throw new ServiceError('删除失败，请稍后重试', 500)
    }
    return { success: true }
  }
}
