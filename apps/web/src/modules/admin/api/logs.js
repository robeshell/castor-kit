import request from '@/shared/api/request'

export const getLoginLogs = (params) => request.get('/admin/logs/login', { params })
export const getOperationLogs = (params) => request.get('/admin/logs/operation', { params })
export const exportLoginLogs = (data) => request.post('/admin/logs/login/export', data, { responseType: 'blob' })
export const downloadLoginLogsTemplate = (fileType = 'csv') =>
  request.get('/admin/logs/login/template', {
    params: { file_type: fileType },
    responseType: 'blob',
  })
export const importLoginLogs = (file) => {
  const formData = new FormData()
  formData.append('file', file)
  return request.post('/admin/logs/login/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}
export const exportOperationLogs = (data) => request.post('/admin/logs/operation/export', data, { responseType: 'blob' })
export const downloadOperationLogsTemplate = (fileType = 'csv') =>
  request.get('/admin/logs/operation/template', {
    params: { file_type: fileType },
    responseType: 'blob',
  })
export const importOperationLogs = (file) => {
  const formData = new FormData()
  formData.append('file', file)
  return request.post('/admin/logs/operation/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}
