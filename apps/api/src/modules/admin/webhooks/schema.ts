/**
 * Webhooks module schema layer: the receiver request body. The address is checked here for its form only; whether
 * its host is allowed (DNS, reserved / internal addresses) is checked by the service.
 */

import { z } from 'zod'
import { hostOfUrl } from '@/common/outbound'
import { field, invalidMessage } from '@/common/validation'
import { isValidSubscription } from '@/common/webhooks'

const NAME_MESSAGE = '请填写名称（最多 100 个字符）'
const URL_MESSAGE = '请填写正确的地址（http:// 或 https://）'

// Keys in check order: the first failing field answers
export const webhookBody = z.object({
  name: field.requiredText('名称', NAME_MESSAGE).refine((v) => v.length <= 100, { error: NAME_MESSAGE }),
  url: field
    .requiredText('地址', URL_MESSAGE)
    .refine((v) => /^https?:\/\/[^\s/]+/i.test(v) && v.length <= 500 && hostOfUrl(v) !== '', { error: URL_MESSAGE }),
  events: field
    .textList('订阅事件')
    .transform((v) => [...new Set(v)])
    .refine((v) => v.length > 0, { error: '请至少订阅一个事件' })
    .superRefine((v, ctx) => {
      const unknown = v.filter((e) => !isValidSubscription(e))
      if (unknown.length > 0) ctx.addIssue({ code: 'custom', message: `未知的事件：${unknown.join(', ')}` })
    }),
  // Missing → true on create, kept on edit; null is rejected (it would otherwise switch an edited webhook on)
  is_active: z.boolean({ error: invalidMessage('是否启用') }).default(true),
})

export type WebhookInput = z.output<typeof webhookBody>
