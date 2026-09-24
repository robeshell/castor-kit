/**
 * 认证模块 schema 层（对齐 AuraStack backend/app/admin/schema/auth.py）
 *
 * 移植期请求 schema 一律 loose（= zod 3 的 passthrough）+ 全字段可选：Flask 处理器是
 * `request.get_json() or {}` + `data.get(...)`，缺字段/多字段/类型不对都在 service 里处理。
 */

import { z } from 'zod'
import { pyStr, pyTruthy } from '@/common/py'

export const loginBodySchema = z
  .object({
    username: z.unknown().optional(),
    password: z.unknown().optional(),
  })
  .loose()
  .nullish()

export const changePasswordBodySchema = z
  .object({
    old_password: z.unknown().optional(),
    new_password: z.unknown().optional(),
  })
  .loose()
  .nullish()

export type ChangePasswordPayload = z.infer<typeof changePasswordBodySchema>

export function validateChangePasswordPayload(data: ChangePasswordPayload): string | null {
  const oldPassword = data?.old_password
  const newPassword = data?.new_password
  if (!pyTruthy(oldPassword) || !pyTruthy(newPassword)) return '请填写完整信息'
  if ([...pyStr(newPassword)].length < 6) return '新密码长度至少6位'
  return null
}
