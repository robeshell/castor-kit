/**
 * Password reset routes: public, share the stricter sign-in rate limit
 */

import type { FastifyInstance } from 'fastify'
import { requestLanguage } from '@/common/i18n'
import { authRateLimit } from '@/common/rate-limit'
import { getClientIp } from '@/common/request-meta'
import { routeBody } from '@/common/validation'
import { resetConfirmBody, resetRequestBody } from './schema'
import { PasswordResetService } from './service'

export async function registerPasswordResetRoutes(app: FastifyInstance): Promise<void> {
  const service = new PasswordResetService(app.db, app.settings, app.mailer, app.log)

  const resetRequestInput = routeBody(resetRequestBody, 'create')
  app.post('/api/admin/password-reset/request', { onRequest: authRateLimit(app), ...resetRequestInput.route }, async (request) => {
    const { body } = await service.request(resetRequestInput.parse(request), getClientIp(request), requestLanguage(request))
    return body
  })

  const resetConfirmInput = routeBody(resetConfirmBody, 'create')
  app.post('/api/admin/password-reset/confirm', { onRequest: authRateLimit(app), ...resetConfirmInput.route }, async (request) => {
    return service.confirm(resetConfirmInput.parse(request))
  })
}
