/**
 * Settings module routes (系统设置): system_settings to view, system_settings_edit to save
 */

import type { FastifyInstance } from 'fastify'
import { getCurrentAdminUser, hasMenuPermission, loginRequired } from '@/common/auth'
import { jsonBody } from '@/common/http'
import { SettingsService } from './service'

export async function registerSettingsRoutes(app: FastifyInstance): Promise<void> {
  const service = new SettingsService(app.db, app.settings)
  const opts = { preHandler: loginRequired }

  app.get('/api/admin/settings', opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'system_settings'))) {
      return reply.status(403).send({ error: '无权限查看系统设置' })
    }
    return service.list()
  })

  app.put('/api/admin/settings', opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'system_settings_edit'))) {
      return reply.status(403).send({ error: '无权限修改系统设置' })
    }
    const user = await getCurrentAdminUser(request)
    return service.update(jsonBody(request).values, user?.id ?? null)
  })
}
