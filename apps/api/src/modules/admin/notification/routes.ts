/**
 * 通知消息路由
 *
 * 所有登录用户可用：列表 / 未读数 / 已读 / 删除按“全局 OR 专属于当前用户”的可见性过滤；
 * 仅新增需要 system_notifications_add，删除全局通知需要 system_notifications_delete。
 */

import type { FastifyInstance, FastifyRequest } from 'fastify'
import { getCurrentAdminUser, hasMenuPermission, loginRequired } from '@/common/auth'
import { intParam, jsonBody, queryString } from '@/common/http'
import { parsePagination } from '@/common/pagination'
import { NotificationService } from './service'

const USER_NOT_FOUND = { error: '用户不存在' }

export async function registerNotificationRoutes(app: FastifyInstance): Promise<void> {
  const service = new NotificationService(app.db)
  const opts = { preHandler: loginRequired }
  // 超出 integer 范围的 id 不报 get_or_404，而是走 service 的“通知不存在或无权限”（service 里是普通条件查询）
  const notiIdOf = (request: FastifyRequest) => Number((request.params as { noti_id: string }).noti_id)

  app.get('/api/admin/notifications', opts, async (request, reply) => {
    const user = await getCurrentAdminUser(request)
    if (!user) return reply.status(404).send(USER_NOT_FOUND)
    const { page, per_page } = parsePagination(request.query as Record<string, unknown>)
    const isReadFilter = queryString(request, 'is_read', 'all').trim()
    return service.listItems(user.id, page, per_page, isReadFilter)
  })

  app.post('/api/admin/notifications', opts, async (request, reply) => {
    const user = await getCurrentAdminUser(request)
    if (!user) return reply.status(404).send(USER_NOT_FOUND)
    if (!(await hasMenuPermission(request, 'system_notifications_add'))) {
      return reply.status(403).send({ error: '无权限创建通知' })
    }
    return reply.status(201).send(await service.createItem(jsonBody(request)))
  })

  app.get('/api/admin/notifications/unread-count', opts, async (request) => {
    const user = await getCurrentAdminUser(request)
    if (!user) return { count: 0 }
    return { count: await service.unreadCount(user.id) }
  })

  app.post(`/api/admin/notifications/${intParam('noti_id')}/read`, opts, async (request, reply) => {
    const user = await getCurrentAdminUser(request)
    if (!user) return reply.status(404).send(USER_NOT_FOUND)
    return service.markRead(user.id, notiIdOf(request))
  })

  app.post('/api/admin/notifications/read-all', opts, async (request, reply) => {
    const user = await getCurrentAdminUser(request)
    if (!user) return reply.status(404).send(USER_NOT_FOUND)
    return service.markAllRead(user.id)
  })

  app.delete(`/api/admin/notifications/${intParam('noti_id')}`, opts, async (request, reply) => {
    const user = await getCurrentAdminUser(request)
    if (!user) return reply.status(404).send(USER_NOT_FOUND)
    const canDeleteGlobal = await hasMenuPermission(request, 'system_notifications_delete')
    return service.deleteItem(user.id, notiIdOf(request), canDeleteGlobal)
  })
}
