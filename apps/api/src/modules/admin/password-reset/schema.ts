/**
 * Password reset schema layer: the request bodies. The password policy is checked by the service (it comes from
 * system settings).
 */

import { z } from 'zod'
import { field, required } from '@/common/validation'

const EMAIL_MESSAGE = '请输入正确的邮箱地址'
const INCOMPLETE_MESSAGE = '请填写完整信息'

export const resetRequestBody = z.object({
  email: field.requiredText('邮箱', EMAIL_MESSAGE).refine((v) => v.length <= 100 && v.includes('@'), { error: EMAIL_MESSAGE }),
})

export const resetConfirmBody = z.object({
  token: field.requiredText('重置链接', INCOMPLETE_MESSAGE),
  // Kept exactly as sent (no trimming), like every password
  new_password: required(field.secret('新密码'), INCOMPLETE_MESSAGE),
})

export type ResetRequestInput = z.output<typeof resetRequestBody>
export type ResetConfirmInput = z.output<typeof resetConfirmBody>
