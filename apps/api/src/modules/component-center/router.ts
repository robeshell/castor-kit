/**
 * component_center domain route wiring
 */

import type { FastifyInstance } from 'fastify'
import { registerAiChatRoutes } from './ai-chat/routes'
import { registerAiPromptRoutes } from './ai-prompt/routes'
import { registerAiSqlRoutes } from './ai-sql/routes'
import { registerDevtoolsRoutes } from './devtools/routes'
import { registerTrafficFlowRoutes } from './traffic-flow/routes'
import { registerDemoRecordRoutes } from './demo-record/routes'

export async function registerComponentCenterRoutes(app: FastifyInstance): Promise<void> {
  await registerTrafficFlowRoutes(app)
  await registerAiChatRoutes(app)
  await registerAiPromptRoutes(app)
  await registerAiSqlRoutes(app)
  await registerDevtoolsRoutes(app)
  await registerDemoRecordRoutes(app)
}
