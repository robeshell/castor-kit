import request from '@/shared/api/request'
import type { ApiBody, ApiItem, ApiQuery, ApiResponse } from '@/shared/api/types'

/** A scheduled HTTP task (times are ISO 8601 UTC) */
export type ScheduledTask = ApiItem<'/api/admin/scheduled-tasks'>
/** One run of a scheduled task */
export type ScheduledTaskRun = ApiItem<'/api/admin/scheduled-tasks/runs'>

/** Result of "run now": the updated task and the run; `error` is only present when the run failed */
export type ScheduledTaskRunResult = ApiResponse<'/api/admin/scheduled-tasks/{task_id}/run', 'post'>

export const getScheduledTaskList = (params?: ApiQuery<'/api/admin/scheduled-tasks'>) =>
  request.get<unknown, ApiResponse<'/api/admin/scheduled-tasks'>>('/admin/scheduled-tasks', { params })
export const getScheduledTaskDetail = (id: number) =>
  request.get<unknown, ApiResponse<'/api/admin/scheduled-tasks/{task_id}'>>(`/admin/scheduled-tasks/${id}`)
export const createScheduledTask = (data: ApiBody<'/api/admin/scheduled-tasks', 'post'>) =>
  request.post<unknown, ApiResponse<'/api/admin/scheduled-tasks', 'post'>>('/admin/scheduled-tasks', data)
export const updateScheduledTask = (id: number, data: ApiBody<'/api/admin/scheduled-tasks/{task_id}', 'put'>) =>
  request.put<unknown, ApiResponse<'/api/admin/scheduled-tasks/{task_id}', 'put'>>(`/admin/scheduled-tasks/${id}`, data)
export const deleteScheduledTask = (id: number) =>
  request.delete<unknown, ApiResponse<'/api/admin/scheduled-tasks/{task_id}', 'delete'>>(`/admin/scheduled-tasks/${id}`)
export const runScheduledTaskNow = (id: number) =>
  request.post<unknown, ScheduledTaskRunResult>(`/admin/scheduled-tasks/${id}/run`)
export const getScheduledTaskRunLogs = (params?: ApiQuery<'/api/admin/scheduled-tasks/runs'>) =>
  request.get<unknown, ApiResponse<'/api/admin/scheduled-tasks/runs'>>('/admin/scheduled-tasks/runs', { params })
