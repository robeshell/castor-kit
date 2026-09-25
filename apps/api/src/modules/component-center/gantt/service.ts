/**
 * Gantt page service layer
 */

import { ServiceError } from '@/common/errors'
import { notFound } from '@/common/http'
import type { Db } from '@/db/client'
import { ganttTaskToDict, type GanttTask } from '@/db/schema'
import { parseLooseDate } from '@/common/py-date'
import { GanttRepository, type GanttTaskPatch } from './repository'
import {
  changedFields,
  clampProgress,
  colorOrDefault,
  hasKey,
  normalizeEnum,
  parseIntOr,
  PRIORITY_VALUES,
  STATUS_VALUES,
  strOrEmpty,
  strOrNull,
  TASK_TYPE_VALUES,
} from './schema'

type Data = Record<string, unknown>

export class GanttService {
  private readonly repo: GanttRepository

  constructor(db: Db) {
    this.repo = new GanttRepository(db)
  }

  async getTaskOr404(id: number): Promise<GanttTask> {
    const task = await this.repo.getTask(id)
    if (!task) throw notFound()
    return task
  }

  async getAllTasks(status: string | null, priority: string | null) {
    return (await this.repo.allTasks(status, priority)).map(ganttTaskToDict)
  }

  async createTask(data: Data) {
    const title = strOrEmpty(data.title)
    if (!title) throw new ServiceError('任务标题不能为空')

    const startDate = parseLooseDate(data.start_date)
    const endDate = parseLooseDate(data.end_date)
    if (!startDate) throw new ServiceError('开始日期不能为空')
    if (!endDate) throw new ServiceError('结束日期不能为空')

    const task = await this.repo.insert({
      title,
      task_type: normalizeEnum(data.task_type, TASK_TYPE_VALUES, 'task'),
      start_date: startDate,
      end_date: endDate,
      progress: clampProgress(parseIntOr(data.progress, 0)),
      assignee: strOrNull(data.assignee),
      priority: normalizeEnum(data.priority, PRIORITY_VALUES, 'medium'),
      status: normalizeEnum(data.status, STATUS_VALUES, 'not_started'),
      color: colorOrDefault(data.color),
      sort_order: parseIntOr(data.sort_order, 0),
    })
    return ganttTaskToDict(task)
  }

  async updateTask(task: GanttTask, data: Data) {
    if (hasKey(data, 'title') && !strOrEmpty(data.title)) throw new ServiceError('任务标题不能为空')

    const patch: GanttTaskPatch = {}
    if (hasKey(data, 'title')) patch.title = strOrEmpty(data.title)
    if (hasKey(data, 'assignee')) patch.assignee = strOrNull(data.assignee)
    if (hasKey(data, 'color')) patch.color = colorOrDefault(data.color)
    if (hasKey(data, 'sort_order')) patch.sort_order = parseIntOr(data.sort_order, task.sort_order || 0)
    if (hasKey(data, 'task_type')) patch.task_type = normalizeEnum(data.task_type, TASK_TYPE_VALUES, 'task')
    if (hasKey(data, 'priority')) patch.priority = normalizeEnum(data.priority, PRIORITY_VALUES, 'medium')
    if (hasKey(data, 'status')) patch.status = normalizeEnum(data.status, STATUS_VALUES, 'not_started')
    if (hasKey(data, 'progress')) patch.progress = clampProgress(parseIntOr(data.progress, task.progress || 0))
    if (hasKey(data, 'start_date')) patch.start_date = parseLooseDate(data.start_date)
    if (hasKey(data, 'end_date')) patch.end_date = parseLooseDate(data.end_date)

    const changed = changedFields(task as unknown as Record<string, unknown>, patch)
    if (Object.keys(changed).length > 0) await this.repo.update(task.id, changed)
    return ganttTaskToDict((await this.repo.getTask(task.id))!)
  }

  async deleteTask(task: GanttTask) {
    await this.repo.delete(task.id)
    return { message: '删除成功' }
  }
}
