/**
 * Password reset routes: public, share the stricter sign-in rate limit
 */

import type { FastifyInstance } from 'fastify'
import { requestLanguage } from '@/common/i18n'
import { authRateLimit } from '@/common/rate-limit'
import { getClientIp } from '@/common/request-meta'
import { parseBody } from '@/common/validation'
import { resetConfirmBody, resetRequestBody } from './schema'
import { PasswordResetService } from './service'

export async function registerPasswordResetRoutes(app: FastifyInstance): Promise<void> {
  const service = new PasswordResetService(app.db, app.settings, app.mailer, app.log)

  app.post('/api/admin/password-reset/request', { onRequest: authRateLimit(app) }, async (request) => {
    const { body } = await service.request(parseBody(resetRequestBody, request.body), getClientIp(request), requestLanguage(request))
    return body
  })

  app.post('/api/admin/password-reset/confirm', { onRequest: authRateLimit(app) }, async (request) => {
    return service.confirm(parseBody(resetConfirmBody, request.body))
  })
}
