/**
 * RBAC seed data: menus, the super admin role, the admin account and their permission links
 *
 * Usage:
 *   pnpm seed:rbac                    # full rebuild: truncate user_roles / role_menus / admin_users / roles / menus, then rewrite
 *   pnpm seed:rbac -- --incremental   # incremental sync: upsert menus by code + refresh super admin permissions, deletes nothing
 *   pnpm seed:rbac -- --incremental --reset-admin-password   # also set the admin password to ADMIN_PASSWORD
 *
 * The menu tree (MENUS_DATA) is the single source of truth: add new menu/button permission entries here, then run `--incremental`.
 * IDs are fixed and must not be changed.
 *
 * Key behaviors:
 * - Menus are matched by code: existing ones only get their 9 fields updated (id unchanged); missing ones are inserted with the fixed id, falling back to the sequence if that id is taken
 * - No UPDATE is issued when field values are unchanged, so updated_at stays as is
 * - After inserting, only the menus sequence is synced: setval(pg_get_serial_sequence('menus','id'), max(id)+1, false)
 * - The super admin role (super_admin) is granted all menus; the admin account is created only if missing (password from
 *   ADMIN_PASSWORD, hashed by common/password.ts); --reset-admin-password also sets an existing admin's password; so does a stored hash in a format
 *   common/password.ts can't verify (nobody could sign in with it)
 * - Commit boundaries: truncate / menus / roles / account each run in their own transaction
 */

import { parseArgs } from 'node:util'
import pg from 'pg'
import { generatePasswordHash, isPasswordHash } from '../src/common/password'
import { loadConfig, loadEnvFiles, type AppEnv } from '../src/config'

export interface MenuSeed {
  id: number
  name: string
  code: string
  icon: string | null
  path: string | null
  component: string | null
  parent_id: number | null
  sort_order: number
  menu_type: 'menu' | 'button'
  is_visible: boolean
  is_active: boolean
}

// prettier-ignore
export const MENUS_DATA: readonly MenuSeed[] = [
  // Top-level menus
  { id: 1, name: "首页", code: "dashboard", icon: "Home", path: "/dashboard", component: "admin/dashboard", parent_id: null, sort_order: 1, menu_type: "menu", is_visible: true, is_active: true },
  { id: 2, name: "系统管理", code: "system", icon: "Settings", path: null, component: null, parent_id: null, sort_order: 99, menu_type: "menu", is_visible: true, is_active: true },
  // System management groups (second level); pages below hang under these
  { id: 201, name: "组织权限", code: "system_group_org", icon: "Users", path: null, component: null, parent_id: 2, sort_order: 1, menu_type: "menu", is_visible: true, is_active: true },
  { id: 202, name: "安全审计", code: "system_group_security", icon: "ShieldCheck", path: null, component: null, parent_id: 2, sort_order: 2, menu_type: "menu", is_visible: true, is_active: true },
  { id: 203, name: "系统配置", code: "system_group_config", icon: "SlidersHorizontal", path: null, component: null, parent_id: 2, sort_order: 3, menu_type: "menu", is_visible: true, is_active: true },
  { id: 204, name: "内容消息", code: "system_group_content", icon: "Inbox", path: null, component: null, parent_id: 2, sort_order: 4, menu_type: "menu", is_visible: true, is_active: true },
  { id: 3, name: "组件示例中心", code: "component_center", icon: "AppWindow", path: null, component: null, parent_id: null, sort_order: 2, menu_type: "menu", is_visible: true, is_active: true },
  // System management submenus
  { id: 21, name: "用户管理", code: "system_users", icon: "User", path: "/system/users", component: "admin/users", parent_id: 201, sort_order: 1, menu_type: "menu", is_visible: true, is_active: true },
  { id: 22, name: "角色权限", code: "system_roles", icon: "IdCard", path: "/system/roles", component: "admin/roles", parent_id: 201, sort_order: 2, menu_type: "menu", is_visible: true, is_active: true },
  { id: 23, name: "菜单管理", code: "system_menus", icon: "AppWindow", path: "/system/menus", component: "admin/menus", parent_id: 203, sort_order: 2, menu_type: "menu", is_visible: true, is_active: true },
  { id: 24, name: "日志管理", code: "system_logs", icon: "FileText", path: "/system/logs", component: "admin/logs", parent_id: 202, sort_order: 2, menu_type: "menu", is_visible: true, is_active: true },
  { id: 25, name: "数据字典", code: "system_dicts", icon: "List", path: "/system/dicts", component: "admin/dicts", parent_id: 203, sort_order: 3, menu_type: "menu", is_visible: true, is_active: true },
  { id: 26, name: "部门管理", code: "system_departments", icon: "Network", path: "/system/departments", component: "admin/departments", parent_id: 201, sort_order: 3, menu_type: "menu", is_visible: true, is_active: true },
  { id: 27, name: "文件管理", code: "system_files", icon: "FolderOpen", path: "/system/files", component: "admin/files", parent_id: 204, sort_order: 1, menu_type: "menu", is_visible: true, is_active: true },
  { id: 28, name: "在线用户", code: "system_sessions", icon: "Monitor", path: "/system/sessions", component: "admin/sessions", parent_id: 202, sort_order: 1, menu_type: "menu", is_visible: true, is_active: true },
  { id: 29, name: "系统设置", code: "system_settings", icon: "Settings", path: "/system/settings", component: "admin/settings", parent_id: 203, sort_order: 1, menu_type: "menu", is_visible: true, is_active: true },
  { id: 30, name: "消息通知", code: "system_notifications", icon: "Bell", path: "/system/notifications", component: "admin/notifications", parent_id: 204, sort_order: 2, menu_type: "menu", is_visible: true, is_active: true },
  { id: 31, name: "公告管理", code: "system_announcements", icon: "Send", path: "/system/announcements", component: "admin/announcement_page", parent_id: 204, sort_order: 3, menu_type: "menu", is_visible: true, is_active: true },
  { id: 32, name: "定时任务", code: "system_scheduled_tasks", icon: "Calendar", path: "/system/scheduled-tasks", component: "admin/scheduled_tasks", parent_id: 203, sort_order: 4, menu_type: "menu", is_visible: true, is_active: true },
  { id: 38, name: "API Token", code: "system_api_tokens", icon: "KeyRound", path: "/system/api-tokens", component: "admin/api_tokens", parent_id: 202, sort_order: 3, menu_type: "menu", is_visible: true, is_active: true },
  { id: 39, name: "Webhook", code: "system_webhooks", icon: "Webhook", path: "/system/webhooks", component: "admin/webhooks", parent_id: 203, sort_order: 5, menu_type: "menu", is_visible: true, is_active: true },
  // ── Component showcase center: category parent nodes ─────────────────
  { id: 40, name: "管理系统", code: "cc_admin", icon: "Monitor", path: null, component: null, parent_id: 3, sort_order: 1, menu_type: "menu", is_visible: true, is_active: true },
  { id: 41, name: "数据可视化", code: "cc_dataviz", icon: "PieChart", path: null, component: null, parent_id: 3, sort_order: 2, menu_type: "menu", is_visible: true, is_active: true },
  { id: 44, name: "AI 应用", code: "cc_ai", icon: "Send", path: null, component: null, parent_id: 3, sort_order: 4, menu_type: "menu", is_visible: true, is_active: true },
  { id: 45, name: "编辑器 / 低代码", code: "cc_editor", icon: "PenLine", path: null, component: null, parent_id: 3, sort_order: 5, menu_type: "menu", is_visible: true, is_active: true },
  { id: 46, name: "工程 / 工具类", code: "cc_devtools", icon: "Layers", path: null, component: null, parent_id: 3, sort_order: 6, menu_type: "menu", is_visible: true, is_active: true },
  { id: 43, name: "页面模板", code: "cc_patterns", icon: "LayoutGrid", path: null, component: null, parent_id: 3, sort_order: 0, menu_type: "menu", is_visible: true, is_active: true },
  // ── Admin system (parent_id=40) ───────────────────────────────────
  { id: 401, name: "列表页", code: "cc_admin_list", icon: "FileText", path: "/component-center/list-page", component: "component_center/admin/list_page", parent_id: 40, sort_order: 1, menu_type: "menu", is_visible: true, is_active: true },
  { id: 402, name: "统计列表页", code: "cc_admin_stats_list", icon: "BarChart3", path: "/component-center/stats-list-page", component: "component_center/admin/stats_list_page", parent_id: 40, sort_order: 2, menu_type: "menu", is_visible: true, is_active: true },
  { id: 403, name: "卡片列表页", code: "cc_admin_card_list", icon: "LayoutGrid", path: "/component-center/card-list-page", component: "component_center/admin/card_list_page", parent_id: 40, sort_order: 3, menu_type: "menu", is_visible: true, is_active: true },
  { id: 404, name: "树形列表页", code: "cc_admin_tree_list", icon: "GitBranch", path: "/component-center/tree-list-page", component: "component_center/admin/tree_list_page", parent_id: 40, sort_order: 4, menu_type: "menu", is_visible: true, is_active: true },
  { id: 405, name: "动态表单页", code: "cc_admin_dynamic_form", icon: "Code2", path: "/component-center/dynamic-form-page", component: "component_center/admin/dynamic_form_page", parent_id: 40, sort_order: 5, menu_type: "menu", is_visible: true, is_active: true },
  { id: 406, name: "拖拽看板页", code: "cc_admin_kanban", icon: "Kanban", path: "/component-center/admin/kanban", component: "component_center/admin/kanban_page", parent_id: 40, sort_order: 6, menu_type: "menu", is_visible: true, is_active: true },
  { id: 407, name: "详情标签页", code: "cc_admin_detail_tabs", icon: "IdCard", path: "/component-center/admin/detail-tabs", component: "component_center/admin/detail_tabs_page", parent_id: 40, sort_order: 7, menu_type: "menu", is_visible: true, is_active: true },
  { id: 408, name: "甘特图页", code: "cc_admin_gantt", icon: "BarChart3", path: "/component-center/admin/gantt", component: "component_center/admin/gantt_page", parent_id: 40, sort_order: 8, menu_type: "menu", is_visible: true, is_active: true },
  { id: 409, name: "高级表格页", code: "cc_admin_advanced_table", icon: "List", path: "/component-center/admin/advanced-table", component: "component_center/admin/advanced_table_page", parent_id: 40, sort_order: 9, menu_type: "menu", is_visible: true, is_active: true },
  // ── Data visualization (parent_id=41) ─────────────────────────────
  { id: 414, name: "数据大屏", code: "cc_dataviz_dashboard", icon: "BarChart3", path: "/component-center/dashboard-page", component: "component_center/dataviz/dashboard_page", parent_id: 41, sort_order: 1, menu_type: "menu", is_visible: true, is_active: true },
  // ── Page patterns (parent_id=43): one page per pattern (IDs 4301+), all on the shared demo API (demo_records) ──
  { id: 4301, name: "标准列表", code: "cc_patterns_standard_list", icon: "List", path: "/component-center/patterns/standard-list", component: "component_center/patterns/demo_record_page", parent_id: 43, sort_order: 1, menu_type: "menu", is_visible: true, is_active: true },
  // The shared demo API's buttons hang under the directory, not a page (IDs 431–435; after the pages in the role editor)
  { id: 431, name: "新增记录", code: "cc_patterns_add", icon: null, path: null, component: null, parent_id: 43, sort_order: 101, menu_type: "button", is_visible: false, is_active: true },
  { id: 432, name: "编辑记录", code: "cc_patterns_edit", icon: null, path: null, component: null, parent_id: 43, sort_order: 102, menu_type: "button", is_visible: false, is_active: true },
  { id: 433, name: "删除记录", code: "cc_patterns_delete", icon: null, path: null, component: null, parent_id: 43, sort_order: 103, menu_type: "button", is_visible: false, is_active: true },
  { id: 434, name: "导出记录", code: "cc_patterns_export", icon: null, path: null, component: null, parent_id: 43, sort_order: 104, menu_type: "button", is_visible: false, is_active: true },
  { id: 435, name: "导入记录", code: "cc_patterns_import", icon: null, path: null, component: null, parent_id: 43, sort_order: 105, menu_type: "button", is_visible: false, is_active: true },
  // User management button permissions
  { id: 211, name: "新增用户", code: "system_users_add", icon: null, path: null, component: null, parent_id: 21, sort_order: 1, menu_type: "button", is_visible: false, is_active: true },
  { id: 212, name: "编辑用户", code: "system_users_edit", icon: null, path: null, component: null, parent_id: 21, sort_order: 2, menu_type: "button", is_visible: false, is_active: true },
  { id: 213, name: "删除用户", code: "system_users_delete", icon: null, path: null, component: null, parent_id: 21, sort_order: 3, menu_type: "button", is_visible: false, is_active: true },
  { id: 214, name: "导出用户", code: "system_users_export", icon: null, path: null, component: null, parent_id: 21, sort_order: 4, menu_type: "button", is_visible: false, is_active: true },
  { id: 215, name: "导入用户", code: "system_users_import", icon: null, path: null, component: null, parent_id: 21, sort_order: 5, menu_type: "button", is_visible: false, is_active: true },
  { id: 216, name: "启用/停用用户", code: "system_users_status", icon: null, path: null, component: null, parent_id: 21, sort_order: 6, menu_type: "button", is_visible: false, is_active: true },
  { id: 261, name: "新增部门", code: "system_departments_add", icon: null, path: null, component: null, parent_id: 26, sort_order: 1, menu_type: "button", is_visible: false, is_active: true },
  { id: 262, name: "编辑部门", code: "system_departments_edit", icon: null, path: null, component: null, parent_id: 26, sort_order: 2, menu_type: "button", is_visible: false, is_active: true },
  { id: 263, name: "删除部门", code: "system_departments_delete", icon: null, path: null, component: null, parent_id: 26, sort_order: 3, menu_type: "button", is_visible: false, is_active: true },
  { id: 271, name: "删除文件", code: "system_files_delete", icon: null, path: null, component: null, parent_id: 27, sort_order: 1, menu_type: "button", is_visible: false, is_active: true },
  { id: 281, name: "强制下线", code: "system_sessions_revoke", icon: null, path: null, component: null, parent_id: 28, sort_order: 1, menu_type: "button", is_visible: false, is_active: true },
  { id: 291, name: "修改系统设置", code: "system_settings_edit", icon: null, path: null, component: null, parent_id: 29, sort_order: 1, menu_type: "button", is_visible: false, is_active: true },
  { id: 381, name: "吊销 API Token", code: "system_api_tokens_revoke", icon: null, path: null, component: null, parent_id: 38, sort_order: 1, menu_type: "button", is_visible: false, is_active: true },
  { id: 391, name: "新增 Webhook", code: "system_webhooks_add", icon: null, path: null, component: null, parent_id: 39, sort_order: 1, menu_type: "button", is_visible: false, is_active: true },
  { id: 392, name: "编辑 Webhook", code: "system_webhooks_edit", icon: null, path: null, component: null, parent_id: 39, sort_order: 2, menu_type: "button", is_visible: false, is_active: true },
  { id: 393, name: "删除 Webhook", code: "system_webhooks_delete", icon: null, path: null, component: null, parent_id: 39, sort_order: 3, menu_type: "button", is_visible: false, is_active: true },
  // Role management button permissions
  { id: 221, name: "新增角色", code: "system_roles_add", icon: null, path: null, component: null, parent_id: 22, sort_order: 1, menu_type: "button", is_visible: false, is_active: true },
  { id: 222, name: "编辑角色", code: "system_roles_edit", icon: null, path: null, component: null, parent_id: 22, sort_order: 2, menu_type: "button", is_visible: false, is_active: true },
  { id: 223, name: "删除角色", code: "system_roles_delete", icon: null, path: null, component: null, parent_id: 22, sort_order: 3, menu_type: "button", is_visible: false, is_active: true },
  { id: 224, name: "导出角色", code: "system_roles_export", icon: null, path: null, component: null, parent_id: 22, sort_order: 4, menu_type: "button", is_visible: false, is_active: true },
  { id: 225, name: "导入角色", code: "system_roles_import", icon: null, path: null, component: null, parent_id: 22, sort_order: 5, menu_type: "button", is_visible: false, is_active: true },
  // Menu management button permissions
  { id: 231, name: "新增菜单", code: "system_menus_add", icon: null, path: null, component: null, parent_id: 23, sort_order: 1, menu_type: "button", is_visible: false, is_active: true },
  { id: 232, name: "编辑菜单", code: "system_menus_edit", icon: null, path: null, component: null, parent_id: 23, sort_order: 2, menu_type: "button", is_visible: false, is_active: true },
  { id: 233, name: "删除菜单", code: "system_menus_delete", icon: null, path: null, component: null, parent_id: 23, sort_order: 3, menu_type: "button", is_visible: false, is_active: true },
  { id: 234, name: "导出菜单", code: "system_menus_export", icon: null, path: null, component: null, parent_id: 23, sort_order: 4, menu_type: "button", is_visible: false, is_active: true },
  { id: 235, name: "导入菜单", code: "system_menus_import", icon: null, path: null, component: null, parent_id: 23, sort_order: 5, menu_type: "button", is_visible: false, is_active: true },
  // Log management button permissions
  { id: 241, name: "查看日志", code: "system_logs_view", icon: null, path: null, component: null, parent_id: 24, sort_order: 1, menu_type: "button", is_visible: false, is_active: true },
  { id: 242, name: "导出日志", code: "system_logs_export", icon: null, path: null, component: null, parent_id: 24, sort_order: 2, menu_type: "button", is_visible: false, is_active: true },
  // Data dictionary button permissions
  { id: 251, name: "新增字典", code: "system_dicts_add", icon: null, path: null, component: null, parent_id: 25, sort_order: 1, menu_type: "button", is_visible: false, is_active: true },
  { id: 252, name: "编辑字典", code: "system_dicts_edit", icon: null, path: null, component: null, parent_id: 25, sort_order: 2, menu_type: "button", is_visible: false, is_active: true },
  { id: 253, name: "删除字典", code: "system_dicts_delete", icon: null, path: null, component: null, parent_id: 25, sort_order: 3, menu_type: "button", is_visible: false, is_active: true },
  { id: 254, name: "导出字典", code: "system_dicts_export", icon: null, path: null, component: null, parent_id: 25, sort_order: 4, menu_type: "button", is_visible: false, is_active: true },
  { id: 255, name: "导入字典", code: "system_dicts_import", icon: null, path: null, component: null, parent_id: 25, sort_order: 5, menu_type: "button", is_visible: false, is_active: true },
  // List page button permissions
  { id: 4011, name: "新增记录", code: "cc_admin_list_add", icon: null, path: null, component: null, parent_id: 401, sort_order: 1, menu_type: "button", is_visible: false, is_active: true },
  { id: 4012, name: "编辑记录", code: "cc_admin_list_edit", icon: null, path: null, component: null, parent_id: 401, sort_order: 2, menu_type: "button", is_visible: false, is_active: true },
  { id: 4013, name: "删除记录", code: "cc_admin_list_delete", icon: null, path: null, component: null, parent_id: 401, sort_order: 3, menu_type: "button", is_visible: false, is_active: true },
  { id: 4014, name: "导出记录", code: "cc_admin_list_export", icon: null, path: null, component: null, parent_id: 401, sort_order: 4, menu_type: "button", is_visible: false, is_active: true },
  { id: 4015, name: "导入记录", code: "cc_admin_list_import", icon: null, path: null, component: null, parent_id: 401, sort_order: 5, menu_type: "button", is_visible: false, is_active: true },
  // Stats list page button permissions
  { id: 4021, name: "新增记录", code: "cc_admin_stats_list_add", icon: null, path: null, component: null, parent_id: 402, sort_order: 1, menu_type: "button", is_visible: false, is_active: true },
  { id: 4022, name: "编辑记录", code: "cc_admin_stats_list_edit", icon: null, path: null, component: null, parent_id: 402, sort_order: 2, menu_type: "button", is_visible: false, is_active: true },
  { id: 4023, name: "删除记录", code: "cc_admin_stats_list_delete", icon: null, path: null, component: null, parent_id: 402, sort_order: 3, menu_type: "button", is_visible: false, is_active: true },
  { id: 4024, name: "导出记录", code: "cc_admin_stats_list_export", icon: null, path: null, component: null, parent_id: 402, sort_order: 4, menu_type: "button", is_visible: false, is_active: true },
  { id: 4025, name: "导入记录", code: "cc_admin_stats_list_import", icon: null, path: null, component: null, parent_id: 402, sort_order: 5, menu_type: "button", is_visible: false, is_active: true },
  // Card list page button permissions
  { id: 4031, name: "新增卡片", code: "cc_admin_card_list_add", icon: null, path: null, component: null, parent_id: 403, sort_order: 1, menu_type: "button", is_visible: false, is_active: true },
  { id: 4032, name: "编辑卡片", code: "cc_admin_card_list_edit", icon: null, path: null, component: null, parent_id: 403, sort_order: 2, menu_type: "button", is_visible: false, is_active: true },
  { id: 4033, name: "删除卡片", code: "cc_admin_card_list_delete", icon: null, path: null, component: null, parent_id: 403, sort_order: 3, menu_type: "button", is_visible: false, is_active: true },
  { id: 4034, name: "导出卡片", code: "cc_admin_card_list_export", icon: null, path: null, component: null, parent_id: 403, sort_order: 4, menu_type: "button", is_visible: false, is_active: true },
  { id: 4035, name: "导入卡片", code: "cc_admin_card_list_import", icon: null, path: null, component: null, parent_id: 403, sort_order: 5, menu_type: "button", is_visible: false, is_active: true },
  // Tree list page button permissions
  { id: 4041, name: "新增节点", code: "cc_admin_tree_list_add", icon: null, path: null, component: null, parent_id: 404, sort_order: 1, menu_type: "button", is_visible: false, is_active: true },
  { id: 4042, name: "编辑节点", code: "cc_admin_tree_list_edit", icon: null, path: null, component: null, parent_id: 404, sort_order: 2, menu_type: "button", is_visible: false, is_active: true },
  { id: 4043, name: "删除节点", code: "cc_admin_tree_list_delete", icon: null, path: null, component: null, parent_id: 404, sort_order: 3, menu_type: "button", is_visible: false, is_active: true },
  { id: 4044, name: "导出节点", code: "cc_admin_tree_list_export", icon: null, path: null, component: null, parent_id: 404, sort_order: 4, menu_type: "button", is_visible: false, is_active: true },
  { id: 4045, name: "导入节点", code: "cc_admin_tree_list_import", icon: null, path: null, component: null, parent_id: 404, sort_order: 5, menu_type: "button", is_visible: false, is_active: true },
  // Dynamic form page button permissions
  { id: 4051, name: "新增记录", code: "cc_admin_dynamic_form_add", icon: null, path: null, component: null, parent_id: 405, sort_order: 1, menu_type: "button", is_visible: false, is_active: true },
  { id: 4052, name: "编辑记录", code: "cc_admin_dynamic_form_edit", icon: null, path: null, component: null, parent_id: 405, sort_order: 2, menu_type: "button", is_visible: false, is_active: true },
  { id: 4053, name: "删除记录", code: "cc_admin_dynamic_form_delete", icon: null, path: null, component: null, parent_id: 405, sort_order: 3, menu_type: "button", is_visible: false, is_active: true },
  { id: 4054, name: "导出记录", code: "cc_admin_dynamic_form_export", icon: null, path: null, component: null, parent_id: 405, sort_order: 4, menu_type: "button", is_visible: false, is_active: true },
  { id: 4055, name: "导入记录", code: "cc_admin_dynamic_form_import", icon: null, path: null, component: null, parent_id: 405, sort_order: 5, menu_type: "button", is_visible: false, is_active: true },
  // Detail tabs page button permissions
  { id: 4071, name: "新增成员", code: "cc_admin_detail_tabs_add", icon: null, path: null, component: null, parent_id: 407, sort_order: 1, menu_type: "button", is_visible: false, is_active: true },
  { id: 4072, name: "编辑成员", code: "cc_admin_detail_tabs_edit", icon: null, path: null, component: null, parent_id: 407, sort_order: 2, menu_type: "button", is_visible: false, is_active: true },
  { id: 4073, name: "删除成员", code: "cc_admin_detail_tabs_delete", icon: null, path: null, component: null, parent_id: 407, sort_order: 3, menu_type: "button", is_visible: false, is_active: true },
  // Gantt chart page button permissions
  { id: 4081, name: "新建任务", code: "cc_admin_gantt_add", icon: null, path: null, component: null, parent_id: 408, sort_order: 1, menu_type: "button", is_visible: false, is_active: true },
  { id: 4082, name: "编辑任务", code: "cc_admin_gantt_edit", icon: null, path: null, component: null, parent_id: 408, sort_order: 2, menu_type: "button", is_visible: false, is_active: true },
  { id: 4083, name: "删除任务", code: "cc_admin_gantt_delete", icon: null, path: null, component: null, parent_id: 408, sort_order: 3, menu_type: "button", is_visible: false, is_active: true },
  { id: 4091, name: "新增记录", code: "cc_admin_advanced_table_add", icon: null, path: null, component: null, parent_id: 409, sort_order: 1, menu_type: "button", is_visible: false, is_active: true },
  { id: 4092, name: "编辑记录", code: "cc_admin_advanced_table_edit", icon: null, path: null, component: null, parent_id: 409, sort_order: 2, menu_type: "button", is_visible: false, is_active: true },
  { id: 4093, name: "删除记录", code: "cc_admin_advanced_table_delete", icon: null, path: null, component: null, parent_id: 409, sort_order: 3, menu_type: "button", is_visible: false, is_active: true },
  // Kanban page button permissions
  { id: 4061, name: "新建卡片/列", code: "cc_admin_kanban_add", icon: null, path: null, component: null, parent_id: 406, sort_order: 1, menu_type: "button", is_visible: false, is_active: true },
  { id: 4062, name: "编辑卡片/列", code: "cc_admin_kanban_edit", icon: null, path: null, component: null, parent_id: 406, sort_order: 2, menu_type: "button", is_visible: false, is_active: true },
  { id: 4063, name: "删除卡片/列", code: "cc_admin_kanban_delete", icon: null, path: null, component: null, parent_id: 406, sort_order: 3, menu_type: "button", is_visible: false, is_active: true },
  // Scheduled task button permissions
  { id: 321, name: "新增任务", code: "system_scheduled_tasks_add", icon: null, path: null, component: null, parent_id: 32, sort_order: 1, menu_type: "button", is_visible: false, is_active: true },
  { id: 322, name: "编辑任务", code: "system_scheduled_tasks_edit", icon: null, path: null, component: null, parent_id: 32, sort_order: 2, menu_type: "button", is_visible: false, is_active: true },
  { id: 323, name: "删除任务", code: "system_scheduled_tasks_delete", icon: null, path: null, component: null, parent_id: 32, sort_order: 3, menu_type: "button", is_visible: false, is_active: true },
  { id: 324, name: "执行任务", code: "system_scheduled_tasks_run", icon: null, path: null, component: null, parent_id: 32, sort_order: 4, menu_type: "button", is_visible: false, is_active: true },
  // Notification button permissions
  { id: 301, name: "新建通知", code: "system_notifications_add", icon: null, path: null, component: null, parent_id: 30, sort_order: 1, menu_type: "button", is_visible: false, is_active: true },
  { id: 302, name: "删除通知", code: "system_notifications_delete", icon: null, path: null, component: null, parent_id: 30, sort_order: 2, menu_type: "button", is_visible: false, is_active: true },
  // Announcement management button permissions
  { id: 311, name: "新增公告", code: "system_announcements_add", icon: null, path: null, component: null, parent_id: 31, sort_order: 1, menu_type: "button", is_visible: false, is_active: true },
  { id: 312, name: "编辑公告", code: "system_announcements_edit", icon: null, path: null, component: null, parent_id: 31, sort_order: 2, menu_type: "button", is_visible: false, is_active: true },
  { id: 313, name: "删除公告", code: "system_announcements_delete", icon: null, path: null, component: null, parent_id: 31, sort_order: 3, menu_type: "button", is_visible: false, is_active: true },
  { id: 314, name: "导出公告", code: "system_announcements_export", icon: null, path: null, component: null, parent_id: 31, sort_order: 4, menu_type: "button", is_visible: false, is_active: true },
  { id: 315, name: "导入公告", code: "system_announcements_import", icon: null, path: null, component: null, parent_id: 31, sort_order: 5, menu_type: "button", is_visible: false, is_active: true },
  // ── Data visualization (parent_id=41) ────────────────────────────────
  { id: 411, name: "实时折线图", code: "cc_dataviz_realtime_chart", icon: "Activity", path: "/component-center/dataviz/realtime-chart", component: "component_center/dataviz/realtime_chart_page", parent_id: 41, sort_order: 2, menu_type: "menu", is_visible: true, is_active: true },
  { id: 412, name: "热力日历图", code: "cc_dataviz_heatmap", icon: "Calendar", path: "/component-center/dataviz/heatmap", component: "component_center/dataviz/heatmap_page", parent_id: 41, sort_order: 3, menu_type: "menu", is_visible: true, is_active: true },
  { id: 413, name: "流量转化分析", code: "cc_dataviz_traffic_flow", icon: "Workflow", path: "/component-center/dataviz/traffic-flow", component: "component_center/dataviz/traffic_flow_page", parent_id: 41, sort_order: 4, menu_type: "menu", is_visible: true, is_active: true },
  // ── AI apps (parent_id=44) ────────────────────────────────────────
  { id: 441, name: "AI 对话", code: "cc_ai_chat", icon: "MessageSquare", path: "/component-center/ai/chat", component: "component_center/ai/ai_chat_page", parent_id: 44, sort_order: 1, menu_type: "menu", is_visible: true, is_active: true },
  { id: 442, name: "AI 提示词工坊", code: "cc_ai_prompt", icon: "PenLine", path: "/component-center/ai/prompt", component: "component_center/ai/ai_prompt_page", parent_id: 44, sort_order: 2, menu_type: "menu", is_visible: true, is_active: true },
  { id: 443, name: "AI 数据查询", code: "cc_ai_sql", icon: "Terminal", path: "/component-center/ai/sql", component: "component_center/ai/ai_sql_page", parent_id: 44, sort_order: 3, menu_type: "menu", is_visible: true, is_active: true },
  // ── Editors / low-code (parent_id=45) ────────────────────────────
  { id: 451, name: "富文本编辑器", code: "cc_editor_rich_text", icon: "Type", path: "/component-center/editor/rich-text", component: "component_center/editor/rich_text_page", parent_id: 45, sort_order: 1, menu_type: "menu", is_visible: true, is_active: true },
  { id: 452, name: "代码编辑器", code: "cc_editor_code", icon: "Code2", path: "/component-center/editor/code", component: "component_center/editor/code_editor_page", parent_id: 45, sort_order: 2, menu_type: "menu", is_visible: true, is_active: true },
  { id: 453, name: "JSON 编辑器", code: "cc_editor_json", icon: "Braces", path: "/component-center/editor/json", component: "component_center/editor/json_editor_page", parent_id: 45, sort_order: 3, menu_type: "menu", is_visible: true, is_active: true },
  { id: 454, name: "Markdown 预览", code: "cc_editor_markdown", icon: "Newspaper", path: "/component-center/editor/markdown", component: "component_center/editor/markdown_page", parent_id: 45, sort_order: 4, menu_type: "menu", is_visible: true, is_active: true },
  // ── Engineering / tools (parent_id=46) ───────────────────────────
  { id: 461, name: "拖拽布局", code: "cc_devtools_drag_layout", icon: "LayoutGrid", path: "/component-center/devtools/drag-layout", component: "component_center/devtools/drag_layout_page", parent_id: 46, sort_order: 1, menu_type: "menu", is_visible: true, is_active: true },
  { id: 462, name: "虚拟滚动列表", code: "cc_devtools_virtual_scroll", icon: "List", path: "/component-center/devtools/virtual-scroll", component: "component_center/devtools/virtual_scroll_page", parent_id: 46, sort_order: 2, menu_type: "menu", is_visible: true, is_active: true },
  { id: 463, name: "WebSocket 通信", code: "cc_devtools_websocket", icon: "Send", path: "/component-center/devtools/websocket", component: "component_center/devtools/websocket_page", parent_id: 46, sort_order: 3, menu_type: "menu", is_visible: true, is_active: true },
  { id: 464, name: "性能监控面板", code: "cc_devtools_perf_monitor", icon: "Activity", path: "/component-center/devtools/perf-monitor", component: "component_center/devtools/perf_monitor_page", parent_id: 46, sort_order: 4, menu_type: "menu", is_visible: true, is_active: true },
  // AI app button permissions
  { id: 4411, name: "新建对话", code: "cc_ai_chat_new", icon: null, path: null, component: null, parent_id: 441, sort_order: 1, menu_type: "button", is_visible: false, is_active: true },
  { id: 4421, name: "新建模板", code: "cc_ai_prompt_add", icon: null, path: null, component: null, parent_id: 442, sort_order: 1, menu_type: "button", is_visible: false, is_active: true },
  { id: 4422, name: "编辑模板", code: "cc_ai_prompt_edit", icon: null, path: null, component: null, parent_id: 442, sort_order: 2, menu_type: "button", is_visible: false, is_active: true },
  { id: 4423, name: "删除模板", code: "cc_ai_prompt_delete", icon: null, path: null, component: null, parent_id: 442, sort_order: 3, menu_type: "button", is_visible: false, is_active: true },
]

/** Fields an incremental sync compares and updates on an existing menu (matched by code) */
const MENU_UPDATE_FIELDS = [
  'name',
  'icon',
  'path',
  'component',
  'parent_id',
  'sort_order',
  'menu_type',
  'is_visible',
  'is_active',
] as const

const UTC_NOW = "timezone('utc', now())"

type Queryable = pg.ClientBase

interface MenuRow {
  id: number
  code: string
  name: string
  icon: string | null
  path: string | null
  component: string | null
  parent_id: number | null
  sort_order: number | null
  menu_type: string | null
  is_visible: boolean | null
  is_active: boolean | null
}

export interface SeedRbacOptions {
  databaseUrl: string
  /** Initial password for the default admin (the CLI reads ADMIN_PASSWORD from app config; dev/test falls back to admin123) */
  adminPassword: string
  /** true: upsert only, never delete (--incremental) */
  incremental?: boolean
  /** true: an existing admin account also gets adminPassword (--reset-admin-password) */
  resetAdminPassword?: boolean
  log?: (msg: string) => void
}

export interface SeedRbacResult {
  menusAdded: number
  menusUpdated: number
  superAdminMenuCount: number
  adminCreated: boolean
}

async function inTransaction<T>(client: Queryable, fn: () => Promise<T>): Promise<T> {
  await client.query('BEGIN')
  try {
    const result = await fn()
    await client.query('COMMIT')
    return result
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  }
}

async function findMenuByCode(client: Queryable, code: string): Promise<MenuRow | undefined> {
  const { rows } = await client.query<MenuRow>('SELECT * FROM menus WHERE code = $1 LIMIT 1', [code])
  return rows[0]
}

async function clearRbacData(client: Queryable, log: (msg: string) => void): Promise<void> {
  log('Clearing existing RBAC data...')
  try {
    await inTransaction(client, async () => {
      await client.query('DELETE FROM user_roles')
      log('  Cleared user-role links')
      await client.query('DELETE FROM role_menus')
      log('  Cleared role-menu links')
      await client.query('DELETE FROM admin_users')
      log('  Cleared admin users')
      await client.query('DELETE FROM roles')
      log('  Cleared roles')
      await client.query('DELETE FROM menus')
      log('  Cleared menus')
    })
    log('Data cleared\n')
  } catch (err) {
    log(`  Clearing failed: ${err instanceof Error ? err.message : String(err)}`)
    throw err
  }
}

/** Sync a PostgreSQL table's primary-key sequence to the current max id (table name is an internal constant, not user input) */
async function syncIdSequence(client: Queryable, tableName: 'menus', log: (msg: string) => void): Promise<void> {
  await client.query(
    `SELECT setval(
       pg_get_serial_sequence('${tableName}', 'id'),
       COALESCE((SELECT MAX(id) FROM ${tableName}), 0) + 1,
       false
     )`,
  )
  log(`  Synced sequence: ${tableName}.id`)
}

async function initMenus(client: Queryable, log: (msg: string) => void): Promise<{ added: number; updated: number }> {
  let added = 0
  let updated = 0

  await inTransaction(client, async () => {
    log('Seeding menus...')
    const { rows: idRows } = await client.query<{ id: number }>('SELECT id FROM menus')
    const existingIds = new Set(idRows.map((r) => r.id))
    // Fixed id in MENUS_DATA → the id the row really has. A menu whose fixed id was taken (e.g. by a menu added by hand) gets another
    // one, and its children must point there, not at whatever holds the fixed id
    const actualId = new Map<number, number>()

    for (const entry of MENUS_DATA) {
      const menu = { ...entry, parent_id: entry.parent_id === null ? null : (actualId.get(entry.parent_id) ?? entry.parent_id) }
      const existing = await findMenuByCode(client, menu.code)
      if (existing) {
        actualId.set(entry.id, existing.id)
        const changed = MENU_UPDATE_FIELDS.some((field) => existing[field] !== menu[field])
        if (changed) {
          await client.query(
            `UPDATE menus SET name = $1, icon = $2, path = $3, component = $4, parent_id = $5,
               sort_order = $6, menu_type = $7, is_visible = $8, is_active = $9, updated_at = ${UTC_NOW}
             WHERE id = $10`,
            [
              menu.name,
              menu.icon,
              menu.path,
              menu.component,
              menu.parent_id,
              menu.sort_order,
              menu.menu_type,
              menu.is_visible,
              menu.is_active,
              existing.id,
            ],
          )
        }
        updated += 1
        log(`  Updated menu: [${menu.code}] ${menu.name}`)
        continue
      }

      // If the fixed id is already taken by another menu (e.g. one added by hand), don't force it; use the sequence instead
      const useFixedId = !existingIds.has(menu.id)
      const values = [
        menu.name,
        menu.code,
        menu.icon,
        menu.path,
        menu.component,
        menu.parent_id,
        menu.sort_order,
        menu.menu_type,
        menu.is_visible,
        menu.is_active,
      ]
      const { rows } = await client.query<{ id: number }>(
        `INSERT INTO menus (${useFixedId ? 'id, ' : ''}name, code, icon, path, component, parent_id,
           sort_order, menu_type, is_visible, is_active, created_at, updated_at)
         VALUES (${useFixedId ? '$11, ' : ''}$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, ${UTC_NOW}, ${UTC_NOW})
         RETURNING id`,
        useFixedId ? [...values, menu.id] : values,
      )
      const newId = rows[0]!.id
      actualId.set(entry.id, newId)
      added += 1
      existingIds.add(newId)
      log(`  Created menu: [${menu.code}] ${menu.name} (ID: ${newId})`)
    }
  })

  if (added > 0 || updated > 0) {
    log(`Menus synced: ${added} added, ${updated} updated\n`)
  } else {
    log('Menus unchanged\n')
  }

  // Works around the sequence not advancing after explicitly inserting fixed ids
  await syncIdSequence(client, 'menus', log)
  return { added, updated }
}

/** Refresh super admin permissions (grant all menus); returns the role id and menu count */
async function refreshSuperAdminPermissions(
  client: Queryable,
  log: (msg: string) => void,
): Promise<{ roleId: number; menuCount: number }> {
  log('Refreshing super admin permissions...')
  return inTransaction(client, async () => {
    const { rows } = await client.query<{ id: number }>("SELECT id FROM roles WHERE code = 'super_admin' LIMIT 1")
    let roleId = rows[0]?.id
    if (roleId === undefined) {
      const inserted = await client.query<{ id: number }>(
        `INSERT INTO roles (name, code, description, created_at) VALUES ($1, $2, $3, ${UTC_NOW}) RETURNING id`,
        ['超级管理员', 'super_admin', '拥有所有权限的超级管理员'],
      )
      roleId = inserted.rows[0]!.id
      log('  Created role: super_admin')
    }

    // admin_role.menus = all_menus: set the linked set to all menus (FKs guarantee no links point to deleted menus, so only missing ones need adding)
    await client.query(
      `INSERT INTO role_menus (role_id, menu_id) SELECT $1::int, id FROM menus ON CONFLICT DO NOTHING`,
      [roleId],
    )
    const { rows: countRows } = await client.query<{ n: number }>('SELECT count(*)::int AS n FROM menus')
    const menuCount = countRows[0]?.n ?? 0
    log(`  super_admin now has ${menuCount} menu permissions`)
    return { roleId, menuCount }
  })
}

async function initAdminUser(
  client: Queryable,
  roleId: number,
  adminPassword: string,
  resetPassword: boolean,
  log: (msg: string) => void,
): Promise<boolean> {
  log('Seeding the admin user...')
  let created = false
  await inTransaction(client, async () => {
    const { rows } = await client.query<{ id: number; password_hash: string }>(
      "SELECT id, password_hash FROM admin_users WHERE username = 'admin' LIMIT 1",
    )
    let userId = rows[0]?.id
    if (userId === undefined) {
      const passwordHash = await generatePasswordHash(adminPassword)
      const inserted = await client.query<{ id: number }>(
        `INSERT INTO admin_users (username, password_hash, created_at) VALUES ($1, $2, ${UTC_NOW}) RETURNING id`,
        ['admin', passwordHash],
      )
      userId = inserted.rows[0]!.id
      created = true
      log('  Created user: admin')
      log(`  Initial password: ${adminPassword}`)
    } else if (resetPassword || !isPasswordHash(rows[0]!.password_hash)) {
      // A hash in another format can never verify, so nobody could sign in as admin: restore ADMIN_PASSWORD
      await client.query(`UPDATE admin_users SET password_hash = $2, updated_at = ${UTC_NOW} WHERE id = $1`, [
        userId,
        await generatePasswordHash(adminPassword),
      ])
      log(
        resetPassword
          ? '  User exists: admin; password reset'
          : '  User exists: admin; its password hash was unrecognized, so the password was reset to ADMIN_PASSWORD',
      )
    } else {
      log('  User exists: admin')
    }

    const assigned = await client.query('INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [
      userId,
      roleId,
    ])
    if (assigned.rowCount) log('  Assigned role: super_admin')
  })
  log('Admin user ready\n')
  return created
}

/** Reusable entry point (called by setup-once); throws on failure and lets the caller choose the exit code */
export async function seedRbac(options: SeedRbacOptions): Promise<SeedRbacResult> {
  const log = options.log ?? console.log
  const incremental = options.incremental ?? false
  const client = new pg.Client({ connectionString: options.databaseUrl })
  await client.connect()
  try {
    log('='.repeat(60))
    log('RBAC sync')
    log(`${'='.repeat(60)}\n`)

    let menus: { added: number; updated: number }
    let role: { roleId: number; menuCount: number }
    if (incremental) {
      log('Mode: incremental\n')
      menus = await initMenus(client, log)
      role = await refreshSuperAdminPermissions(client, log)
    } else {
      log('Mode: full rebuild\n')
      await clearRbacData(client, log)
      menus = await initMenus(client, log)
      log('Seeding roles...')
      role = await refreshSuperAdminPermissions(client, log)
      log('Roles ready\n')
    }
    const adminCreated = await initAdminUser(client, role.roleId, options.adminPassword, options.resetAdminPassword ?? false, log)

    log('='.repeat(60))
    log('Sync complete')
    log('='.repeat(60))
    log('\nSign-in details:')
    log('  Username: admin')
    log(`  Password: ${options.adminPassword}`)

    return {
      menusAdded: menus.added,
      menusUpdated: menus.updated,
      superAdminMenuCount: role.menuCount,
      adminCreated,
    }
  } finally {
    await client.end()
  }
}

// Detect direct execution by script file name: this file is bundled into the same output by setup-once, so import.meta.url is unreliable
const isMain = /[\\/]seed-rbac\.(?:ts|js|mjs)$/.test(process.argv[1] ?? '')
if (isMain) {
  let incremental = false
  let resetAdminPassword = false
  try {
    const { values } = parseArgs({
      args: process.argv.slice(2).filter((arg) => arg !== '--'),
      options: { incremental: { type: 'boolean', default: false }, 'reset-admin-password': { type: 'boolean', default: false } },
    })
    incremental = values.incremental
    resetAdminPassword = values['reset-admin-password']
  } catch (err) {
    // Exit code 2 for argument errors
    console.error('usage: seed-rbac [--incremental] [--reset-admin-password]')
    console.error(`seed-rbac: error: ${err instanceof Error ? err.message : String(err)}`)
    process.exit(2)
  }
  const env = (process.env.NODE_ENV ?? 'development') as AppEnv
  loadEnvFiles(env)
  const config = loadConfig()
  seedRbac({ databaseUrl: config.databaseUrl, adminPassword: config.adminPassword, incremental, resetAdminPassword }).catch(
    (err: unknown) => {
      console.error(`\nSeeding failed: ${err instanceof Error ? err.message : String(err)}`)
      if (err instanceof Error && err.stack) console.error(err.stack)
      process.exit(1)
    },
  )
}
