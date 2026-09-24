import request from '@/shared/api/request'

export const getUsers = (params) => request.get('/admin/users', { params })
export const createUser = (data) => request.post('/admin/users', data)
export const updateUser = (id, data) => request.put(`/admin/users/${id}`, data)
export const deleteUser = (id) => request.delete(`/admin/users/${id}`)
export const exportUsers = (data) => request.post('/admin/users/export', data, { responseType: 'blob' })
export const downloadUsersTemplate = (fileType = 'csv') =>
  request.get('/admin/users/template', {
    params: { file_type: fileType },
    responseType: 'blob',
  })
export const importUsers = (file) => {
  const formData = new FormData()
  formData.append('file', file)
  return request.post('/admin/users/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}
