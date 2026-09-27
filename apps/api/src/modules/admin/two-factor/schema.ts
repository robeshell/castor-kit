/**
 * Two-factor module schema layer: request bodies
 *
 * Parsed in the handlers after the session check (and, for sign-in and re-verification, after the lockout check), so a
 * signed-out or locked-out caller gets 401 / 429, not 400. Codes are only trimmed here: a code in the wrong format is
 * simply wrong (「验证码错误」), the same answer as a wrong code. Passwords are kept exactly as sent.
 */

import { z } from 'zod'
import { field } from '@/common/validation'

/** A sign-in code: `code` (6 digits from the app) or `recovery_code` */
export const codeBody = z.object({
  code: field.text('验证码'),
  recovery_code: field.text('恢复码'),
})

/** Finishing enrollment: the first code from the app */
export const enableBody = codeBody.pick({ code: true })

/** Re-verification: the password, plus a code for enrolled users */
export const reauthBody = codeBody.extend({
  password: field.secret('密码'),
})

/** Turning 2FA off / new recovery codes */
export const passwordBody = z.object({
  password: field.secret('密码'),
})

export type CodeInput = z.output<typeof codeBody>
export type EnableInput = z.output<typeof enableBody>
export type PasswordInput = z.output<typeof passwordBody>
