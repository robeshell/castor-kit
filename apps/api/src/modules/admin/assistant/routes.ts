/**
 * AI assistant route: POST /api/admin/assistant/chat — a UI message stream for the page's useChat.
 *
 * Any signed-in user may use it once the switch (System settings → AI → AI 小助手) is on; what it can read or change
 * is whatever that user could (see service.ts). Not for API tokens. Streaming follows the AI chat route: reply.send
 * with a Readable (keeps session renewal and operation logs), no compression, upstream aborted when the client leaves.
 */

import { Readable } from 'node:stream'
import type { ReadableStream as NodeReadableStream } from 'node:stream/web'
import type { FastifyInstance } from 'fastify'
import { loginRequired } from '@/common/auth'
import { jsonBody } from '@/common/http'
import { requestLanguage } from '@/common/i18n'
import { parseChatMessages } from '@/modules/component-center/ai-chat/service'
import { AssistantService, type PageContext } from './service'

export async function registerAssistantRoutes(app: FastifyInstance): Promise<void> {
  const service = new AssistantService(app)
  app.addHook('onClose', async () => service.close())

  app.post('/api/admin/assistant/chat', { preHandler: loginRequired, compress: false }, async (request, reply) => {
    const settings = await app.settings.get()
    if (!app.settings.isAvailable('ai.assistant_enabled', settings)) {
      return reply.status(403).send({ error: 'AI 小助手未开启' })
    }
    const body = jsonBody(request)
    const messages = await parseChatMessages(body.messages)
    const raw = (body.context ?? {}) as Record<string, unknown>
    const context: PageContext = {
      path: typeof raw.path === 'string' ? raw.path.slice(0, 200) : undefined,
      title: typeof raw.title === 'string' ? raw.title.slice(0, 100) : undefined,
    }

    const abort = new AbortController()
    reply.raw.on('close', () => {
      if (!reply.raw.writableFinished) abort.abort()
    })
    const res = await service.stream(request, messages, context, abort.signal, requestLanguage(request))
    res.headers.forEach((value, key) => reply.header(key, value))
    return reply
      .status(res.status)
      .header('X-Accel-Buffering', 'no')
      .send(Readable.fromWeb(res.body as NodeReadableStream))
  })
}
