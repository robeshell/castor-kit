import request from '@/shared/api/request'

export const getWebhooks = () => request.get('/admin/webhooks')
export const getWebhookEvents = () => request.get('/admin/webhooks/events')
/** Returns { item, secret } */
export const createWebhook = (data) => request.post('/admin/webhooks', data)
export const updateWebhook = (id, data) => request.put(`/admin/webhooks/${id}`, data)
export const deleteWebhook = (id) => request.delete(`/admin/webhooks/${id}`)
export const getWebhookSecret = (id) => request.get(`/admin/webhooks/${id}/secret`)
export const rotateWebhookSecret = (id) => request.post(`/admin/webhooks/${id}/secret`)
export const testWebhook = (id) => request.post(`/admin/webhooks/${id}/test`)
export const getWebhookDeliveries = (id, params) => request.get(`/admin/webhooks/${id}/deliveries`, { params })
export const redeliverWebhook = (deliveryId) => request.post(`/admin/webhooks/deliveries/${deliveryId}/redeliver`)
