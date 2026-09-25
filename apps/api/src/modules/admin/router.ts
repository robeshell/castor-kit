/**
 * admin 域路由装配
 */

import type { FastifyInstance } from 'fastify'
import { registerAnnouncementRoutes } from './announcement/routes'
import { registerAuthRoutes } from './auth/routes'
import { registerDashboardRoutes } from './dashboard/routes'
import { registerDictRoutes } from './dicts/routes'
import { registerLogsRoutes } from './logs/routes'
import { registerMenuRoutes } from './menu/routes'
import { registerNotificationRoutes } from './notification/routes'
import { registerRoleRoutes } from './roles/routes'
import { registerScheduledTaskRoutes } from './scheduled-task/routes'
import { registerUserRoutes } from './users/routes'

export async function registerAdminRoutes(app: FastifyInstance): Promise<void> {
  // logs 先注册：它挂的是全局 onResponse 审计 hook
  await registerLogsRoutes(app)
  await registerAuthRoutes(app)
  await registerUserRoutes(app)
  await registerRoleRoutes(app)
  await registerMenuRoutes(app)
  await registerDictRoutes(app)
  await registerScheduledTaskRoutes(app)
  await registerDashboardRoutes(app)
  await registerNotificationRoutes(app)
  await registerAnnouncementRoutes(app)
}
