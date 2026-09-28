/**
 * Roles module routes
 *
 * Routes with an id check permissions first (403), then load the record (404), so a caller without permission can't tell whether an id exists.
 */

import { declareEvents } from '@/common/webhooks'
import type { FastifyInstance } from 'fastify'
import { hasMenuPermission, loginRequired } from '@/common/auth'
import { getUploadedFile, intParam, parseIntParam, queryString } from '@/common/http'
import { sendTable } from '@/common/tabular'
import { routeBody } from '@/common/validation'
import { roleBody, roleExportBody } from './schema'
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

  const roleInput = routeBody(roleBody, 'create')
  app.post('/api/admin/roles', { ...opts, ...roleInput.route }, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'system_roles_add'))) {
      return reply.status(403).send({ error: '无权限新建角色' })
    }
    return reply.status(201).send(await service.createRole(roleInput.parse(request)))
  })

  const rolePatch = routeBody(roleBody, 'patch')
  app.put(`/api/admin/roles/${intParam('role_id')}`, { ...opts, ...rolePatch.route }, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'system_roles_edit'))) {
      return reply.status(403).send({ error: '无权限编辑角色' })
    }
    const role = await service.getRoleOr404(parseIntParam((request.params as { role_id: string }).role_id))
    return service.updateRole(role, rolePatch.parse(request))
  })

  app.delete(`/api/admin/roles/${intParam('role_id')}`, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'system_roles_delete'))) {
      return reply.status(403).send({ error: '无权限删除角色' })
    }
    const role = await service.getRoleOr404(parseIntParam((request.params as { role_id: string }).role_id))
    return service.deleteRole(role)
  })

  const roleExportInput = routeBody(roleExportBody, 'create')
  app.post('/api/admin/roles/export', { ...opts, ...roleExportInput.route }, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'system_roles_export'))) {
      return reply.status(403).send({ error: '无权限导出角色' })
    }
    return sendTable(reply, await service.exportRoles(roleExportInput.parse(request)))
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
