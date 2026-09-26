/**
 * Password reset routes: public, share the stricter sign-in rate limit
 */

import type { FastifyInstance } from 'fastify'
import { jsonBody } from '@/common/http'
import { requestLanguage } from '@/common/i18n'
import { authRateLimit } from '@/common/rate-limit'
import { getClientIp } from '@/common/request-meta'
import { PasswordResetService } from './service'

export async function registerPasswordResetRoutes(app: FastifyInstance): Promise<void> {
  const service = new PasswordResetService(app.db, app.settings, app.mailer, app.config.appBaseUrl, app.log)

  app.post('/api/admin/password-reset/request', { onRequest: authRateLimit(app) }, async (request) => {
    const { body } = await service.request(jsonBody(request), getClientIp(request), requestLanguage(request))
    return body
  })

  app.post('/api/admin/password-reset/confirm', { onRequest: authRateLimit(app) }, async (request) => {
    return service.confirm(jsonBody(request))
  })
}
