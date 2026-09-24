import request from '@/shared/api/request'

export const getMenus = (params) => request.get('/admin/menus', { params })
export const createMenu = (data) => request.post('/admin/menus', data)
export const updateMenu = (id, data) => request.put(`/admin/menus/${id}`, data)
export const deleteMenu = (id) => request.delete(`/admin/menus/${id}`)
export const sortMenu = (id, direction) => request.post(`/admin/menus/${id}/sort`, { direction })
export const exportMenus = (data) => request.post('/admin/menus/export', data, { responseType: 'blob' })
export const downloadMenusTemplate = (fileType = 'csv') =>
  request.get('/admin/menus/template', {
    params: { file_type: fileType },
    responseType: 'blob',
  })
export const importMenus = (file) => {
  const formData = new FormData()
  formData.append('file', file)
  return request.post('/admin/menus/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}
