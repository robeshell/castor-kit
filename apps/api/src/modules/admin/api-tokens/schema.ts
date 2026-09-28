/**
 * API tokens module schema layer: request bodies
 */

import { z } from 'zod'
import { field, invalidMessage } from '@/common/validation'

/** Longest lifetime a token can be given, in days */
export const MAX_DAYS = 3650

const NAME_MESSAGE = '请填写名称（最多 100 个字符）'
// Keep the number in step with MAX_DAYS (a literal, so the message has one translation entry)
const DAYS_MESSAGE = '有效期请填 1–3650 之间的整数（天），或选择永不过期'

/** Create body; whether the caller may grant each scope is checked in the service */
export const apiTokenBody = z.object({
  name: field.requiredText('名称', NAME_MESSAGE).refine((v) => v.length <= 100, { error: NAME_MESSAGE }),
  /** Menu / button codes, duplicates removed */
  scopes: field
    .textList('权限')
    .transform((v) => [...new Set(v)])
    .refine((v) => v.length > 0, { error: '请至少选择一项权限' }),
  /** Days until it expires, or null for never; must be sent, so a long-lived credential is never made by omission */
  expires_in_days: z
    .number({ error: invalidMessage('有效期') })
    .int({ error: DAYS_MESSAGE })
    .min(1, { error: DAYS_MESSAGE })
    .max(MAX_DAYS, { error: DAYS_MESSAGE })
    .nullable(),
})

export type ApiTokenInput = z.output<typeof apiTokenBody>
