/**
 * Aggregated Drizzle schema exports (both drizzle-kit and relational queries read from here).
 * New domains/tables must be registered here.
 */

// admin
export * from './admin/rbac'
export * from './admin/audit-logs'
export * from './admin/dicts'
export * from './admin/scheduled-task'
export * from './admin/notification'
export * from './admin/announcement'
export * from './admin/app-state'
export * from './admin/files'
export * from './admin/security'
export * from './admin/open-api'

// component_center
export * from './component-center/list-page'
export * from './component-center/tree-list-page'
export * from './component-center/stats-list-page'
export * from './component-center/card-list-page'
export * from './component-center/dynamic-form-page'
export * from './component-center/kanban'
export * from './component-center/detail-tabs'
export * from './component-center/gantt'
export * from './component-center/advanced-table'
export * from './component-center/ai-prompt'
