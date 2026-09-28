/**
 * AI chat schema layer: request body
 *
 * Parsed in the handler after the permission and "model configured" checks. Only the outer shape is declared here:
 * `messages` is a list; each message is validated as an AI SDK UI message by parseChatMessages (common/ai-chat.ts).
 */

import { z } from 'zod'
import { chatMessages } from '@/common/ai-chat'

export const chatBody = z.object({ messages: chatMessages })
