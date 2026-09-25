/**
 * AI chat page API - SSE streaming response
 *
 * Streaming responses use `reply.send(Readable)`, with @fastify/compress disabled for this route (`compress: false`):
 * - no compression → no buffering; each event is written out as soon as it is produced
 * - no reply.hijack(): hijack skips onSend, so secure-session's session-renewal Set-Cookie would never be sent;
 *   the normal send flow keeps onSend / onResponse (the global operation-log hook) running as usual
 * Abort the upstream request when the client disconnects (response closed before it finished).
 */

import { requestLanguage } from '@/common/i18n'
import { Readable } from 'node:stream'
import type { FastifyInstance } from 'fastify'
import { hasMenuPermission, loginRequired } from '@/common/auth'
import { jsonBody } from '@/common/http'
import { pyTruthy } from '@/common/py'
import { AiChatService } from './service'

const PERMISSION = 'cc_ai_chat'

/** Upstream timeout (60 s); exported only so tests can shorten it before buildApp */
export const CHAT_TIMINGS = { upstreamTimeoutMs: 60_000 }

export async function registerAiChatRoutes(app: FastifyInstance): Promise<void> {
  const service = new AiChatService(app.config, { timeoutMs: CHAT_TIMINGS.upstreamTimeoutMs, log: app.log })
  app.addHook('onClose', async () => service.close())

  app.post(
    '/api/admin/component-center/ai/chat/stream',
    { preHandler: loginRequired, compress: false },
    async (request, reply) => {
      if (!(await hasMenuPermission(request, PERMISSION))) {
        return reply.status(403).send({ error: '无权限' })
      }
      if (!service.configured) {
        return reply.status(500).send({ error: '未配置 AI_API_KEY' })
      }

      // The frontend sends the full message history, format: [{role, content}, ...]
      const data = jsonBody(request)
      const messages = pyTruthy(data.messages) ? data.messages : []
      if (!pyTruthy(messages)) {
        return reply.status(400).send({ error: '消息不能为空' })
      }
      // Return 500 when messages is not an array
      if (!Array.isArray(messages)) {
        throw new TypeError(`can only concatenate list (not "${typeof messages}") to list`)
      }

      const abort = new AbortController()
      reply.raw.on('close', () => {
        if (!reply.raw.writableFinished) abort.abort()
      })

      return reply
        .header('Content-Type', 'text/event-stream; charset=utf-8')
        .header('Cache-Control', 'no-cache')
        .header('X-Accel-Buffering', 'no')
        .send(Readable.from(service.stream(messages, abort.signal, requestLanguage(request))))
    },
  )
}
