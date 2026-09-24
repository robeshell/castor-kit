import request from '@/shared/api/request'

export const getStatsListPageStats = () => request.get('/admin/component-center/stats-list-page/stats')
export const getStatsListPageList = (params) => request.get('/admin/component-center/stats-list-page', { params })
export const getStatsListPageDetail = (id) => request.get(`/admin/component-center/stats-list-page/${id}`)
export const createStatsListPage = (data) => request.post('/admin/component-center/stats-list-page', data)
export const updateStatsListPage = (id, data) => request.put(`/admin/component-center/stats-list-page/${id}`, data)
export const deleteStatsListPage = (id) => request.delete(`/admin/component-center/stats-list-page/${id}`)

export const exportStatsListPage = (data) =>
  request.post('/admin/component-center/stats-list-page/export', data, { responseType: 'blob' })

export const downloadStatsListPageTemplate = (fileType = 'csv') =>
  request.get('/admin/component-center/stats-list-page/template', {
    params: { file_type: fileType },
    responseType: 'blob',
  })

export const importStatsListPage = (file) => {
  const formData = new FormData()
  formData.append('file', file)
  return request.post('/admin/component-center/stats-list-page/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}
