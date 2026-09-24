import request from '@/shared/api/request'

export const getScheduledTaskList = (params) => request.get('/admin/scheduled-tasks', { params })
export const getScheduledTaskDetail = (id) => request.get(`/admin/scheduled-tasks/${id}`)
export const createScheduledTask = (data) => request.post('/admin/scheduled-tasks', data)
export const updateScheduledTask = (id, data) => request.put(`/admin/scheduled-tasks/${id}`, data)
export const deleteScheduledTask = (id) => request.delete(`/admin/scheduled-tasks/${id}`)
export const runScheduledTaskNow = (id) => request.post(`/admin/scheduled-tasks/${id}/run`)
export const getScheduledTaskRunLogs = (params) => request.get('/admin/scheduled-tasks/runs', { params })
