/**
 * AI chat page API - streaming response (AI SDK UI message stream over SSE, read by useChat)
 *
 * Streaming responses use `reply.send(Readable)`, with @fastify/compress disabled for this route (`compress: false`):
 * - no compression → no buffering; each event is written out as soon as it is produced
 * - no reply.hijack(): hijack skips onSend, so secure-session's session-renewal Set-Cookie would never be sent;
 *   the normal send flow keeps onSend / onResponse (the global operation-log hook) running as usual
 * Abort the upstream request when the client disconnects (response closed before it finished).
 */

import { requestLanguage } from '@/common/i18n'
import { Readable } from 'node:stream'
import type { ReadableStream as NodeReadableStream } from 'node:stream/web'
import type { FastifyInstance } from 'fastify'
import { hasMenuPermission, loginRequired } from '@/common/auth'
import { jsonBody } from '@/common/http'
import { AiChatService } from './service'

const PERMISSION = 'cc_ai_chat'

/** Upstream timeout (60 s); exported only so tests can shorten it before buildApp */
export const CHAT_TIMINGS = { upstreamTimeoutMs: 60_000 }

export async function registerAiChatRoutes(app: FastifyInstance): Promise<void> {
  const service = new AiChatService(app.config, async () => (await app.settings.get()).ai, {
    timeoutMs: CHAT_TIMINGS.upstreamTimeoutMs,
    log: app.log,
    // An API URL pinned by AI_API_BASE is the operator's choice; one typed on the settings page stays off internal networks
    allowPrivate: app.config.settingsAllowPrivateNetwork || app.settings.isPinned('ai.api_base'),
  })
  app.addHook('onClose', async () => service.close())

  app.post(
    '/api/admin/component-center/ai/chat/stream',
    { preHandler: loginRequired, compress: false },
    async (request, reply) => {
      if (!(await hasMenuPermission(request, PERMISSION))) {
        return reply.status(403).send({ error: '无权限' })
      }
      if (!(await service.isConfigured())) {
        return reply.status(500).send({ error: '未配置 AI 模型，请在「系统设置 → AI」中填写 API Key 和模型名' })
      }

      // The page (useChat) sends the conversation as UI messages: [{ id, role, parts }, …]
      const messages = await service.parseMessages(jsonBody(request).messages)

      const abort = new AbortController()
      reply.raw.on('close', () => {
        if (!reply.raw.writableFinished) abort.abort()
      })

      const res = await service.stream(messages, abort.signal, requestLanguage(request))
      res.headers.forEach((value, key) => reply.header(key, value))
      return reply
        .status(res.status)
        .header('X-Accel-Buffering', 'no')
        .send(Readable.fromWeb(res.body as NodeReadableStream))
    },
  )
}
