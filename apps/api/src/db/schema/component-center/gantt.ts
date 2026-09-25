/**
 * cc_gantt_tasks
 *
 * 由 drizzle-kit pull 生成后整理。task_type/progress 等列在现库里有 DB DEFAULT（.default()）；
 * created_at/updated_at 是应用侧默认值，用 ../columns 的 createdAt()/updatedAt()。
 */

import { date, integer, pgTable, serial, varchar } from 'drizzle-orm/pg-core'
import { toIso } from '@/common/serialize'
import { createdAt, updatedAt } from '../columns'

export const cc_gantt_tasks = pgTable('cc_gantt_tasks', {
  id: serial().primaryKey().notNull(),
  title: varchar({ length: 200 }).notNull(),
  task_type: varchar({ length: 20 }).default('task'),
  start_date: date({ mode: 'string' }).notNull(),
  end_date: date({ mode: 'string' }).notNull(),
  progress: integer().default(0),
  assignee: varchar({ length: 100 }),
  priority: varchar({ length: 20 }).default('medium'),
  status: varchar({ length: 20 }).default('not_started'),
  color: varchar({ length: 20 }).default('#4080FF'),
  sort_order: integer().default(0),
  created_at: createdAt(),
  updated_at: updatedAt(),
})

export type GanttTask = typeof cc_gantt_tasks.$inferSelect

/** 甘特任务输出 */
export function ganttTaskToDict(t: GanttTask) {
  return {
    id: t.id,
    title: t.title,
    task_type: t.task_type || 'task',
    start_date: t.start_date || null,
    end_date: t.end_date || null,
    progress: t.progress ?? 0,
    assignee: t.assignee,
    priority: t.priority || 'medium',
    status: t.status || 'not_started',
    color: t.color || '#4080FF',
    sort_order: t.sort_order ?? 0,
    created_at: toIso(t.created_at),
    updated_at: toIso(t.updated_at),
  }
}
