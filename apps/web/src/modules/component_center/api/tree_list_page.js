import request from '@/shared/api/request'

export const getTreeListPageTree = (params) =>
  request.get('/admin/component-center/tree-list-page/tree', { params })

export const getTreeListPageList = (params) =>
  request.get('/admin/component-center/tree-list-page', { params })

export const getTreeListPageDetail = (id) =>
  request.get(`/admin/component-center/tree-list-page/${id}`)

export const createTreeListPage = (data) =>
  request.post('/admin/component-center/tree-list-page', data)

export const updateTreeListPage = (id, data) =>
  request.put(`/admin/component-center/tree-list-page/${id}`, data)

export const deleteTreeListPage = (id) =>
  request.delete(`/admin/component-center/tree-list-page/${id}`)

export const exportTreeListPage = (data) =>
  request.post('/admin/component-center/tree-list-page/export', data, { responseType: 'blob' })

export const downloadTreeListPageTemplate = (fileType = 'csv') =>
  request.get('/admin/component-center/tree-list-page/template', {
    params: { file_type: fileType },
    responseType: 'blob',
  })

export const importTreeListPage = (file) => {
  const formData = new FormData()
  formData.append('file', file)
  return request.post('/admin/component-center/tree-list-page/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}
