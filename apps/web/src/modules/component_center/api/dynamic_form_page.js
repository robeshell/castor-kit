import request from '@/shared/api/request'

export const getDynamicFormPageList = (params) =>
  request.get('/admin/component-center/dynamic-form-page', { params })

export const getDynamicFormPageDetail = (id) =>
  request.get(`/admin/component-center/dynamic-form-page/${id}`)

export const createDynamicFormPage = (data) =>
  request.post('/admin/component-center/dynamic-form-page', data)

export const updateDynamicFormPage = (id, data) =>
  request.put(`/admin/component-center/dynamic-form-page/${id}`, data)

export const deleteDynamicFormPage = (id) =>
  request.delete(`/admin/component-center/dynamic-form-page/${id}`)

export const exportDynamicFormPage = (data) =>
  request.post('/admin/component-center/dynamic-form-page/export', data, { responseType: 'blob' })

export const downloadDynamicFormPageTemplate = (fileType = 'csv') =>
  request.get('/admin/component-center/dynamic-form-page/template', {
    params: { file_type: fileType },
    responseType: 'blob',
  })

export const importDynamicFormPage = (file) => {
  const formData = new FormData()
  formData.append('file', file)
  return request.post('/admin/component-center/dynamic-form-page/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}
