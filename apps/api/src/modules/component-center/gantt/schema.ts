/**
 * Gantt page schema layer: request body
 */

import { z } from 'zod'
import { field } from '@/common/validation'

export const TASK_TYPES = ['phase', 'task', 'milestone'] as const
export const PRIORITIES = ['low', 'medium', 'high', 'critical'] as const
export const STATUSES = ['not_started', 'in_progress', 'completed', 'delayed'] as const

export const taskBody = z.object({
  title: field.requiredText('任务标题', '任务标题不能为空'),
  task_type: field.choice('任务类型', TASK_TYPES, 'task'),
  start_date: field.date('开始日期'),
  end_date: field.date('结束日期'),
  progress: field.int('进度', 0),
  assignee: field.text('负责人'),
  priority: field.choice('优先级', PRIORITIES, 'medium'),
  status: field.choice('状态', STATUSES, 'not_started'),
  color: field.text('颜色'),
  sort_order: field.int('排序', 0),
})

export type TaskInput = z.output<typeof taskBody>
