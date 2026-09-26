/**
 * Auth module routes
 */

import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { getCurrentAdminUser, loginRequired } from '@/common/auth'
import { ensureCsrfToken } from '@/common/csrf'
import { passwordPolicyOf } from '@/common/password-policy'
import { authRateLimit } from '@/common/rate-limit'
import { getClientIp, getUserAgent } from '@/common/request-meta'
import { attachSession, clearSession, createSession, isSignedIn, revokeSessions } from '@/common/session'
import { changePasswordBodySchema, loginBodySchema } from './schema'
import { AuthService } from './service'

export async function registerAuthRoutes(fastify: FastifyInstance): Promise<void> {
  const app = fastify.withTypeProvider<ZodTypeProvider>()
  const service = new AuthService(app.db, app.config, app.log, app.settings)

  app.get('/admin/login', async (request, reply) => {
    return reply.redirect(isSignedIn(request) ? '/admin' : '/')
  })

  app.post('/api/admin/login', { schema: { body: loginBodySchema }, onRequest: authRateLimit(app) }, async (request) => {
    const data = request.body ?? {}
    const client = { ip: getClientIp(request), userAgent: getUserAgent(request) }
    const settings = await app.settings.get()
    const twoFactor = {
      enabled: app.settings.isAvailable('security.totp_enabled', settings),
      requiredRoles: settings.totpRequiredRoles,
    }
    const result = await service.login(data.username, data.password, client, twoFactor)
    // A new session every time: the previous one (if any) is left to expire, and the CSRF token changes
    const sid = await createSession(app.db, result.userId, client, {
      ttlHours: settings.sessionTtlHours,
      mfaState: result.kind === 'mfa' ? result.state : null,
    })
    attachSession(request, { id: sid })
    const csrf_token = ensureCsrfToken(request.session)
    if (result.kind === 'mfa') {
      // Not signed in yet: the next call is POST /api/admin/login/two-factor (verify) or /api/admin/two-factor/setup
      const message = result.state === 'verify' ? '请输入两步验证码' : '你的账号需要先绑定两步验证'
      return { message, mfa_required: result.state, csrf_token }
    }
    return { ...result.payload, csrf_token }
  })

  app.post('/api/admin/logout', async (request) => {
    const user = await getCurrentAdminUser(request)
    const result = await service.logout(user, { ip: getClientIp(request), userAgent: getUserAgent(request) })
    if (request.authSession) await revokeSessions(app.db, { id: request.authSession.id })
    // Clear the session (this also stops the later onResponse audit hook from attributing the request), then the cookie
    clearSession(request)
    request.currentAdminUser = null
    return result
  })

  app.post(
    '/api/admin/change-password',
    { preHandler: loginRequired, schema: { body: changePasswordBodySchema } },
    async (request) => {
      const user = await getCurrentAdminUser(request)
      const result = await service.changePassword(user?.id, request.body, passwordPolicyOf(await app.settings.get()))
      // Other devices must sign in again with the new password; this one stays signed in
      await revokeSessions(app.db, { userId: user!.id, exceptId: request.authSession!.id })
      return result
    },
  )

  app.get('/api/admin/me', { preHandler: loginRequired }, async (request) => {
    const payload = await service.getCurrentUser(await getCurrentAdminUser(request))
    return { ...payload, csrf_token: ensureCsrfToken(request.session) }
  })

  app.get('/api/admin/csrf-token', { preHandler: loginRequired }, async (request) => {
    return { csrf_token: ensureCsrfToken(request.session) }
  })
}
