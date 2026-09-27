import request from '@/shared/api/request'
import type { ApiBody, ApiItem, ApiQuery, ApiResponse } from '@/shared/api/types'

/** An announcement (times are ISO 8601 UTC); the list response is `{ items, total }` without page / per_page */
export type Announcement = ApiItem<'/api/admin/announcements'>

export const getAnnouncements = (params?: ApiQuery<'/api/admin/announcements'>) =>
  request.get<unknown, ApiResponse<'/api/admin/announcements'>>('/admin/announcements', { params })
export const createAnnouncement = (data: ApiBody<'/api/admin/announcements', 'post'>) =>
  request.post<unknown, ApiResponse<'/api/admin/announcements', 'post'>>('/admin/announcements', data)
export const updateAnnouncement = (id: number, data: ApiBody<'/api/admin/announcements/{item_id}', 'put'>) =>
  request.put<unknown, ApiResponse<'/api/admin/announcements/{item_id}', 'put'>>(`/admin/announcements/${id}`, data)
export const deleteAnnouncement = (id: number) =>
  request.delete<unknown, ApiResponse<'/api/admin/announcements/{item_id}', 'delete'>>(`/admin/announcements/${id}`)
export const publishAnnouncement = (id: number) =>
  request.post<unknown, ApiResponse<'/api/admin/announcements/{item_id}/publish', 'post'>>(`/admin/announcements/${id}/publish`)
export const unpublishAnnouncement = (id: number) =>
  request.post<unknown, ApiResponse<'/api/admin/announcements/{item_id}/unpublish', 'post'>>(
    `/admin/announcements/${id}/unpublish`
  )

export const exportAnnouncements = (data: ApiBody<'/api/admin/announcements/export', 'post'>) =>
  request.post<unknown, Blob>('/admin/announcements/export', data, { responseType: 'blob' })

export const downloadAnnouncementTemplate = (fileType: ApiQuery<'/api/admin/announcements/template'>['file_type'] = 'xlsx') =>
  request.get<unknown, Blob>('/admin/announcements/template', { params: { file_type: fileType }, responseType: 'blob' })

export const importAnnouncements = (file: Blob) => {
  const formData = new FormData()
  formData.append('file', file)
  return request.post<unknown, ApiResponse<'/api/admin/announcements/import', 'post'>>('/admin/announcements/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}
