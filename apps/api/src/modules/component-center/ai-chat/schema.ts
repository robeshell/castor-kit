/**
 * AI chat schema layer: request body
 *
 * Parsed in the handler after the permission and "model configured" checks. Only the outer shape is declared here:
 * `messages` is a list; each message is validated as an AI SDK UI message by parseChatMessages (service.ts).
 */

import { z } from 'zod'
import { invalidMessage, required } from '@/common/validation'

/** The conversation as UI messages ([{ id, role, parts }, …]); shared with the AI assistant */
export const chatMessages = required(z.array(z.unknown(), { error: invalidMessage('消息') }).nullish(), '消息不能为空')

export const chatBody = z.object({ messages: chatMessages })
