/**
 * scheduled_tasks / scheduled_task_runs
 *
 * `.$default()` / createdAt() / updatedAt() 只是应用侧默认值（库里没有 DEFAULT），不进 DDL。
 */

import { relations } from 'drizzle-orm'
import { boolean, foreignKey, index, integer, pgTable, serial, text, timestamp, unique, varchar } from 'drizzle-orm/pg-core'
import { toIso } from '@/common/serialize'
import { createdAt, updatedAt } from '../columns'

export const scheduled_tasks = pgTable('scheduled_tasks', {
  id: serial().primaryKey().notNull(),
  name: varchar({ length: 120 }).notNull(),
  task_code: varchar({ length: 120 }).notNull(),
  cron_expression: varchar({ length: 120 }).notNull(),
  request_method: varchar({ length: 10 }).$default(() => 'GET'),
  request_url: varchar({ length: 500 }).notNull(),
  request_headers: text(),
  request_body: text(),
  timeout_seconds: integer().$default(() => 10),
  is_active: boolean().$default(() => true),
  remark: text(),
  last_status: varchar({ length: 20 }).$default(() => 'idle'),
  last_error: text(),
  last_duration_ms: integer(),
  run_count: integer().$default(() => 0),
  last_run_at: timestamp({ mode: 'string' }),
  next_run_at: timestamp({ mode: 'string' }),
  created_at: createdAt(),
  updated_at: updatedAt(),
}, (table) => [
  index('ix_scheduled_tasks_is_active').using('btree', table.is_active),
  index('ix_scheduled_tasks_next_run_at').using('btree', table.next_run_at),
  unique('scheduled_tasks_task_code_key').on(table.task_code),
])

export const scheduled_task_runs = pgTable('scheduled_task_runs', {
  id: serial().primaryKey().notNull(),
  task_id: integer().notNull(),
  trigger_type: varchar({ length: 20 }).$default(() => 'scheduled'),
  status: varchar({ length: 20 }).notNull(),
  response_status: integer(),
  response_body: text(),
  error_message: text(),
  /** `default=datetime.utcnow` */
  started_at: createdAt(),
  finished_at: timestamp({ mode: 'string' }),
  duration_ms: integer(),
  created_at: createdAt(),
}, (table) => [
  index('ix_scheduled_task_runs_status').using('btree', table.status),
  index('ix_scheduled_task_runs_task_id').using('btree', table.task_id),
  foreignKey({
      columns: [table.task_id],
      foreignColumns: [scheduled_tasks.id],
      name: 'scheduled_task_runs_task_id_fkey'
    }).onDelete('cascade'),
])

export const scheduled_tasks_relations = relations(scheduled_tasks, ({ many }) => ({
  runs: many(scheduled_task_runs),
}))

export const scheduled_task_runs_relations = relations(scheduled_task_runs, ({ one }) => ({
  task: one(scheduled_tasks, { fields: [scheduled_task_runs.task_id], references: [scheduled_tasks.id] }),
}))

export type ScheduledTask = typeof scheduled_tasks.$inferSelect
export type ScheduledTaskRun = typeof scheduled_task_runs.$inferSelect

/** 定时任务输出 */
export function scheduledTaskToDict(task: ScheduledTask) {
  return {
    id: task.id,
    name: task.name,
    task_code: task.task_code,
    cron_expression: task.cron_expression,
    request_method: task.request_method,
    request_url: task.request_url,
    request_headers: task.request_headers,
    request_body: task.request_body,
    timeout_seconds: task.timeout_seconds,
    is_active: task.is_active,
    remark: task.remark,
    last_status: task.last_status,
    last_error: task.last_error,
    last_duration_ms: task.last_duration_ms,
    run_count: task.run_count,
    last_run_at: toIso(task.last_run_at),
    next_run_at: toIso(task.next_run_at),
    created_at: toIso(task.created_at),
    updated_at: toIso(task.updated_at),
  }
}

/** 执行记录输出：task 为关联任务，不存在时 task_name / task_code 为 null */
export function scheduledTaskRunToDict(run: ScheduledTaskRun, task: Pick<ScheduledTask, 'name' | 'task_code'> | null) {
  return {
    id: run.id,
    task_id: run.task_id,
    task_name: task ? task.name : null,
    task_code: task ? task.task_code : null,
    trigger_type: run.trigger_type,
    status: run.status,
    response_status: run.response_status,
    response_body: run.response_body,
    error_message: run.error_message,
    started_at: toIso(run.started_at),
    finished_at: toIso(run.finished_at),
    duration_ms: run.duration_ms,
    created_at: toIso(run.created_at),
  }
}
