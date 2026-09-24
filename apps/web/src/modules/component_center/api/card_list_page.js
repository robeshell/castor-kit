import request from '@/shared/api/request'

export const getCardListPageList = (params) => request.get('/admin/component-center/card-list-page', { params })
export const getCardListPageDetail = (id) => request.get(`/admin/component-center/card-list-page/${id}`)
export const createCardListPage = (data) => request.post('/admin/component-center/card-list-page', data)
export const updateCardListPage = (id, data) => request.put(`/admin/component-center/card-list-page/${id}`, data)
export const deleteCardListPage = (id) => request.delete(`/admin/component-center/card-list-page/${id}`)

export const exportCardListPage = (data) =>
  request.post('/admin/component-center/card-list-page/export', data, { responseType: 'blob' })

export const downloadCardListPageTemplate = (fileType = 'csv') =>
  request.get('/admin/component-center/card-list-page/template', {
    params: { file_type: fileType },
    responseType: 'blob',
  })

export const importCardListPage = (file) => {
  const formData = new FormData()
  formData.append('file', file)
  return request.post('/admin/component-center/card-list-page/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}
