/**
 * 首页仪表盘路由
 *
 * 只要求登录，不校验菜单权限。
 */

import type { FastifyInstance } from 'fastify'
import { loginRequired } from '@/common/auth'
import { DashboardService } from './service'

export async function registerDashboardRoutes(app: FastifyInstance): Promise<void> {
  const service = new DashboardService(app.db)
  app.get('/api/admin/dashboard/stats', { preHandler: loginRequired }, async () => service.stats())
}
