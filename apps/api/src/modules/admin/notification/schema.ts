/**
 * 通知消息 schema 层：请求归一化
 */

import { ServiceError } from '@/common/errors'
import { pyTruthy } from '@/common/py'

export const NOTI_TYPES = ['info', 'warning', 'success', 'error'] as const

/**
 * `(data.get(key) or '').strip()`：假值 → ''；真值必须是字符串，
 * 否则抛错（未捕获 → 全局 500）。
 */
export function stripOrEmpty(value: unknown): string {
  if (!pyTruthy(value)) return ''
  if (typeof value !== 'string') throw new ServiceError(`'${typeof value}' object has no attribute 'strip'`, 500)
  return value.trim()
}

/** `noti_type = data.get('noti_type', 'info')`，不在白名单 → 'info' */
export function normalizeNotiType(value: unknown): string {
  return typeof value === 'string' && (NOTI_TYPES as readonly string[]).includes(value) ? value : 'info'
}
