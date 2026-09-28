/**
 * Home dashboard routes
 *
 * Login required only; no menu permission check. `/system` is the system status card (CPU, memory, disk, network of
 * the machine running the API), polled by the dashboard.
 */

import type { FastifyInstance } from 'fastify'
import { loginRequired } from '@/common/auth'
import { systemSnapshot, warmUp } from '@/common/system-stats'
import { currentTimeZone } from '@/common/time-zone'
import { DashboardService } from './service'

export async function registerDashboardRoutes(app: FastifyInstance): Promise<void> {
  const service = new DashboardService(app.db)
  app.get('/api/admin/dashboard/stats', { preHandler: loginRequired }, async () => service.stats(currentTimeZone()))
  // CPU usage needs a baseline sample; take it now (without blocking startup) so the first poll isn't 0
  void warmUp()
  app.get('/api/admin/dashboard/system', { preHandler: loginRequired }, async () => systemSnapshot())
}
