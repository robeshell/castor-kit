import request from '@/shared/api/request'
import type { ApiBody, ApiQuery, ApiResponse } from '@/shared/api/types'

/** A task / phase / milestone of the Gantt demo (the list is a plain array; times are ISO 8601 UTC) */
export type GanttTask = ApiResponse<'/api/admin/component-center/gantt/tasks'>[number]

export const getGanttTasks = (params?: ApiQuery<'/api/admin/component-center/gantt/tasks'>) =>
  request.get<unknown, ApiResponse<'/api/admin/component-center/gantt/tasks'>>('/admin/component-center/gantt/tasks', { params })

export const createGanttTask = (data: ApiBody<'/api/admin/component-center/gantt/tasks', 'post'>) =>
  request.post<unknown, ApiResponse<'/api/admin/component-center/gantt/tasks', 'post'>>('/admin/component-center/gantt/tasks', data)

export const updateGanttTask = (id: number, data: ApiBody<'/api/admin/component-center/gantt/tasks/{task_id}', 'put'>) =>
  request.put<unknown, ApiResponse<'/api/admin/component-center/gantt/tasks/{task_id}', 'put'>>(`/admin/component-center/gantt/tasks/${id}`, data)

export const deleteGanttTask = (id: number) =>
  request.delete<unknown, ApiResponse<'/api/admin/component-center/gantt/tasks/{task_id}', 'delete'>>(`/admin/component-center/gantt/tasks/${id}`)
