import request from '@/shared/api/request'

export const getGanttTasks = (params) =>
  request.get('/admin/component-center/gantt/tasks', { params })

export const createGanttTask = (data) =>
  request.post('/admin/component-center/gantt/tasks', data)

export const updateGanttTask = (id, data) =>
  request.put(`/admin/component-center/gantt/tasks/${id}`, data)

export const deleteGanttTask = (id) =>
  request.delete(`/admin/component-center/gantt/tasks/${id}`)
