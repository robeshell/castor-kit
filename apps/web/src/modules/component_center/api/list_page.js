import request from '@/shared/api/request'

export const getListPageList = (params) => request.get('/admin/component-center/list-page', { params })
export const getListPageDetail = (id) => request.get(`/admin/component-center/list-page/${id}`)
export const createListPage = (data) => request.post('/admin/component-center/list-page', data)
export const updateListPage = (id, data) => request.put(`/admin/component-center/list-page/${id}`, data)
export const deleteListPage = (id) => request.delete(`/admin/component-center/list-page/${id}`)

export const exportListPage = (data) =>
  request.post('/admin/component-center/list-page/export', data, { responseType: 'blob' })

export const downloadListPageTemplate = (fileType = 'csv') =>
  request.get('/admin/component-center/list-page/template', {
    params: { file_type: fileType },
    responseType: 'blob',
  })

export const importListPage = (file) => {
  const formData = new FormData()
  formData.append('file', file)
  return request.post('/admin/component-center/list-page/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}
