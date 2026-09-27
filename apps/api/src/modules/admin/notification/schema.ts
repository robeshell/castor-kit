/**
 * Notification schema layer: request body
 */

import { z } from 'zod'
import { field } from '@/common/validation'

export const NOTI_TYPES = ['info', 'warning', 'success', 'error'] as const

export const notificationBody = z.object({
  title: field.requiredText('标题', '标题不能为空'),
  content: field.text('内容'),
  noti_type: field.choice('通知类型', NOTI_TYPES, 'info'),
  link: field.text('跳转链接'),
  is_global: field.bool('全局通知', true),
  user_id: field.id('接收用户'),
})

export type NotificationInput = z.output<typeof notificationBody>
