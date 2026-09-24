import request from '@/shared/api/request'

export const getRoles = () => request.get('/admin/roles')
export const createRole = (data) => request.post('/admin/roles', data)
export const updateRole = (id, data) => request.put(`/admin/roles/${id}`, data)
export const deleteRole = (id) => request.delete(`/admin/roles/${id}`)
export const exportRoles = (data) => request.post('/admin/roles/export', data, { responseType: 'blob' })
export const downloadRolesTemplate = (fileType = 'csv') =>
  request.get('/admin/roles/template', {
    params: { file_type: fileType },
    responseType: 'blob',
  })
export const importRoles = (file) => {
  const formData = new FormData()
  formData.append('file', file)
  return request.post('/admin/roles/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}
