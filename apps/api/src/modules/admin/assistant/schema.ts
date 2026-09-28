/**
 * AI assistant schema layer: request body
 *
 * Parsed in the handler after the login and "assistant enabled" checks. `messages` is the chat's list of UI messages
 * (validated by parseChatMessages); `context` is the page being viewed, only used in the system prompt.
 */

import { z } from 'zod'
import { chatMessages } from '@/common/ai-chat'
import { field, invalidMessage } from '@/common/validation'

/** Text cut to `max` characters (it only goes into the prompt, so it is shortened rather than refused); blank → undefined */
const clipped = (label: string, max: number) => field.text(label).transform((v) => v?.slice(0, max) || undefined)

/** The page being viewed; missing / null → {} */
const pageContext = z
  .object({ path: clipped('页面路径', 200), title: clipped('页面标题', 100) }, { error: invalidMessage('页面上下文') })
  .nullish()
  .transform((v) => v ?? {})

export const assistantChatBody = z.object({
  messages: chatMessages,
  context: pageContext,
})
