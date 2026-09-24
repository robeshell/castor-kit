/**
 * AI 对话页 API - SSE 流式响应（对齐 AuraStack backend/app/component_center/api/ai_chat.py）
 *
 * 流式响应用 `reply.send(Readable)`，并对本路由关闭 @fastify/compress（`compress: false`）：
 * - 不压缩 → 不攒缓冲，每个事件产生后立即 write 下发
 * - 不用 reply.hijack()：hijack 会跳过 onSend，secure-session 的会话续期 Set-Cookie 就发不出去；
 *   走正常 send 流程时 onSend / onResponse（全局操作日志 hook）都照常执行，与 Flask 一致
 * 客户端断开（响应 close 且未写完）时中止上游请求。
 */

import { Readable } from 'node:stream'
import type { FastifyInstance } from 'fastify'
import { hasMenuPermission, loginRequired } from '@/common/auth'
import { jsonBody } from '@/common/http'
import { pyTruthy } from '@/common/py'
import { AiChatService } from './service'

const PERMISSION = 'cc_ai_chat'

/** 上游超时（对齐 requests timeout=60）；导出仅供测试在 buildApp 之前缩短 */
export const CHAT_TIMINGS = { upstreamTimeoutMs: 60_000 }

export async function registerAiChatRoutes(app: FastifyInstance): Promise<void> {
  const service = new AiChatService(app.config, { timeoutMs: CHAT_TIMINGS.upstreamTimeoutMs })
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

      // 前端传来完整的消息历史，格式：[{role, content}, ...]
      const data = jsonBody(request)
      const messages = pyTruthy(data.messages) ? data.messages : []
      if (!pyTruthy(messages)) {
        return reply.status(400).send({ error: '消息不能为空' })
      }
      // Python 里 `[system_prompt] + messages` 对非 list 抛 TypeError → 500
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
        .send(Readable.from(service.stream(messages, abort.signal)))
    },
  )
}
