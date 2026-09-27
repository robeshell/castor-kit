import request from '@/shared/api/request'
import type { ApiBody, ApiItem, ApiQuery, ApiResponse } from '@/shared/api/types'

/** An announcement (times are ISO 8601 UTC); the list response is `{ items, total }` without page / per_page */
export type Announcement = ApiItem<'/api/admin/announcements'>
/** Create body; edit takes any subset of the same fields */
export type AnnouncementBody = ApiBody<'/api/admin/announcements', 'post'>
export type AnnouncementUpdateBody = ApiBody<'/api/admin/announcements/{item_id}', 'put'>
/** Export request: fields (none = every column), file_type, export_mode, ids */
export type AnnouncementExportBody = ApiBody<'/api/admin/announcements/export', 'post'>
/** Import template file type */
export type AnnouncementFileType = NonNullable<ApiQuery<'/api/admin/announcements/template'>['file_type']>

export const getAnnouncements = (params?: ApiQuery<'/api/admin/announcements'>) =>
  request.get<unknown, ApiResponse<'/api/admin/announcements'>>('/admin/announcements', { params })
export const createAnnouncement = (data: AnnouncementBody) =>
  request.post<unknown, ApiResponse<'/api/admin/announcements', 'post'>>('/admin/announcements', data)
export const updateAnnouncement = (id: number, data: AnnouncementUpdateBody) =>
  request.put<unknown, ApiResponse<'/api/admin/announcements/{item_id}', 'put'>>(`/admin/announcements/${id}`, data)
export const deleteAnnouncement = (id: number) =>
  request.delete<unknown, ApiResponse<'/api/admin/announcements/{item_id}', 'delete'>>(`/admin/announcements/${id}`)
export const publishAnnouncement = (id: number) =>
  request.post<unknown, ApiResponse<'/api/admin/announcements/{item_id}/publish', 'post'>>(`/admin/announcements/${id}/publish`)
export const unpublishAnnouncement = (id: number) =>
  request.post<unknown, ApiResponse<'/api/admin/announcements/{item_id}/unpublish', 'post'>>(
    `/admin/announcements/${id}/unpublish`
  )

export const exportAnnouncements = (data: AnnouncementExportBody) =>
  request.post<unknown, Blob>('/admin/announcements/export', data, { responseType: 'blob' })

export const downloadAnnouncementTemplate = (fileType: AnnouncementFileType = 'xlsx') =>
  request.get<unknown, Blob>('/admin/announcements/template', { params: { file_type: fileType }, responseType: 'blob' })

export const importAnnouncements = (file: Blob) => {
  const formData = new FormData()
  formData.append('file', file)
  return request.post<unknown, ApiResponse<'/api/admin/announcements/import', 'post'>>('/admin/announcements/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}
