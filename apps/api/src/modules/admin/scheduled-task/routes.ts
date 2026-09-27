/**
 * Scheduled task routes
 *
 * Routes with an id check permissions first (403), then load the record (404), so a caller without permission can't tell whether an id exists.
 * - Manual run: 200 when run.status is success, otherwise 500 (the body is still the full result)
 */

import type { FastifyInstance } from 'fastify'
import { hasMenuPermission, loginRequired } from '@/common/auth'
import { intParam, parseIntParam, queryString } from '@/common/http'
import { parsePagination } from '@/common/pagination'
import { parseBody, parseIntText, parsePatch, parseYesNo } from '@/common/validation'
import { scheduledTaskToDict } from '@/db/schema'
import { taskBody } from './schema'
import { ScheduledTaskService } from './service'

export async function registerScheduledTaskRoutes(app: FastifyInstance): Promise<void> {
  const service = new ScheduledTaskService(app.db)
  const opts = { preHandler: loginRequired }
  const taskIdOf = (params: unknown) => parseIntParam((params as { task_id: string }).task_id)

  app.get('/api/admin/scheduled-tasks', opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'system_scheduled_tasks'))) {
      return reply.status(403).send({ error: '无权限查看定时任务列表' })
    }
    const { page, per_page } = parsePagination(request.query as Record<string, unknown>)
    const search = queryString(request, 'search').trim()
    const status = queryString(request, 'status').trim()
    const isActive = parseYesNo(queryString(request, 'is_active'))
    return service.listTasks(page, per_page, search, isActive, status)
  })

  app.post('/api/admin/scheduled-tasks', opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'system_scheduled_tasks_add'))) {
      return reply.status(403).send({ error: '无权限新增定时任务' })
    }
    return reply.status(201).send(await service.createTask(parseBody(taskBody, request.body)))
  })

  // The static path /runs must be reachable: intParam only matches digits, so it doesn't conflict with /runs
  app.get('/api/admin/scheduled-tasks/runs', opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'system_scheduled_tasks'))) {
      return reply.status(403).send({ error: '无权限查看执行记录' })
    }
    const { page, per_page } = parsePagination(request.query as Record<string, unknown>)
    // One task's runs, or every task's when task_id is missing / not a number
    const taskId = parseIntText(queryString(request, 'task_id'), 0) || null
    const status = queryString(request, 'status').trim()
    return service.listRuns(page, per_page, taskId, status)
  })

  app.get(`/api/admin/scheduled-tasks/${intParam('task_id')}`, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'system_scheduled_tasks'))) {
      return reply.status(403).send({ error: '无权限查看定时任务' })
    }
    const task = await service.getTaskOr404(taskIdOf(request.params))
    return scheduledTaskToDict(task)
  })

  app.put(`/api/admin/scheduled-tasks/${intParam('task_id')}`, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'system_scheduled_tasks_edit'))) {
      return reply.status(403).send({ error: '无权限编辑定时任务' })
    }
    const task = await service.getTaskOr404(taskIdOf(request.params))
    return service.updateTask(task, parsePatch(taskBody, request.body))
  })

  app.delete(`/api/admin/scheduled-tasks/${intParam('task_id')}`, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'system_scheduled_tasks_delete'))) {
      return reply.status(403).send({ error: '无权限删除定时任务' })
    }
    const task = await service.getTaskOr404(taskIdOf(request.params))
    return service.deleteTask(task)
  })

  app.post(`/api/admin/scheduled-tasks/${intParam('task_id')}/run`, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'system_scheduled_tasks_run'))) {
      return reply.status(403).send({ error: '无权限执行定时任务' })
    }
    const task = await service.getTaskOr404(taskIdOf(request.params))
    const payload = await service.runTaskNow(task)
    const run = payload.run as { status?: string } | undefined
    return reply.status(run?.status === 'success' ? 200 : 500).send(payload)
  })
}
