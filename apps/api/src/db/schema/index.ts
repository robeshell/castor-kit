/**
 * Drizzle schema 汇总导出（drizzle-kit 与 relational query 都从这里读）。
 * 新增域/表必须在这里注册（对应 AuraStack backend/app/__init__.py 的 init_models）。
 *
 * `alembic_version` 故意不建模：它由 Alembic 维护、切换完成后删除（rewrite-plan §8）。
 */

// admin
export * from './admin/rbac'
export * from './admin/audit-logs'
export * from './admin/dicts'
export * from './admin/scheduled-task'
export * from './admin/notification'
export * from './admin/announcement'

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
