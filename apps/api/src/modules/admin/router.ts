/**
 * admin domain router assembly
 */

import type { FastifyInstance } from 'fastify'
import { registerAnnouncementRoutes } from './announcement/routes'
import { registerApiTokenRoutes } from './api-tokens/routes'
import { registerAuthRoutes } from './auth/routes'
import { registerDashboardRoutes } from './dashboard/routes'
import { registerDepartmentRoutes } from './departments/routes'
import { registerDictRoutes } from './dicts/routes'
import { registerFileRoutes } from './files/routes'
import { registerLogsRoutes } from './logs/routes'
import { registerMenuRoutes } from './menu/routes'
import { registerNotificationRoutes } from './notification/routes'
import { registerPasswordResetRoutes } from './password-reset/routes'
import { registerRoleRoutes } from './roles/routes'
import { registerScheduledTaskRoutes } from './scheduled-task/routes'
import { registerSessionRoutes } from './sessions/routes'
import { registerSettingsRoutes } from './settings/routes'
import { registerTwoFactorRoutes } from './two-factor/routes'
import { registerUserRoutes } from './users/routes'

export async function registerAdminRoutes(app: FastifyInstance): Promise<void> {
  // Register logs first: it installs the global onResponse audit hook
  await registerLogsRoutes(app)
  await registerAuthRoutes(app)
  await registerUserRoutes(app)
  await registerRoleRoutes(app)
  await registerDepartmentRoutes(app)
  await registerFileRoutes(app)
  await registerSettingsRoutes(app)
  await registerSessionRoutes(app)
  await registerTwoFactorRoutes(app)
  await registerApiTokenRoutes(app)
  await registerPasswordResetRoutes(app)
  await registerMenuRoutes(app)
  await registerDictRoutes(app)
  await registerScheduledTaskRoutes(app)
  await registerDashboardRoutes(app)
  await registerNotificationRoutes(app)
  await registerAnnouncementRoutes(app)
}
