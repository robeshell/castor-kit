/**
 * Auth module schema layer
 *
 * The login body is checked on the route (it runs before authentication, which login doesn't need) and stays loose:
 * a wrong username or password type simply fails to sign in. Change-password is parsed in the handler after the
 * session check, so a signed-out caller gets 401, not 400.
 */

import { z } from 'zod'
import { passwordPolicyError, type PasswordPolicy } from '@/common/password-policy'
import { field } from '@/common/validation'

export const loginBodySchema = z
  .object({
    username: z.unknown().optional(),
    password: z.unknown().optional(),
  })
  .loose()
  .nullish()

export const changePasswordBody = z.object({
  old_password: field.secret('旧密码'),
  new_password: field.secret('新密码'),
})

export type ChangePasswordPayload = z.output<typeof changePasswordBody>

export function validateChangePasswordPayload(data: ChangePasswordPayload, policy: PasswordPolicy): string | null {
  if (!data.old_password || !data.new_password) return '请填写完整信息'
  return passwordPolicyError(data.new_password, policy, '新密码')
}
