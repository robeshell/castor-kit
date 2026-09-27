/**
 * Gantt page service layer
 */

import { ServiceError } from '@/common/errors'
import { notFound } from '@/common/http'
import { changedFields } from '@/common/validation'
import type { Db } from '@/db/client'
import { ganttTaskToDict, type GanttTask } from '@/db/schema'
import { GanttRepository, type GanttTaskPatch } from './repository'
import type { TaskInput } from './schema'

const DEFAULT_COLOR = '#4080FF'

/** Progress is a percentage: out-of-range values are clamped to 0–100 */
const clampProgress = (progress: number) => Math.max(0, Math.min(100, progress))

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

  async createTask(values: TaskInput) {
    const { start_date: startDate, end_date: endDate } = values
    if (!startDate) throw new ServiceError('开始日期不能为空')
    if (!endDate) throw new ServiceError('结束日期不能为空')
    if (startDate > endDate) throw new ServiceError('开始日期不能晚于结束日期')

    const task = await this.repo.insert({
      ...values,
      start_date: startDate,
      end_date: endDate,
      progress: clampProgress(values.progress),
      color: values.color ?? DEFAULT_COLOR,
    })
    return ganttTaskToDict(task)
  }

  async updateTask(task: GanttTask, values: Partial<TaskInput>) {
    if (values.start_date === null) throw new ServiceError('开始日期不能为空')
    if (values.end_date === null) throw new ServiceError('结束日期不能为空')
    const { start_date: startDate, end_date: endDate, ...rest } = values
    const patch: GanttTaskPatch = { ...rest }
    if (startDate) patch.start_date = startDate
    if (endDate) patch.end_date = endDate
    if (values.progress !== undefined) patch.progress = clampProgress(values.progress)
    if (values.color === null) patch.color = DEFAULT_COLOR
    if ((values.start_date ?? task.start_date) > (values.end_date ?? task.end_date)) throw new ServiceError('开始日期不能晚于结束日期')

    const changed = changedFields(task, patch as Partial<GanttTask>)
    if (Object.keys(changed).length > 0) await this.repo.update(task.id, changed)
    return ganttTaskToDict((await this.repo.getTask(task.id))!)
  }

  async deleteTask(task: GanttTask) {
    await this.repo.delete(task.id)
    return { message: '删除成功' }
  }
}
