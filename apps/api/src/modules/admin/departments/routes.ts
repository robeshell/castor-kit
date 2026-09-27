/**
 * Departments module routes
 *
 * The tree (GET list) is also readable with the users or roles menu permission: those pages pick departments from it.
 */

import { declareEvents } from '@/common/webhooks'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import { hasAnyMenuPermission, hasMenuPermission, loginRequired } from '@/common/auth'
import { intParam, parseIntParam, queryString } from '@/common/http'
import { parseBody, parsePatch } from '@/common/validation'
import { departmentBody, departmentSortBody, isDeptStatus } from './schema'
import { DepartmentService } from './service'

const BASE = '/api/admin/departments'

declareEvents({ 'department.created': '部门已新增', 'department.updated': '部门已修改', 'department.deleted': '部门已删除' })

export async function registerDepartmentRoutes(app: FastifyInstance): Promise<void> {
  const service = new DepartmentService(app.db, app.events)
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
    return reply.status(201).send(await service.createItem(parseBody(departmentBody, request.body)))
  })

  app.get(itemPath, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'system_departments'))) {
      return reply.status(403).send({ error: '无权限查看部门' })
    }
    const dept = await service.getOr404(deptId(request))
    return service.getItem(dept)
  })

  app.put(itemPath, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'system_departments_edit'))) {
      return reply.status(403).send({ error: '无权限编辑部门' })
    }
    const dept = await service.getOr404(deptId(request))
    return service.updateItem(dept, parsePatch(departmentBody, request.body))
  })

  app.delete(itemPath, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'system_departments_delete'))) {
      return reply.status(403).send({ error: '无权限删除部门' })
    }
    const dept = await service.getOr404(deptId(request))
    return service.deleteItem(dept)
  })

  app.post(`${itemPath}/sort`, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'system_departments_edit'))) {
      return reply.status(403).send({ error: '无权限编辑部门' })
    }
    const dept = await service.getOr404(deptId(request))
    return service.sortItem(dept, parseBody(departmentSortBody, request.body).direction)
  })
}
