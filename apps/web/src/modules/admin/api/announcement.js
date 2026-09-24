import request from '@/shared/api/request'

export const getAnnouncements = (params) => request.get('/admin/announcements', { params })
export const createAnnouncement = (data) => request.post('/admin/announcements', data)
export const updateAnnouncement = (id, data) => request.put(`/admin/announcements/${id}`, data)
export const deleteAnnouncement = (id) => request.delete(`/admin/announcements/${id}`)
export const publishAnnouncement = (id) => request.post(`/admin/announcements/${id}/publish`)
export const unpublishAnnouncement = (id) => request.post(`/admin/announcements/${id}/unpublish`)

export const exportAnnouncements = (data) =>
  request.post('/admin/announcements/export', data, { responseType: 'blob' })

export const downloadAnnouncementTemplate = (fileType = 'xlsx') =>
  request.get('/admin/announcements/template', { params: { file_type: fileType }, responseType: 'blob' })

export const importAnnouncements = (file) => {
  const formData = new FormData()
  formData.append('file', file)
  return request.post('/admin/announcements/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}
