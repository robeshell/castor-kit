/**
 * System settings module routes: system_settings to view, system_settings_edit to save and to run the test buttons.
 * Saving and testing also need a recent sign-in or re-verification (requireRecentAuth): a stolen session alone can't
 * point mail, storage or AI somewhere else
 */

import type { FastifyInstance } from 'fastify'
import { getCurrentAdminUser, hasMenuPermission, loginRequired } from '@/common/auth'
import { authRateLimit } from '@/common/rate-limit'
import { requireRecentAuth } from '@/common/session'
import { routeBody } from '@/common/validation'
import { testBody, testMailBody, updateBody } from './schema'
import { SettingsService } from './service'

export async function registerSettingsRoutes(app: FastifyInstance): Promise<void> {
  const service = new SettingsService(app.db, app.settings, app.config, app.log)
  const opts = { preHandler: loginRequired }
  // The test buttons reach out to other servers: same stricter per-IP limit as sign-in
  const testOpts = { preHandler: loginRequired, onRequest: authRateLimit(app) }

  app.get('/api/admin/settings', opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'system_settings'))) {
      return reply.status(403).send({ error: '无权限查看系统设置' })
    }
    return service.list()
  })

  const updateInput = routeBody(updateBody, 'create')
  app.put('/api/admin/settings', { ...opts, ...updateInput.route }, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'system_settings_edit'))) {
      return reply.status(403).send({ error: '无权限修改系统设置' })
    }
    requireRecentAuth(request)
    const user = await getCurrentAdminUser(request)
    return service.update(updateInput.parse(request).values, user?.id ?? null, user?.nickname || user?.username)
  })

  const testMailInput = routeBody(testMailBody, 'create')
  app.post('/api/admin/settings/test/mail', { ...testOpts, ...testMailInput.route }, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'system_settings_edit'))) {
      return reply.status(403).send({ error: '无权限修改系统设置' })
    }
    requireRecentAuth(request)
    const { values, to } = testMailInput.parse(request)
    return service.testMail(values, to)
  })

  const testInput = routeBody(testBody, 'create')
  app.post('/api/admin/settings/test/storage', { ...testOpts, ...testInput.route }, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'system_settings_edit'))) {
      return reply.status(403).send({ error: '无权限修改系统设置' })
    }
    requireRecentAuth(request)
    return service.testStorage(testInput.parse(request).values)
  })

  app.post('/api/admin/settings/test/ai', { ...testOpts, ...testInput.route }, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'system_settings_edit'))) {
      return reply.status(403).send({ error: '无权限修改系统设置' })
    }
    requireRecentAuth(request)
    return service.testAi(testInput.parse(request).values)
  })
}
