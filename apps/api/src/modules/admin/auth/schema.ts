/**
 * Auth module schema layer
 *
 * Request schemas are all loose (= zod 3 passthrough) with every field optional: bodies are read as lenient objects,
 * and missing/extra/mistyped fields are all handled in the service.
 */

import { z } from 'zod'
import { passwordPolicyError, type PasswordPolicy } from '@/common/password-policy'
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

export function validateChangePasswordPayload(data: ChangePasswordPayload, policy: PasswordPolicy): string | null {
  const oldPassword = data?.old_password
  const newPassword = data?.new_password
  if (!pyTruthy(oldPassword) || !pyTruthy(newPassword)) return '请填写完整信息'
  return passwordPolicyError(pyStr(newPassword), policy, '新密码')
}
