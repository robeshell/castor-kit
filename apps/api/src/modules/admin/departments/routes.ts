/**
 * Departments module routes
 *
 * The tree (GET list) is also readable with the users or roles menu permission: those pages pick departments from it.
 */

import type { FastifyInstance, FastifyRequest } from 'fastify'
import { hasAnyMenuPermission, hasMenuPermission, loginRequired } from '@/common/auth'
import { intParam, jsonBody, parseIntParam, queryString } from '@/common/http'
import { isDeptStatus } from './schema'
import { DepartmentService } from './service'

const BASE = '/api/admin/departments'

export async function registerDepartmentRoutes(app: FastifyInstance): Promise<void> {
  const service = new DepartmentService(app.db)
  const opts = { preHandler: loginRequired }
  const itemPath = `${BASE}/${intParam('dept_id')}`
  const deptId = (request: FastifyRequest) => parseIntParam((request.params as { dept_id: string }).dept_id)

  app.get(BASE, opts, async (request, reply) => {
    if (!(await hasAnyMenuPermission(request, 'system_departments', 'system_users', 'system_roles'))) {
      return reply.status(403).send({ error: '无权限查看部门' })
    }
    const status = queryString(request, 'status').trim()
    return service.listTree(queryString(request, 'search').trim(), isDeptStatus(status) ? status : '')
  })

  app.post(BASE, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'system_departments_add'))) {
      return reply.status(403).send({ error: '无权限新增部门' })
    }
    return reply.status(201).send(await service.createItem(jsonBody(request)))
  })

  app.get(itemPath, opts, async (request, reply) => {
    const dept = await service.getOr404(deptId(request))
    if (!(await hasMenuPermission(request, 'system_departments'))) {
      return reply.status(403).send({ error: '无权限查看部门' })
    }
    return service.getItem(dept)
  })

  app.put(itemPath, opts, async (request, reply) => {
    const dept = await service.getOr404(deptId(request))
    if (!(await hasMenuPermission(request, 'system_departments_edit'))) {
      return reply.status(403).send({ error: '无权限编辑部门' })
    }
    return service.updateItem(dept, jsonBody(request))
  })

  app.delete(itemPath, opts, async (request, reply) => {
    const dept = await service.getOr404(deptId(request))
    if (!(await hasMenuPermission(request, 'system_departments_delete'))) {
      return reply.status(403).send({ error: '无权限删除部门' })
    }
    return service.deleteItem(dept)
  })

  app.post(`${itemPath}/sort`, opts, async (request, reply) => {
    const dept = await service.getOr404(deptId(request))
    if (!(await hasMenuPermission(request, 'system_departments_edit'))) {
      return reply.status(403).send({ error: '无权限编辑部门' })
    }
    return service.sortItem(dept, jsonBody(request).direction)
  })
}
