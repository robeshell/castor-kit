import request from '@/shared/api/request'
import type { ApiBody, ApiItem, ApiQuery, ApiResponse } from '@/shared/api/types'

/** A scheduled HTTP task (times are ISO 8601 UTC) */
export type ScheduledTask = ApiItem<'/api/admin/scheduled-tasks'>
/** One run of a scheduled task */
export type ScheduledTaskRun = ApiItem<'/api/admin/scheduled-tasks/runs'>

/**
 * Create body; edit takes any subset of the same fields.
 * TODO(openapi): the backend reads timeout_seconds with field.int (null / missing → 10; taskBody in
 * apps/api/src/modules/admin/scheduled-task/schema.ts), so it takes null; the doc types it as a non-null number.
 */
export type ScheduledTaskBody = Omit<ApiBody<'/api/admin/scheduled-tasks', 'post'>, 'timeout_seconds'> & {
  timeout_seconds?: number | null
}
export type ScheduledTaskUpdateBody = Omit<ApiBody<'/api/admin/scheduled-tasks/{task_id}', 'put'>, 'timeout_seconds'> & {
  timeout_seconds?: number | null
}

/** Result of "run now": the updated task and the run; `error` is only present when the run failed */
export type ScheduledTaskRunResult = ApiResponse<'/api/admin/scheduled-tasks/{task_id}/run', 'post'>

export const getScheduledTaskList = (params?: ApiQuery<'/api/admin/scheduled-tasks'>) =>
  request.get<unknown, ApiResponse<'/api/admin/scheduled-tasks'>>('/admin/scheduled-tasks', { params })
export const getScheduledTaskDetail = (id: number) =>
  request.get<unknown, ApiResponse<'/api/admin/scheduled-tasks/{task_id}'>>(`/admin/scheduled-tasks/${id}`)
export const createScheduledTask = (data: ScheduledTaskBody) =>
  request.post<unknown, ApiResponse<'/api/admin/scheduled-tasks', 'post'>>('/admin/scheduled-tasks', data)
export const updateScheduledTask = (id: number, data: ScheduledTaskUpdateBody) =>
  request.put<unknown, ApiResponse<'/api/admin/scheduled-tasks/{task_id}', 'put'>>(`/admin/scheduled-tasks/${id}`, data)
export const deleteScheduledTask = (id: number) =>
  request.delete<unknown, ApiResponse<'/api/admin/scheduled-tasks/{task_id}', 'delete'>>(`/admin/scheduled-tasks/${id}`)
export const runScheduledTaskNow = (id: number) =>
  request.post<unknown, ScheduledTaskRunResult>(`/admin/scheduled-tasks/${id}/run`)
export const getScheduledTaskRunLogs = (params?: ApiQuery<'/api/admin/scheduled-tasks/runs'>) =>
  request.get<unknown, ApiResponse<'/api/admin/scheduled-tasks/runs'>>('/admin/scheduled-tasks/runs', { params })
