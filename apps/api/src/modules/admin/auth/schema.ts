/**
 * Auth module schema layer
 *
 * Request schemas are all loose (= zod 3 passthrough) with every field optional: bodies are read as lenient objects,
 * and missing/extra/mistyped fields are all handled in the service.
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
