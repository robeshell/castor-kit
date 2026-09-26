/**
 * Users module routes
 *
 * Mind the order: routes with an id run get_or_404 first, then the permission check (preserves existing API behavior).
 * Data scope: every read and write goes through the caller's scope; a user outside it is a 404, like a missing one.
 */

import type { FastifyInstance, FastifyRequest } from 'fastify'
import { getCurrentAdminUser, hasMenuPermission, loginRequired } from '@/common/auth'
import { isSuperAdmin } from '@/common/rbac'
import { resolveDataScope } from '@/common/data-scope'
import { getUploadedFile, intParam, jsonBody, parseIntParam, queryString } from '@/common/http'
import { parsePagination } from '@/common/pagination'
import { sendTable } from '@/common/tabular'
import { isUserStatus } from './schema'
import { UserService, type Caller } from './service'

export async function registerUserRoutes(app: FastifyInstance): Promise<void> {
  const service = new UserService(app.db)
  const opts = { preHandler: loginRequired }
  const callerOf = async (request: FastifyRequest): Promise<Caller> => {
    const current = await getCurrentAdminUser(request)
    return { username: current?.username, superAdmin: Boolean(current && isSuperAdmin(current)) }
  }
  const scopedUserOr404 = async (request: FastifyRequest) =>
    service.getUserOr404(parseIntParam((request.params as { user_id: string }).user_id), await resolveDataScope(request))

  app.get('/api/admin/users', opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'system_users'))) {
      return reply.status(403).send({ error: '无权限查看用户列表' })
    }
    const { page, per_page } = parsePagination(request.query as Record<string, unknown>)
    const status = queryString(request, 'status').trim()
    const deptId = queryString(request, 'dept_id').trim()
    return service.listUsers(
      page,
      per_page,
      {
        search: queryString(request, 'search').trim(),
        status: isUserStatus(status) ? status : '',
        deptId: /^\d+$/.test(deptId) ? Number(deptId) : null,
      },
      await resolveDataScope(request),
    )
  })

  app.post('/api/admin/users', opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'system_users_add'))) {
      return reply.status(403).send({ error: '无权限新增用户' })
    }
    return reply.status(201).send(await service.createUser(jsonBody(request), await resolveDataScope(request), await callerOf(request)))
  })

  app.put(`/api/admin/users/${intParam('user_id')}`, opts, async (request, reply) => {
    const user = await scopedUserOr404(request)
    if (!(await hasMenuPermission(request, 'system_users_edit'))) {
      return reply.status(403).send({ error: '无权限编辑用户' })
    }
    return service.updateUser(user, jsonBody(request), await resolveDataScope(request), await callerOf(request))
  })

  app.put(`/api/admin/users/${intParam('user_id')}/status`, opts, async (request, reply) => {
    const user = await scopedUserOr404(request)
    if (!(await hasMenuPermission(request, 'system_users_status'))) {
      return reply.status(403).send({ error: '无权限启用或停用用户' })
    }
    return service.setUserStatus(user, jsonBody(request).status, await callerOf(request))
  })

  app.delete(`/api/admin/users/${intParam('user_id')}`, opts, async (request, reply) => {
    const user = await scopedUserOr404(request)
    if (!(await hasMenuPermission(request, 'system_users_delete'))) {
      return reply.status(403).send({ error: '无权限删除用户' })
    }
    return service.deleteUser(user, await callerOf(request))
  })

  app.post('/api/admin/users/export', opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'system_users'))) {
      return reply.status(403).send({ error: '无权限导出用户' })
    }
    return sendTable(reply, await service.exportUsers(jsonBody(request), await resolveDataScope(request)))
  })

  app.get('/api/admin/users/template', opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'system_users'))) {
      return reply.status(403).send({ error: '无权限下载用户导入模板' })
    }
    return sendTable(reply, await service.downloadTemplate(queryString(request, 'file_type', '') || null))
  })

  // Self-service profile: any signed-in user, own nickname / email / phone / avatar only
  app.put('/api/admin/profile', opts, async (request) => {
    const user = await getCurrentAdminUser(request)
    return service.updateOwnProfile(user!, jsonBody(request))
  })

  app.post('/api/admin/users/import', opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'system_users_edit'))) {
      return reply.status(403).send({ error: '无权限导入用户' })
    }
    return service.importUsers(await getUploadedFile(request), {
      currentUsername: request.session.get('username'),
      superAdmin: (await callerOf(request)).superAdmin,
      canSetStatus: await hasMenuPermission(request, 'system_users_status'),
      scope: await resolveDataScope(request),
    })
  })
}
