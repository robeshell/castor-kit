/**
 * Home dashboard routes
 *
 * Login required only; no menu permission check.
 */

import type { FastifyInstance } from 'fastify'
import { loginRequired } from '@/common/auth'
import { DashboardService } from './service'

export async function registerDashboardRoutes(app: FastifyInstance): Promise<void> {
  const service = new DashboardService(app.db)
  app.get('/api/admin/dashboard/stats', { preHandler: loginRequired }, async () => service.stats())
}
