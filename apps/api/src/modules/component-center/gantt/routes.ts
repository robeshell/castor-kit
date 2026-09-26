/**
 * Gantt page routes
 *
 * Routes with an id check permissions first (403), then load the record (404), so a caller without permission can't tell whether an id exists.
 */

import type { FastifyInstance } from 'fastify'
import { hasMenuPermission, loginRequired } from '@/common/auth'
import { intParam, jsonBody, parseIntParam, queryString } from '@/common/http'
import { GanttService } from './service'

const BASE = '/api/admin/component-center/gantt'

export async function registerGanttRoutes(app: FastifyInstance): Promise<void> {
  const service = new GanttService(app.db)
  const opts = { preHandler: loginRequired }
  const taskId = (request: { params: unknown }) => parseIntParam((request.params as { task_id: string }).task_id)

  app.get(`${BASE}/tasks`, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'cc_admin_gantt_page'))) {
      return reply.status(403).send({ error: '无权限' })
    }
    const status = queryString(request, 'status', '').trim() || null
    const priority = queryString(request, 'priority', '').trim() || null
    return service.getAllTasks(status, priority)
  })

  app.post(`${BASE}/tasks`, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'cc_admin_gantt_add'))) {
      return reply.status(403).send({ error: '无权限新建任务' })
    }
    return reply.status(201).send(await service.createTask(jsonBody(request)))
  })

  app.put(`${BASE}/tasks/${intParam('task_id')}`, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'cc_admin_gantt_edit'))) {
      return reply.status(403).send({ error: '无权限编辑任务' })
    }
    const task = await service.getTaskOr404(taskId(request))
    return service.updateTask(task, jsonBody(request))
  })

  app.delete(`${BASE}/tasks/${intParam('task_id')}`, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'cc_admin_gantt_delete'))) {
      return reply.status(403).send({ error: '无权限删除任务' })
    }
    const task = await service.getTaskOr404(taskId(request))
    return service.deleteTask(task)
  })
}
