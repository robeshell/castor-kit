import request from '@/shared/api/request'
import type { ApiBody, ApiItem, ApiQuery, ApiResponse } from '@/shared/api/types'

/** A webhook subscription with its latest delivery state (times are ISO 8601 UTC) */
export type Webhook = ApiItem<'/api/admin/webhooks'>
/** An event a webhook can subscribe to */
export type WebhookEvent = ApiItem<'/api/admin/webhooks/events'>
/** One delivery attempt record of a webhook */
export type WebhookDelivery = ApiItem<'/api/admin/webhooks/{webhook_id}/deliveries'>

export const getWebhooks = () => request.get<unknown, ApiResponse<'/api/admin/webhooks'>>('/admin/webhooks')
export const getWebhookEvents = () => request.get<unknown, ApiResponse<'/api/admin/webhooks/events'>>('/admin/webhooks/events')
/** Returns { item, secret } */
export const createWebhook = (data: ApiBody<'/api/admin/webhooks', 'post'>) =>
  request.post<unknown, ApiResponse<'/api/admin/webhooks', 'post'>>('/admin/webhooks', data)
export const updateWebhook = (id: number, data: ApiBody<'/api/admin/webhooks/{webhook_id}', 'put'>) =>
  request.put<unknown, ApiResponse<'/api/admin/webhooks/{webhook_id}', 'put'>>(`/admin/webhooks/${id}`, data)
export const deleteWebhook = (id: number) =>
  request.delete<unknown, ApiResponse<'/api/admin/webhooks/{webhook_id}', 'delete'>>(`/admin/webhooks/${id}`)
export const getWebhookSecret = (id: number) =>
  request.get<unknown, ApiResponse<'/api/admin/webhooks/{webhook_id}/secret'>>(`/admin/webhooks/${id}/secret`)
export const rotateWebhookSecret = (id: number) =>
  request.post<unknown, ApiResponse<'/api/admin/webhooks/{webhook_id}/secret', 'post'>>(`/admin/webhooks/${id}/secret`)
export const testWebhook = (id: number) =>
  request.post<unknown, ApiResponse<'/api/admin/webhooks/{webhook_id}/test', 'post'>>(`/admin/webhooks/${id}/test`)
export const getWebhookDeliveries = (id: number, params?: ApiQuery<'/api/admin/webhooks/{webhook_id}/deliveries'>) =>
  request.get<unknown, ApiResponse<'/api/admin/webhooks/{webhook_id}/deliveries'>>(`/admin/webhooks/${id}/deliveries`, { params })
export const redeliverWebhook = (deliveryId: number) =>
  request.post<unknown, ApiResponse<'/api/admin/webhooks/deliveries/{delivery_id}/redeliver', 'post'>>(
    `/admin/webhooks/deliveries/${deliveryId}/redeliver`
  )
