/**
 * 定时任务路由
 *
 * 检查顺序（保持既有接口行为）：
 * - GET/PUT/DELETE /scheduled-tasks/<id>：先 get_or_404 再做权限检查
 * - POST /scheduled-tasks/<id>/run：先做权限检查再 get_or_404
 * - 手动执行：run.status 为 success 返回 200，否则 500（响应体仍是完整结果）
 */

import type { FastifyInstance } from 'fastify'
import { hasMenuPermission, loginRequired } from '@/common/auth'
import { intParam, jsonBody, parseIntParam, queryString } from '@/common/http'
import { parsePagination } from '@/common/pagination'
import { pyStrip } from '@/common/scheduler/py-compat'
import { scheduledTaskToDict } from '@/db/schema'
import { parseBool, parseIntValue } from './schema'
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
    const search = pyStrip(queryString(request, 'search'))
    const status = pyStrip(queryString(request, 'status'))
    const rawActive = (request.query as Record<string, unknown>).is_active
    const isActive = parseBool(Array.isArray(rawActive) ? rawActive[0] : rawActive, null)
    return service.listTasks(page, per_page, search, isActive, status)
  })

  app.post('/api/admin/scheduled-tasks', opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'system_scheduled_tasks_add'))) {
      return reply.status(403).send({ error: '无权限新增定时任务' })
    }
    return reply.status(201).send(await service.createTask(jsonBody(request)))
  })

  // 静态路径 /runs 必须能命中：intParam 只匹配纯数字，不会与 /runs 冲突
  app.get('/api/admin/scheduled-tasks/runs', opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'system_scheduled_tasks'))) {
      return reply.status(403).send({ error: '无权限查看执行记录' })
    }
    const { page, per_page } = parsePagination(request.query as Record<string, unknown>)
    const rawTaskId = (request.query as Record<string, unknown>).task_id
    const taskIdText = Array.isArray(rawTaskId) ? rawTaskId[0] : rawTaskId
    // parse_int(request.args.get('task_id'), default=0) or None
    const taskId = (taskIdText === undefined ? 0 : parseIntValue(taskIdText, 0)) || null
    const status = pyStrip(queryString(request, 'status'))
    return service.listRuns(page, per_page, taskId, status)
  })

  app.get(`/api/admin/scheduled-tasks/${intParam('task_id')}`, opts, async (request, reply) => {
    const task = await service.getTaskOr404(taskIdOf(request.params))
    if (!(await hasMenuPermission(request, 'system_scheduled_tasks'))) {
      return reply.status(403).send({ error: '无权限查看定时任务' })
    }
    return scheduledTaskToDict(task)
  })

  app.put(`/api/admin/scheduled-tasks/${intParam('task_id')}`, opts, async (request, reply) => {
    const task = await service.getTaskOr404(taskIdOf(request.params))
    if (!(await hasMenuPermission(request, 'system_scheduled_tasks_edit'))) {
      return reply.status(403).send({ error: '无权限编辑定时任务' })
    }
    return service.updateTask(task, jsonBody(request))
  })

  app.delete(`/api/admin/scheduled-tasks/${intParam('task_id')}`, opts, async (request, reply) => {
    const task = await service.getTaskOr404(taskIdOf(request.params))
    if (!(await hasMenuPermission(request, 'system_scheduled_tasks_delete'))) {
      return reply.status(403).send({ error: '无权限删除定时任务' })
    }
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
