/**
 * Chat plumbing shared by every AI chat endpoint (the global AI assistant and the gallery's AI chat page): the
 * request's `messages` field, validating it as AI SDK UI messages, and the generic error text a client gets when the
 * model call fails (the upstream status at most, never its body; details go to the server log).
 */

import { safeValidateUIMessages, type UIMessage } from 'ai'
import { z } from 'zod'
import { isTimeoutError, upstreamStatusOf } from '@/common/ai'
import { ServiceError } from '@/common/errors'
import { translateMessage, type Language } from '@/common/i18n'
import { invalidMessage, required } from '@/common/validation'

/** Longest conversation accepted (messages after the last "clear context") */
const MAX_MESSAGES = 200

/** The conversation as UI messages ([{ id, role, parts }, …]); each message is checked by parseChatMessages */
export const chatMessages = required(z.array(z.unknown(), { error: invalidMessage('消息') }).nullish(), '消息不能为空')

/** Generic, translated text for a failed call: the upstream status at most, never its body */
export function chatErrorMessage(err: unknown, lang: Language): string {
  if (isTimeoutError(err)) return translateMessage('请求超时，请重试', lang)
  const status = upstreamStatusOf(err)
  if (status) return translateMessage(`AI 服务暂时不可用（${status}），请稍后重试`, lang)
  return translateMessage('AI 响应异常，请稍后重试', lang)
}

/** A chat request's messages (a list, see chatMessages) as UI messages; 400 when empty or malformed */
export async function parseChatMessages(raw: unknown[]): Promise<UIMessage[]> {
  if (raw.length === 0) throw new ServiceError('消息不能为空', 400)
  if (raw.length > MAX_MESSAGES) throw new ServiceError('对话太长，请清除上下文后再试', 400)
  const result = await safeValidateUIMessages({ messages: raw })
  if (!result.success) throw new ServiceError('消息格式不正确', 400)
  // A reply that failed before any text arrived stays in the page's history as an empty assistant message;
  // model APIs reject empty assistant turns, so they are dropped here
  const hasContent = (m: UIMessage) =>
    m.parts.some((p) => (p.type === 'text' ? Boolean(p.text.trim()) : p.type === 'file' || p.type.startsWith('tool-')))
  const messages = result.data.filter((m) => m.role !== 'assistant' || hasContent(m))
  if (!messages.some((m) => m.role === 'user')) throw new ServiceError('消息不能为空', 400)
  return messages
}
