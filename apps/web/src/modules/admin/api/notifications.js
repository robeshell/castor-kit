import request from '@/shared/api/request'

export const getNotifications = (params) => request.get('/admin/notifications', { params })
export const getUnreadCount = () => request.get('/admin/notifications/unread-count')
export const createNotification = (data) => request.post('/admin/notifications', data)
export const markAsRead = (id) => request.post(`/admin/notifications/${id}/read`)
export const markAllAsRead = () => request.post('/admin/notifications/read-all')
export const deleteNotification = (id) => request.delete(`/admin/notifications/${id}`)
