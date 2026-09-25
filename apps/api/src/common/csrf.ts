/**
 * CSRF 防护
 *
 * 基于会话 Cookie 的认证依赖浏览器自动携带 Cookie，需对状态变更请求校验双提交 token：
 * 前端在登录 / 获取当前用户时拿到 csrf_token，随请求头 X-CSRF-Token 提交，服务端与会话中的 token 比对。
 */

import { randomBytes, timingSafeEqual } from 'node:crypto'
import type { Session } from '@fastify/secure-session'
import type { FastifyInstance, FastifyRequest } from 'fastify'

export const CSRF_ERROR_MESSAGE = 'CSRF 校验失败，请刷新页面后重试'
const PROTECTED_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

/** 为当前会话生成/返回 CSRF token */
export function ensureCsrfToken(session: Session): string {
  let token = session.get('csrf_token')
  if (!token) {
    token = randomBytes(16).toString('hex')
    session.set('csrf_token', token)
  }
  return token
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  return ba.length === bb.length && timingSafeEqual(ba, bb)
}

export function requestPath(request: FastifyRequest): string {
  const raw = request.url.split('?', 1)[0] ?? '/'
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

/**
 * 对已登录会话的状态变更请求做 CSRF 校验
 * 挂在 preValidation（请求体已解析）而不是 onRequest：被拒请求的请求体仍要进操作日志
 * - 仅拦截 /api/ 下的 POST/PUT/PATCH/DELETE
 * - 登录接口本身豁免（此时尚未建立会话 token）
 * - 未登录请求跳过（由 loginRequired 处理）
 */
export function registerCsrfProtection(app: FastifyInstance): void {
  app.addHook('preValidation', async (request, reply) => {
    if (!PROTECTED_METHODS.has(request.method)) return
    const path = requestPath(request)
    if (!path.startsWith('/api/')) return
    if (path === '/api/admin/login') return
    if (!request.session.get('logged_in')) return

    const header = request.headers['x-csrf-token']
    const token = (Array.isArray(header) ? header[0] : header) ?? ''
    const expected = request.session.get('csrf_token') ?? ''
    if (!token || !expected || !safeEqual(token, expected)) {
      return reply.status(403).send({ error: CSRF_ERROR_MESSAGE })
    }
  })
}
