/**
 * 角色模块路由（对齐 AuraStack backend/app/admin/api/roles.py）
 *
 * 带 id 的路由先 get_or_404，再做权限检查（与 Flask 一致）。
 */

import type { FastifyInstance } from 'fastify'
import { hasMenuPermission, loginRequired } from '@/common/auth'
import { getUploadedFile, intParam, parseIntParam, queryString, rawJsonBody } from '@/common/http'
import { sendTable } from '@/common/tabular'
import { dictBody, membershipBody } from '@/common/py-values'
import { RoleService } from './service'

export async function registerRoleRoutes(app: FastifyInstance): Promise<void> {
  const service = new RoleService(app.db)
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
    if (!(await hasMenuPermission(request, 'system_roles'))) {
      return reply.status(403).send({ error: '无权限导出角色' })
    }
    return sendTable(reply, await service.exportRoles(dictBody(rawJsonBody(request)), request.session.get('username')))
  })

  app.get('/api/admin/roles/template', opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'system_roles'))) {
      return reply.status(403).send({ error: '无权限下载角色导入模板' })
    }
    return sendTable(reply, await service.downloadTemplate(queryString(request, 'file_type')))
  })

  app.post('/api/admin/roles/import', opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'system_roles_edit'))) {
      return reply.status(403).send({ error: '无权限导入角色' })
    }
    return service.importRoles(await getUploadedFile(request))
  })
}
