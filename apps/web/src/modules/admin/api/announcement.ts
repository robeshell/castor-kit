import request from '@/shared/api/request'
import type { ApiBody, ApiItem, ApiQuery, ApiResponse } from '@/shared/api/types'

/** An announcement (times are ISO 8601 UTC); the list response is `{ items, total }` without page / per_page */
export type Announcement = ApiItem<'/api/admin/announcements'>
/**
 * Create body; edit takes any subset of the same fields.
 * TODO(openapi): the backend reads sort_order with field.int (null / missing → 0; announcementBody in
 * apps/api/src/modules/admin/announcement/schema.ts), so it takes null; the doc types it as a non-null number.
 */
export type AnnouncementBody = Omit<ApiBody<'/api/admin/announcements', 'post'>, 'sort_order'> & { sort_order?: number | null }
export type AnnouncementUpdateBody = Omit<ApiBody<'/api/admin/announcements/{item_id}', 'put'>, 'sort_order'> & {
  sort_order?: number | null
}
/**
 * Export request: fields (none = every column), file_type, export_mode, ids.
 * TODO(openapi): the backend reads fields with field.textList and file_type with field.text (announcementExportBody):
 * unknown fields are dropped and a file type other than csv / xlsx falls back to csv; the doc types both as enums.
 */
export type AnnouncementExportBody = Omit<ApiBody<'/api/admin/announcements/export', 'post'>, 'fields' | 'file_type'> & {
  fields?: string[]
  file_type?: string
}

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

/** TODO(openapi): the template route reads file_type as free text (anything but csv / xlsx → csv); the doc has the enum */
export const downloadAnnouncementTemplate = (fileType: string = 'xlsx') =>
  request.get<unknown, Blob>('/admin/announcements/template', { params: { file_type: fileType }, responseType: 'blob' })

export const importAnnouncements = (file: Blob) => {
  const formData = new FormData()
  formData.append('file', file)
  return request.post<unknown, ApiResponse<'/api/admin/announcements/import', 'post'>>('/admin/announcements/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}
