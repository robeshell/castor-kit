/**
 * 一级路由装配（对齐 AuraStack backend/app/router.py）
 * 新增域必须在这里注册，同时在 db/schema/index.ts 导出表定义。
 */

import type { FastifyInstance } from 'fastify'
import { registerAdminRoutes } from './modules/admin/router'
import { registerComponentCenterRoutes } from './modules/component-center/router'

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  await registerAdminRoutes(app)
  await registerComponentCenterRoutes(app)
}
