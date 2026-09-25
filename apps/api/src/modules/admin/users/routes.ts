/**
 * 用户模块路由
 *
 * 注意顺序：带 id 的路由先 get_or_404，再做权限检查（保持既有接口行为）。
 */

import type { FastifyInstance } from 'fastify'
import { hasMenuPermission, loginRequired } from '@/common/auth'
import { getUploadedFile, intParam, jsonBody, parseIntParam, queryString } from '@/common/http'
import { parsePagination } from '@/common/pagination'
import { sendTable } from '@/common/tabular'
import { UserService } from './service'

export async function registerUserRoutes(app: FastifyInstance): Promise<void> {
  const service = new UserService(app.db)
  const opts = { preHandler: loginRequired }

  app.get('/api/admin/users', opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'system_users'))) {
      return reply.status(403).send({ error: '无权限查看用户列表' })
    }
    const { page, per_page } = parsePagination(request.query as Record<string, unknown>)
    return service.listUsers(page, per_page, queryString(request, 'search').trim())
  })

  app.post('/api/admin/users', opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'system_users_add'))) {
      return reply.status(403).send({ error: '无权限新增用户' })
    }
    return reply.status(201).send(await service.createUser(jsonBody(request)))
  })

  app.put(`/api/admin/users/${intParam('user_id')}`, opts, async (request, reply) => {
    const user = await service.getUserOr404(parseIntParam((request.params as { user_id: string }).user_id))
    if (!(await hasMenuPermission(request, 'system_users_edit'))) {
      return reply.status(403).send({ error: '无权限编辑用户' })
    }
    return service.updateUser(user, jsonBody(request))
  })

  app.delete(`/api/admin/users/${intParam('user_id')}`, opts, async (request, reply) => {
    const user = await service.getUserOr404(parseIntParam((request.params as { user_id: string }).user_id))
    if (!(await hasMenuPermission(request, 'system_users_delete'))) {
      return reply.status(403).send({ error: '无权限删除用户' })
    }
    return service.deleteUser(user, request.session.get('username'))
  })

  app.post('/api/admin/users/export', opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'system_users'))) {
      return reply.status(403).send({ error: '无权限导出用户' })
    }
    return sendTable(reply, await service.exportUsers(jsonBody(request)))
  })

  app.get('/api/admin/users/template', opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'system_users'))) {
      return reply.status(403).send({ error: '无权限下载用户导入模板' })
    }
    return sendTable(reply, await service.downloadTemplate(queryString(request, 'file_type', '') || null))
  })

  app.post('/api/admin/users/import', opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'system_users_edit'))) {
      return reply.status(403).send({ error: '无权限导入用户' })
    }
    return service.importUsers(await getUploadedFile(request))
  })
}
