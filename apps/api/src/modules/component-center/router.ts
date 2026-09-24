/**
 * component_center 域路由装配（对齐 AuraStack backend/app/component_center/api/router.py）
 */

import type { FastifyInstance } from 'fastify'
import { registerAdvancedTableRoutes } from './advanced-table/routes'
import { registerAiChatRoutes } from './ai-chat/routes'
import { registerAiPromptRoutes } from './ai-prompt/routes'
import { registerAiSqlRoutes } from './ai-sql/routes'
import { registerCardListPageRoutes } from './card-list-page/routes'
import { registerDetailTabsRoutes } from './detail-tabs/routes'
import { registerDevtoolsRoutes } from './devtools/routes'
import { registerDynamicFormPageRoutes } from './dynamic-form-page/routes'
import { registerGanttRoutes } from './gantt/routes'
import { registerKanbanRoutes } from './kanban/routes'
import { registerListPageRoutes } from './list-page/routes'
import { registerMapHeatmapRoutes } from './map-heatmap/routes'
import { registerStatsListPageRoutes } from './stats-list-page/routes'
import { registerTreeListPageRoutes } from './tree-list-page/routes'

export async function registerComponentCenterRoutes(app: FastifyInstance): Promise<void> {
  await registerListPageRoutes(app)
  await registerStatsListPageRoutes(app)
  await registerCardListPageRoutes(app)
  await registerTreeListPageRoutes(app)
  await registerDynamicFormPageRoutes(app)
  await registerKanbanRoutes(app)
  await registerDetailTabsRoutes(app)
  await registerGanttRoutes(app)
  await registerAdvancedTableRoutes(app)
  await registerMapHeatmapRoutes(app)
  await registerAiChatRoutes(app)
  await registerAiPromptRoutes(app)
  await registerAiSqlRoutes(app)
  await registerDevtoolsRoutes(app)
}
