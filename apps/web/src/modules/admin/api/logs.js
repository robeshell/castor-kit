import request from '@/shared/api/request'

export const getLoginLogs = (params) => request.get('/admin/logs/login', { params })
export const getOperationLogs = (params) => request.get('/admin/logs/operation', { params })
export const exportLoginLogs = (data) => request.post('/admin/logs/login/export', data, { responseType: 'blob' })
export const exportOperationLogs = (data) => request.post('/admin/logs/operation/export', data, { responseType: 'blob' })
