import i18n from '@/i18n'
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

export const uploadListPageImage = (file) => {
  const uploadFile = file?.fileInstance || file
  if (!uploadFile) {
    return Promise.reject(new Error(i18n.t('请先选择图片文件')))
  }
  const formData = new FormData()
  formData.append('file', uploadFile, uploadFile?.name || 'list-page-image')
  return request.post('/admin/component-center/list-page/upload-image', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

export const uploadListPageFile = (file) => {
  const uploadFile = file?.fileInstance || file
  if (!uploadFile) {
    return Promise.reject(new Error(i18n.t('请先选择文件')))
  }
  const formData = new FormData()
  formData.append('file', uploadFile, uploadFile?.name || 'list-page-file')
  return request.post('/admin/component-center/list-page/upload-file', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}
