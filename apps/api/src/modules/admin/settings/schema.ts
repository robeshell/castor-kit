/**
 * System settings module schema layer: request bodies
 *
 * Parsed in the handlers after the permission and recent-verification checks. Only the outer shape is declared here:
 * `values` is a { key: value } map whose keys and values are validated by the settings registry (common/settings.ts).
 */

import { z } from 'zod'
import { field, invalidMessage, required, withDefault } from '@/common/validation'

const EMAIL_RE = /^[^\s@]+@[^\s@]+$/

/** { key: value } pairs; null resets a value */
const settingValues = z.record(z.string(), z.unknown(), { error: invalidMessage('设置项') }).nullish()

/** Save: `values` is required */
export const updateBody = z.object({
  values: required(settingValues, '请提交要保存的设置'),
})

/** Test buttons: `values` is the unsaved draft applied on top of the saved settings (none → the saved settings) */
export const testBody = z.object({
  values: withDefault(settingValues, {}),
})

export const testMailBody = testBody.extend({
  to: field.requiredText('收件邮箱', '请输入正确的邮箱地址').refine((v) => EMAIL_RE.test(v), { error: '请输入正确的邮箱地址' }),
})
