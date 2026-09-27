import request from '@/shared/api/request'
import type { ApiBody, ApiItem, ApiQuery, ApiResponse } from '@/shared/api/types'

/** A notification with the caller's read state (times are ISO 8601 UTC) */
export type NotificationItem = ApiItem<'/api/admin/notifications'>

export const getNotifications = (params?: ApiQuery<'/api/admin/notifications'>) =>
  request.get<unknown, ApiResponse<'/api/admin/notifications'>>('/admin/notifications', { params })
export const getUnreadCount = () =>
  request.get<unknown, ApiResponse<'/api/admin/notifications/unread-count'>>('/admin/notifications/unread-count')
export const createNotification = (data: ApiBody<'/api/admin/notifications', 'post'>) =>
  request.post<unknown, ApiResponse<'/api/admin/notifications', 'post'>>('/admin/notifications', data)
export const markAsRead = (id: number) =>
  request.post<unknown, ApiResponse<'/api/admin/notifications/{noti_id}/read', 'post'>>(`/admin/notifications/${id}/read`)
export const markAllAsRead = () =>
  request.post<unknown, ApiResponse<'/api/admin/notifications/read-all', 'post'>>('/admin/notifications/read-all')
export const deleteNotification = (id: number) =>
  request.delete<unknown, ApiResponse<'/api/admin/notifications/{noti_id}', 'delete'>>(`/admin/notifications/${id}`)
