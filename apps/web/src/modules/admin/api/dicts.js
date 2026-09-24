import request from '@/shared/api/request'

export const getDictTypes = (params) => request.get('/admin/dicts', { params })
export const getDictTypeDetail = (id, params) => request.get(`/admin/dicts/${id}`, { params })
export const getDictOptions = (codes) => request.get('/admin/dicts/options', {
  params: { codes: Array.isArray(codes) ? codes.join(',') : codes },
})
export const createDictType = (data) => request.post('/admin/dicts', data)
export const updateDictType = (id, data) => request.put(`/admin/dicts/${id}`, data)
export const deleteDictType = (id) => request.delete(`/admin/dicts/${id}`)

export const getDictItems = (dictId, params) => request.get(`/admin/dicts/${dictId}/items`, { params })
export const exportDictItems = (dictId, fileType = 'csv') =>
  request.get(`/admin/dicts/${dictId}/items/export`, {
    params: { file_type: fileType },
    responseType: 'blob',
  })
export const downloadDictItemsTemplate = (dictId, fileType = 'csv') =>
  request.get(`/admin/dicts/${dictId}/items/template`, {
    params: { file_type: fileType },
    responseType: 'blob',
  })
export const importDictItems = (dictId, file) => {
  const formData = new FormData()
  formData.append('file', file)
  return request.post(`/admin/dicts/${dictId}/items/import`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}
export const createDictItem = (dictId, data) => request.post(`/admin/dicts/${dictId}/items`, data)
export const updateDictItem = (id, data) => request.put(`/admin/dicts/items/${id}`, data)
export const deleteDictItem = (id) => request.delete(`/admin/dicts/items/${id}`)
