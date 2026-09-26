/**
 * Roles module routes
 *
 * Routes with an id run get_or_404 first, then the permission check (preserves existing API behavior).
 */

import { declareEvents } from '@/common/webhooks'
import type { FastifyInstance } from 'fastify'
import { currentUsername, hasMenuPermission, loginRequired } from '@/common/auth'
import { getUploadedFile, intParam, parseIntParam, queryString, rawJsonBody } from '@/common/http'
import { sendTable } from '@/common/tabular'
import { dictBody, membershipBody } from '@/common/py-values'
import { RoleService } from './service'

declareEvents({ 'role.created': '角色已新增', 'role.updated': '角色已修改（含权限、数据范围）', 'role.deleted': '角色已删除' })

export async function registerRoleRoutes(app: FastifyInstance): Promise<void> {
  const service = new RoleService(app.db, app.events)
  const opts = { preHandler: loginRequired }

  app.get('/api/admin/roles', opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'system_roles'))) {
      return reply.status(403).send({ error: '无权限查看角色列表' })
    }
    return service.listRoles()
  })

  app.post('/api/admin/roles', opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'system_roles_add'))) {
      return reply.status(403).send({ error: '无权限新增角色' })
    }
    return reply.status(201).send(await service.createRole(dictBody(rawJsonBody(request))))
  })

  app.put(`/api/admin/roles/${intParam('role_id')}`, opts, async (request, reply) => {
    const role = await service.getRoleOr404(parseIntParam((request.params as { role_id: string }).role_id))
    if (!(await hasMenuPermission(request, 'system_roles_edit'))) {
      return reply.status(403).send({ error: '无权限编辑角色' })
    }
    return service.updateRole(role, membershipBody(rawJsonBody(request), ['name', 'code', 'description', 'menu_ids']))
  })

  app.delete(`/api/admin/roles/${intParam('role_id')}`, opts, async (request, reply) => {
    const role = await service.getRoleOr404(parseIntParam((request.params as { role_id: string }).role_id))
    if (!(await hasMenuPermission(request, 'system_roles_delete'))) {
      return reply.status(403).send({ error: '无权限删除角色' })
    }
    return service.deleteRole(role)
  })

  app.post('/api/admin/roles/export', opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'system_roles_export'))) {
      return reply.status(403).send({ error: '无权限导出角色' })
    }
    return sendTable(reply, await service.exportRoles(dictBody(rawJsonBody(request)), await currentUsername(request)))
  })

  app.get('/api/admin/roles/template', opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'system_roles_import'))) {
      return reply.status(403).send({ error: '无权限下载角色导入模板' })
    }
    return sendTable(reply, await service.downloadTemplate(queryString(request, 'file_type')))
  })

  app.post('/api/admin/roles/import', opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'system_roles_import'))) {
      return reply.status(403).send({ error: '无权限导入角色' })
    }
    return service.importRoles(await getUploadedFile(request))
  })
}
