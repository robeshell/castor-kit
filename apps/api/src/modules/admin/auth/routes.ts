/**
 * 认证模块路由（对齐 AuraStack backend/app/admin/api/auth.py）
 */

import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { loginRequired } from '@/common/auth'
import { ensureCsrfToken } from '@/common/csrf'
import { getClientIp, getUserAgent } from '@/common/request-meta'
import { changePasswordBodySchema, loginBodySchema } from './schema'
import { AuthService } from './service'

export async function registerAuthRoutes(fastify: FastifyInstance): Promise<void> {
  const app = fastify.withTypeProvider<ZodTypeProvider>()
  const service = new AuthService(app.db, app.config, app.log)

  app.get('/admin/login', async (request, reply) => {
    return reply.redirect(request.session.get('logged_in') ? '/admin' : '/')
  })

  app.post('/api/admin/login', { schema: { body: loginBodySchema } }, async (request) => {
    const data = request.body ?? {}
    const { username, payload } = await service.login(data.username, data.password, {
      ip: getClientIp(request),
      userAgent: getUserAgent(request),
    })
    request.session.set('logged_in', true)
    request.session.set('username', username)
    return { ...payload, csrf_token: ensureCsrfToken(request.session) }
  })

  app.post('/api/admin/logout', async (request) => {
    const username = request.session.get('username') ?? ''
    const result = await service.logout(username, { ip: getClientIp(request), userAgent: getUserAgent(request) })
    // 等价 Flask session.clear()：先清空数据（后续 onResponse 审计 hook 读不到用户名），再删除 cookie
    request.session.regenerate()
    request.session.delete()
    return result
  })

  app.post(
    '/api/admin/change-password',
    { preHandler: loginRequired, schema: { body: changePasswordBodySchema } },
    async (request) => service.changePassword(request.session.get('username'), request.body),
  )

  app.get('/api/admin/me', { preHandler: loginRequired }, async (request) => {
    const payload = await service.getCurrentUser(request.session.get('username'))
    return { ...payload, csrf_token: ensureCsrfToken(request.session) }
  })

  app.get('/api/admin/csrf-token', { preHandler: loginRequired }, async (request) => {
    return { csrf_token: ensureCsrfToken(request.session) }
  })
}
