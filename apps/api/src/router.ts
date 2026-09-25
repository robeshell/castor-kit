/**
 * Top-level router assembly
 * New domains must be registered here and their table definitions exported from db/schema/index.ts.
 */

import type { FastifyInstance } from 'fastify'
import { registerAdminRoutes } from './modules/admin/router'
import { registerComponentCenterRoutes } from './modules/component-center/router'

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  await registerAdminRoutes(app)
  await registerComponentCenterRoutes(app)
}
