/**
 * RBAC 种子数据：菜单、超级管理员角色、管理员账号及权限关联
 *
 * 用法：
 *   pnpm seed:rbac                    # 全量重建：清空 user_roles / role_menus / admin_users / roles / menus 后重新写入
 *   pnpm seed:rbac -- --incremental   # 增量同步：按 code upsert 菜单 + 刷新超级管理员权限，不删除任何数据
 *
 * 菜单树（MENUS_DATA）是唯一事实源：新增菜单/按钮权限在这里加条目，然后跑 `--incremental`。
 * ID 固定（含历史遗留的 31/33/34/35/36/37/100002/100003），不许改动。
 *
 * 行为要点：
 * - 菜单按 code 匹配：已存在只更新 9 个字段（不改 id）；不存在时用固定 id 插入，id 被占用则走序列
 * - 字段值无变化时不发 UPDATE，updated_at 保持不变
 * - 插入后只同步 menus 的序列：setval(pg_get_serial_sequence('menus','id'), max(id)+1, false)
 * - 超级管理员角色（super_admin）授予全部菜单；admin 账号不存在才创建（密码取 ADMIN_PASSWORD，pbkdf2:sha256 格式）
 * - 提交边界：清空 / 菜单 / 角色 / 账号各自一个事务
 */

import { parseArgs } from 'node:util'
import pg from 'pg'
import { generatePasswordHash } from '../src/common/password'
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
  // 一级菜单
  { id: 1, name: "首页", code: "dashboard", icon: "IconHome", path: "/dashboard", component: "admin/dashboard", parent_id: null, sort_order: 1, menu_type: "menu", is_visible: true, is_active: true },
  { id: 2, name: "系统管理", code: "system", icon: "IconSetting", path: null, component: null, parent_id: null, sort_order: 99, menu_type: "menu", is_visible: true, is_active: true },
  { id: 3, name: "组件示例中心", code: "component_center", icon: "IconApps", path: null, component: null, parent_id: null, sort_order: 2, menu_type: "menu", is_visible: true, is_active: true },
  // 系统管理子菜单
  { id: 21, name: "用户管理", code: "system_users", icon: "IconUser", path: "/system/users", component: "admin/users", parent_id: 2, sort_order: 1, menu_type: "menu", is_visible: true, is_active: true },
  { id: 22, name: "角色权限", code: "system_roles", icon: "IconIdCard", path: "/system/roles", component: "admin/roles", parent_id: 2, sort_order: 2, menu_type: "menu", is_visible: true, is_active: true },
  { id: 23, name: "菜单管理", code: "system_menus", icon: "IconApps", path: "/system/menus", component: "admin/menus", parent_id: 2, sort_order: 3, menu_type: "menu", is_visible: true, is_active: true },
  { id: 24, name: "日志管理", code: "system_logs", icon: "IconFile", path: "/system/logs", component: "admin/logs", parent_id: 2, sort_order: 4, menu_type: "menu", is_visible: true, is_active: true },
  { id: 25, name: "数据字典", code: "system_dicts", icon: "IconList", path: "/system/dicts", component: "admin/dicts", parent_id: 2, sort_order: 5, menu_type: "menu", is_visible: true, is_active: true },
  // ── 组件示例中心：分类父节点 ──────────────────────────────────────
  { id: 40, name: "管理系统", code: "cc_admin", icon: "IconDesktop", path: null, component: null, parent_id: 3, sort_order: 1, menu_type: "menu", is_visible: true, is_active: true },
  { id: 41, name: "数据可视化", code: "cc_dataviz", icon: "IconPieChartStroked", path: null, component: null, parent_id: 3, sort_order: 2, menu_type: "menu", is_visible: true, is_active: true },
  { id: 42, name: "3D / 创意", code: "cc_3d", icon: "IconBox", path: null, component: null, parent_id: 3, sort_order: 3, menu_type: "menu", is_visible: true, is_active: true },
  { id: 44, name: "AI 应用", code: "cc_ai", icon: "IconSend", path: null, component: null, parent_id: 3, sort_order: 4, menu_type: "menu", is_visible: true, is_active: true },
  { id: 45, name: "编辑器 / 低代码", code: "cc_editor", icon: "IconEdit2", path: null, component: null, parent_id: 3, sort_order: 5, menu_type: "menu", is_visible: true, is_active: true },
  { id: 46, name: "工程 / 工具类", code: "cc_devtools", icon: "IconLayers", path: null, component: null, parent_id: 3, sort_order: 6, menu_type: "menu", is_visible: true, is_active: true },
  // ── 管理系统 (parent_id=40) ───────────────────────────────────
  { id: 31, name: "列表页", code: "system_list_page", icon: "IconFile", path: "/component-center/list-page", component: "component_center/admin/list_page", parent_id: 40, sort_order: 1, menu_type: "menu", is_visible: true, is_active: true },
  { id: 33, name: "统计列表页", code: "system_stats_list_page", icon: "IconBarChart", path: "/component-center/stats-list-page", component: "component_center/admin/stats_list_page", parent_id: 40, sort_order: 2, menu_type: "menu", is_visible: true, is_active: true },
  { id: 34, name: "卡片列表页", code: "system_card_list_page", icon: "IconGridSquare", path: "/component-center/card-list-page", component: "component_center/admin/card_list_page", parent_id: 40, sort_order: 3, menu_type: "menu", is_visible: true, is_active: true },
  { id: 35, name: "树形列表页", code: "system_tree_list_page", icon: "IconBranch", path: "/component-center/tree-list-page", component: "component_center/admin/tree_list_page", parent_id: 40, sort_order: 4, menu_type: "menu", is_visible: true, is_active: true },
  { id: 36, name: "动态表单页", code: "system_dynamic_form_page", icon: "IconCode", path: "/component-center/dynamic-form-page", component: "component_center/admin/dynamic_form_page", parent_id: 40, sort_order: 5, menu_type: "menu", is_visible: true, is_active: true },
  // ── 管理系统页面 (parent_id=40，新增) ────────────────────────────
  { id: 401, name: "拖拽看板页", code: "cc_admin_kanban_page", icon: "IconKanban", path: "/component-center/admin/kanban", component: "component_center/admin/kanban_page", parent_id: 40, sort_order: 6, menu_type: "menu", is_visible: true, is_active: true },
  { id: 402, name: "详情标签页", code: "cc_admin_detail_tabs_page", icon: "IconIdCard", path: "/component-center/admin/detail-tabs", component: "component_center/admin/detail_tabs_page", parent_id: 40, sort_order: 7, menu_type: "menu", is_visible: true, is_active: true },
  { id: 403, name: "甘特图页", code: "cc_admin_gantt_page", icon: "IconHistogram", path: "/component-center/admin/gantt", component: "component_center/admin/gantt_page", parent_id: 40, sort_order: 8, menu_type: "menu", is_visible: true, is_active: true },
  { id: 404, name: "高级表格页", code: "cc_admin_advanced_table_page", icon: "IconList", path: "/component-center/admin/advanced-table", component: "component_center/admin/advanced_table_page", parent_id: 40, sort_order: 9, menu_type: "menu", is_visible: true, is_active: true },
  // ── 数据可视化 (parent_id=41) ─────────────────────────────────
  { id: 37, name: "数据大屏", code: "system_dashboard_page", icon: "IconHistogram", path: "/component-center/dashboard-page", component: "component_center/dataviz/dashboard_page", parent_id: 41, sort_order: 1, menu_type: "menu", is_visible: true, is_active: true },
  { id: 32, name: "定时任务", code: "system_scheduled_tasks", icon: "IconSetting", path: "/system/scheduled-tasks", component: "admin/scheduled_tasks", parent_id: 2, sort_order: 6, menu_type: "menu", is_visible: true, is_active: true },
  { id: 100002, name: "消息通知", code: "system_notifications", icon: "IconBell", path: "/system/notifications", component: "admin/notifications", parent_id: 2, sort_order: 33, menu_type: "menu", is_visible: true, is_active: true },
  { id: 100003, name: "公告管理", code: "system_announcements", icon: "IconSend", path: "/system/announcements", component: "admin/announcement_page", parent_id: 2, sort_order: 34, menu_type: "menu", is_visible: true, is_active: true },
  // 用户管理按钮权限
  { id: 211, name: "新增用户", code: "system_users_add", icon: null, path: null, component: null, parent_id: 21, sort_order: 1, menu_type: "button", is_visible: false, is_active: true },
  { id: 212, name: "编辑用户", code: "system_users_edit", icon: null, path: null, component: null, parent_id: 21, sort_order: 2, menu_type: "button", is_visible: false, is_active: true },
  { id: 213, name: "删除用户", code: "system_users_delete", icon: null, path: null, component: null, parent_id: 21, sort_order: 3, menu_type: "button", is_visible: false, is_active: true },
  { id: 214, name: "导出用户", code: "system_users_export", icon: null, path: null, component: null, parent_id: 21, sort_order: 4, menu_type: "button", is_visible: false, is_active: true },
  { id: 215, name: "导入用户", code: "system_users_import", icon: null, path: null, component: null, parent_id: 21, sort_order: 5, menu_type: "button", is_visible: false, is_active: true },
  // 角色管理按钮权限
  { id: 221, name: "新增角色", code: "system_roles_add", icon: null, path: null, component: null, parent_id: 22, sort_order: 1, menu_type: "button", is_visible: false, is_active: true },
  { id: 222, name: "编辑角色", code: "system_roles_edit", icon: null, path: null, component: null, parent_id: 22, sort_order: 2, menu_type: "button", is_visible: false, is_active: true },
  { id: 223, name: "删除角色", code: "system_roles_delete", icon: null, path: null, component: null, parent_id: 22, sort_order: 3, menu_type: "button", is_visible: false, is_active: true },
  { id: 224, name: "导出角色", code: "system_roles_export", icon: null, path: null, component: null, parent_id: 22, sort_order: 4, menu_type: "button", is_visible: false, is_active: true },
  { id: 225, name: "导入角色", code: "system_roles_import", icon: null, path: null, component: null, parent_id: 22, sort_order: 5, menu_type: "button", is_visible: false, is_active: true },
  // 菜单管理按钮权限
  { id: 231, name: "新增菜单", code: "system_menus_add", icon: null, path: null, component: null, parent_id: 23, sort_order: 1, menu_type: "button", is_visible: false, is_active: true },
  { id: 232, name: "编辑菜单", code: "system_menus_edit", icon: null, path: null, component: null, parent_id: 23, sort_order: 2, menu_type: "button", is_visible: false, is_active: true },
  { id: 233, name: "删除菜单", code: "system_menus_delete", icon: null, path: null, component: null, parent_id: 23, sort_order: 3, menu_type: "button", is_visible: false, is_active: true },
  { id: 234, name: "导出菜单", code: "system_menus_export", icon: null, path: null, component: null, parent_id: 23, sort_order: 4, menu_type: "button", is_visible: false, is_active: true },
  { id: 235, name: "导入菜单", code: "system_menus_import", icon: null, path: null, component: null, parent_id: 23, sort_order: 5, menu_type: "button", is_visible: false, is_active: true },
  // 日志管理按钮权限
  { id: 241, name: "查看日志", code: "system_logs_view", icon: null, path: null, component: null, parent_id: 24, sort_order: 1, menu_type: "button", is_visible: false, is_active: true },
  { id: 242, name: "导出日志", code: "system_logs_export", icon: null, path: null, component: null, parent_id: 24, sort_order: 2, menu_type: "button", is_visible: false, is_active: true },
  { id: 243, name: "导入日志", code: "system_logs_import", icon: null, path: null, component: null, parent_id: 24, sort_order: 3, menu_type: "button", is_visible: false, is_active: true },
  // 数据字典按钮权限
  { id: 251, name: "新增字典", code: "system_dicts_add", icon: null, path: null, component: null, parent_id: 25, sort_order: 1, menu_type: "button", is_visible: false, is_active: true },
  { id: 252, name: "编辑字典", code: "system_dicts_edit", icon: null, path: null, component: null, parent_id: 25, sort_order: 2, menu_type: "button", is_visible: false, is_active: true },
  { id: 253, name: "删除字典", code: "system_dicts_delete", icon: null, path: null, component: null, parent_id: 25, sort_order: 3, menu_type: "button", is_visible: false, is_active: true },
  { id: 254, name: "导出字典", code: "system_dicts_export", icon: null, path: null, component: null, parent_id: 25, sort_order: 4, menu_type: "button", is_visible: false, is_active: true },
  { id: 255, name: "导入字典", code: "system_dicts_import", icon: null, path: null, component: null, parent_id: 25, sort_order: 5, menu_type: "button", is_visible: false, is_active: true },
  // 列表页按钮权限
  { id: 311, name: "新增记录", code: "system_list_page_add", icon: null, path: null, component: null, parent_id: 31, sort_order: 1, menu_type: "button", is_visible: false, is_active: true },
  { id: 312, name: "编辑记录", code: "system_list_page_edit", icon: null, path: null, component: null, parent_id: 31, sort_order: 2, menu_type: "button", is_visible: false, is_active: true },
  { id: 313, name: "删除记录", code: "system_list_page_delete", icon: null, path: null, component: null, parent_id: 31, sort_order: 3, menu_type: "button", is_visible: false, is_active: true },
  { id: 314, name: "导出记录", code: "system_list_page_export", icon: null, path: null, component: null, parent_id: 31, sort_order: 4, menu_type: "button", is_visible: false, is_active: true },
  { id: 315, name: "导入记录", code: "system_list_page_import", icon: null, path: null, component: null, parent_id: 31, sort_order: 5, menu_type: "button", is_visible: false, is_active: true },
  // 统计列表页按钮权限
  { id: 331, name: "新增记录", code: "system_stats_list_page_add", icon: null, path: null, component: null, parent_id: 33, sort_order: 1, menu_type: "button", is_visible: false, is_active: true },
  { id: 332, name: "编辑记录", code: "system_stats_list_page_edit", icon: null, path: null, component: null, parent_id: 33, sort_order: 2, menu_type: "button", is_visible: false, is_active: true },
  { id: 333, name: "删除记录", code: "system_stats_list_page_delete", icon: null, path: null, component: null, parent_id: 33, sort_order: 3, menu_type: "button", is_visible: false, is_active: true },
  { id: 334, name: "导出记录", code: "system_stats_list_page_export", icon: null, path: null, component: null, parent_id: 33, sort_order: 4, menu_type: "button", is_visible: false, is_active: true },
  { id: 335, name: "导入记录", code: "system_stats_list_page_import", icon: null, path: null, component: null, parent_id: 33, sort_order: 5, menu_type: "button", is_visible: false, is_active: true },
  // 卡片列表页按钮权限
  { id: 341, name: "新增卡片", code: "system_card_list_page_add", icon: null, path: null, component: null, parent_id: 34, sort_order: 1, menu_type: "button", is_visible: false, is_active: true },
  { id: 342, name: "编辑卡片", code: "system_card_list_page_edit", icon: null, path: null, component: null, parent_id: 34, sort_order: 2, menu_type: "button", is_visible: false, is_active: true },
  { id: 343, name: "删除卡片", code: "system_card_list_page_delete", icon: null, path: null, component: null, parent_id: 34, sort_order: 3, menu_type: "button", is_visible: false, is_active: true },
  { id: 344, name: "导出卡片", code: "system_card_list_page_export", icon: null, path: null, component: null, parent_id: 34, sort_order: 4, menu_type: "button", is_visible: false, is_active: true },
  { id: 345, name: "导入卡片", code: "system_card_list_page_import", icon: null, path: null, component: null, parent_id: 34, sort_order: 5, menu_type: "button", is_visible: false, is_active: true },
  // 树形列表页按钮权限
  { id: 351, name: "新增节点", code: "system_tree_list_page_add", icon: null, path: null, component: null, parent_id: 35, sort_order: 1, menu_type: "button", is_visible: false, is_active: true },
  { id: 352, name: "编辑节点", code: "system_tree_list_page_edit", icon: null, path: null, component: null, parent_id: 35, sort_order: 2, menu_type: "button", is_visible: false, is_active: true },
  { id: 353, name: "删除节点", code: "system_tree_list_page_delete", icon: null, path: null, component: null, parent_id: 35, sort_order: 3, menu_type: "button", is_visible: false, is_active: true },
  { id: 354, name: "导出节点", code: "system_tree_list_page_export", icon: null, path: null, component: null, parent_id: 35, sort_order: 4, menu_type: "button", is_visible: false, is_active: true },
  { id: 355, name: "导入节点", code: "system_tree_list_page_import", icon: null, path: null, component: null, parent_id: 35, sort_order: 5, menu_type: "button", is_visible: false, is_active: true },
  // 动态表单页按钮权限
  { id: 361, name: "新增记录", code: "system_dynamic_form_page_add", icon: null, path: null, component: null, parent_id: 36, sort_order: 1, menu_type: "button", is_visible: false, is_active: true },
  { id: 362, name: "编辑记录", code: "system_dynamic_form_page_edit", icon: null, path: null, component: null, parent_id: 36, sort_order: 2, menu_type: "button", is_visible: false, is_active: true },
  { id: 363, name: "删除记录", code: "system_dynamic_form_page_delete", icon: null, path: null, component: null, parent_id: 36, sort_order: 3, menu_type: "button", is_visible: false, is_active: true },
  { id: 364, name: "导出记录", code: "system_dynamic_form_page_export", icon: null, path: null, component: null, parent_id: 36, sort_order: 4, menu_type: "button", is_visible: false, is_active: true },
  { id: 365, name: "导入记录", code: "system_dynamic_form_page_import", icon: null, path: null, component: null, parent_id: 36, sort_order: 5, menu_type: "button", is_visible: false, is_active: true },
  // 详情标签页按钮权限
  { id: 4021, name: "新增成员", code: "cc_admin_detail_tabs_add", icon: null, path: null, component: null, parent_id: 402, sort_order: 1, menu_type: "button", is_visible: false, is_active: true },
  { id: 4022, name: "编辑成员", code: "cc_admin_detail_tabs_edit", icon: null, path: null, component: null, parent_id: 402, sort_order: 2, menu_type: "button", is_visible: false, is_active: true },
  { id: 4023, name: "删除成员", code: "cc_admin_detail_tabs_delete", icon: null, path: null, component: null, parent_id: 402, sort_order: 3, menu_type: "button", is_visible: false, is_active: true },
  // 甘特图页按钮权限
  { id: 4031, name: "新建任务", code: "cc_admin_gantt_add", icon: null, path: null, component: null, parent_id: 403, sort_order: 1, menu_type: "button", is_visible: false, is_active: true },
  { id: 4032, name: "编辑任务", code: "cc_admin_gantt_edit", icon: null, path: null, component: null, parent_id: 403, sort_order: 2, menu_type: "button", is_visible: false, is_active: true },
  { id: 4033, name: "删除任务", code: "cc_admin_gantt_delete", icon: null, path: null, component: null, parent_id: 403, sort_order: 3, menu_type: "button", is_visible: false, is_active: true },
  { id: 4041, name: "新增记录", code: "cc_admin_advanced_table_add", icon: null, path: null, component: null, parent_id: 404, sort_order: 1, menu_type: "button", is_visible: false, is_active: true },
  { id: 4042, name: "编辑记录", code: "cc_admin_advanced_table_edit", icon: null, path: null, component: null, parent_id: 404, sort_order: 2, menu_type: "button", is_visible: false, is_active: true },
  { id: 4043, name: "删除记录", code: "cc_admin_advanced_table_delete", icon: null, path: null, component: null, parent_id: 404, sort_order: 3, menu_type: "button", is_visible: false, is_active: true },
  // 看板页按钮权限
  { id: 4011, name: "新建卡片/列", code: "cc_admin_kanban_add", icon: null, path: null, component: null, parent_id: 401, sort_order: 1, menu_type: "button", is_visible: false, is_active: true },
  { id: 4012, name: "编辑卡片/列", code: "cc_admin_kanban_edit", icon: null, path: null, component: null, parent_id: 401, sort_order: 2, menu_type: "button", is_visible: false, is_active: true },
  { id: 4013, name: "删除卡片/列", code: "cc_admin_kanban_delete", icon: null, path: null, component: null, parent_id: 401, sort_order: 3, menu_type: "button", is_visible: false, is_active: true },
  // 定时任务按钮权限
  { id: 321, name: "新增任务", code: "system_scheduled_tasks_add", icon: null, path: null, component: null, parent_id: 32, sort_order: 1, menu_type: "button", is_visible: false, is_active: true },
  { id: 322, name: "编辑任务", code: "system_scheduled_tasks_edit", icon: null, path: null, component: null, parent_id: 32, sort_order: 2, menu_type: "button", is_visible: false, is_active: true },
  { id: 323, name: "删除任务", code: "system_scheduled_tasks_delete", icon: null, path: null, component: null, parent_id: 32, sort_order: 3, menu_type: "button", is_visible: false, is_active: true },
  { id: 324, name: "执行任务", code: "system_scheduled_tasks_run", icon: null, path: null, component: null, parent_id: 32, sort_order: 4, menu_type: "button", is_visible: false, is_active: true },
  // 消息通知按钮权限
  { id: 1000021, name: "新建通知", code: "system_notifications_add", icon: null, path: null, component: null, parent_id: 100002, sort_order: 1, menu_type: "button", is_visible: false, is_active: true },
  { id: 1000022, name: "删除通知", code: "system_notifications_delete", icon: null, path: null, component: null, parent_id: 100002, sort_order: 2, menu_type: "button", is_visible: false, is_active: true },
  // 公告管理按钮权限
  { id: 1000031, name: "新增公告", code: "system_announcements_add", icon: null, path: null, component: null, parent_id: 100003, sort_order: 1, menu_type: "button", is_visible: false, is_active: true },
  { id: 1000032, name: "编辑公告", code: "system_announcements_edit", icon: null, path: null, component: null, parent_id: 100003, sort_order: 2, menu_type: "button", is_visible: false, is_active: true },
  { id: 1000033, name: "删除公告", code: "system_announcements_delete", icon: null, path: null, component: null, parent_id: 100003, sort_order: 3, menu_type: "button", is_visible: false, is_active: true },
  { id: 1000034, name: "导出公告", code: "system_announcements_export", icon: null, path: null, component: null, parent_id: 100003, sort_order: 4, menu_type: "button", is_visible: false, is_active: true },
  { id: 1000035, name: "导入公告", code: "system_announcements_import", icon: null, path: null, component: null, parent_id: 100003, sort_order: 5, menu_type: "button", is_visible: false, is_active: true },
  // ── 数据可视化 (parent_id=41) ────────────────────────────────────
  { id: 411, name: "实时折线图", code: "cc_dataviz_realtime_chart", icon: "IconActivity", path: "/component-center/dataviz/realtime-chart", component: "component_center/dataviz/realtime_chart_page", parent_id: 41, sort_order: 2, menu_type: "menu", is_visible: true, is_active: true },
  { id: 412, name: "热力日历图", code: "cc_dataviz_heatmap", icon: "IconCalendar", path: "/component-center/dataviz/heatmap", component: "component_center/dataviz/heatmap_page", parent_id: 41, sort_order: 3, menu_type: "menu", is_visible: true, is_active: true },
  { id: 413, name: "地图热力图", code: "cc_dataviz_map_heatmap", icon: "IconMapPin", path: "/component-center/dataviz/map-heatmap", component: "component_center/dataviz/map_heatmap_page", parent_id: 41, sort_order: 4, menu_type: "menu", is_visible: true, is_active: true },
  // ── 3D / 创意 (parent_id=42) ─────────────────────────────────────
  { id: 421, name: "粒子连线动画", code: "cc_3d_particle", icon: "IconStar", path: "/component-center/creative/particle", component: "component_center/creative/particle_canvas_page", parent_id: 42, sort_order: 1, menu_type: "menu", is_visible: true, is_active: true },
  { id: 422, name: "CSS 3D 卡片", code: "cc_3d_css", icon: "IconCreditCard", path: "/component-center/creative/css-3d", component: "component_center/creative/css_3d_page", parent_id: 42, sort_order: 2, menu_type: "menu", is_visible: true, is_active: true },
  { id: 423, name: "Three.js 地球", code: "cc_3d_globe", icon: "IconGlobe", path: "/component-center/creative/globe", component: "component_center/creative/threejs_globe_page", parent_id: 42, sort_order: 3, menu_type: "menu", is_visible: true, is_active: true },
  { id: 424, name: "粒子形态变换", code: "cc_3d_morphing", icon: "IconHexagon", path: "/component-center/creative/morphing", component: "component_center/creative/morphing_particles_page", parent_id: 42, sort_order: 4, menu_type: "menu", is_visible: true, is_active: true },
  // ── AI 应用 (parent_id=44) ────────────────────────────────────────
  { id: 441, name: "AI 对话", code: "cc_ai_chat", icon: "IconComment", path: "/component-center/ai/chat", component: "component_center/ai/ai_chat_page", parent_id: 44, sort_order: 1, menu_type: "menu", is_visible: true, is_active: true },
  { id: 442, name: "AI 提示词工坊", code: "cc_ai_prompt", icon: "IconEdit2", path: "/component-center/ai/prompt", component: "component_center/ai/ai_prompt_page", parent_id: 44, sort_order: 2, menu_type: "menu", is_visible: true, is_active: true },
  { id: 443, name: "AI 数据查询", code: "cc_ai_sql", icon: "IconTerminal", path: "/component-center/ai/sql", component: "component_center/ai/ai_sql_page", parent_id: 44, sort_order: 3, menu_type: "menu", is_visible: true, is_active: true },
  // ── 编辑器 / 低代码 (parent_id=45) ───────────────────────────────
  { id: 451, name: "富文本编辑器", code: "cc_editor_rich_text", icon: "IconFont", path: "/component-center/editor/rich-text", component: "component_center/editor/rich_text_page", parent_id: 45, sort_order: 1, menu_type: "menu", is_visible: true, is_active: true },
  { id: 452, name: "代码编辑器", code: "cc_editor_code", icon: "IconCode", path: "/component-center/editor/code", component: "component_center/editor/code_editor_page", parent_id: 45, sort_order: 2, menu_type: "menu", is_visible: true, is_active: true },
  { id: 453, name: "JSON 编辑器", code: "cc_editor_json", icon: "IconBrackets", path: "/component-center/editor/json", component: "component_center/editor/json_editor_page", parent_id: 45, sort_order: 3, menu_type: "menu", is_visible: true, is_active: true },
  { id: 454, name: "Markdown 预览", code: "cc_editor_markdown", icon: "IconArticle", path: "/component-center/editor/markdown", component: "component_center/editor/markdown_page", parent_id: 45, sort_order: 4, menu_type: "menu", is_visible: true, is_active: true },
  // ── 工程 / 工具类 (parent_id=46) ─────────────────────────────────
  { id: 461, name: "拖拽布局", code: "cc_devtools_drag_layout", icon: "IconGridSquare", path: "/component-center/devtools/drag-layout", component: "component_center/devtools/drag_layout_page", parent_id: 46, sort_order: 1, menu_type: "menu", is_visible: true, is_active: true },
  { id: 462, name: "虚拟滚动列表", code: "cc_devtools_virtual_scroll", icon: "IconList", path: "/component-center/devtools/virtual-scroll", component: "component_center/devtools/virtual_scroll_page", parent_id: 46, sort_order: 2, menu_type: "menu", is_visible: true, is_active: true },
  { id: 463, name: "WebSocket 通信", code: "cc_devtools_websocket", icon: "IconSend", path: "/component-center/devtools/websocket", component: "component_center/devtools/websocket_page", parent_id: 46, sort_order: 3, menu_type: "menu", is_visible: true, is_active: true },
  { id: 464, name: "性能监控面板", code: "cc_devtools_perf_monitor", icon: "IconActivity", path: "/component-center/devtools/perf-monitor", component: "component_center/devtools/perf_monitor_page", parent_id: 46, sort_order: 4, menu_type: "menu", is_visible: true, is_active: true },
  // AI应用按钮权限
  { id: 4411, name: "新建对话", code: "cc_ai_chat_new", icon: null, path: null, component: null, parent_id: 441, sort_order: 1, menu_type: "button", is_visible: false, is_active: true },
  { id: 4421, name: "新建模板", code: "cc_ai_prompt_add", icon: null, path: null, component: null, parent_id: 442, sort_order: 1, menu_type: "button", is_visible: false, is_active: true },
  { id: 4422, name: "编辑模板", code: "cc_ai_prompt_edit", icon: null, path: null, component: null, parent_id: 442, sort_order: 2, menu_type: "button", is_visible: false, is_active: true },
  { id: 4423, name: "删除模板", code: "cc_ai_prompt_delete", icon: null, path: null, component: null, parent_id: 442, sort_order: 3, menu_type: "button", is_visible: false, is_active: true },
]

/** 下线的历史试验页菜单：保留数据但不在导航展示 */
export const RETIRED_MENU_CODES = ['component_center_templates', 'component_center_scenarios'] as const

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
  /** 默认管理员初始密码（CLI 取 app config 的 ADMIN_PASSWORD，开发/测试回落 admin123） */
  adminPassword: string
  /** true：只 upsert 不删除（--incremental） */
  incremental?: boolean
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
  log('清空现有RBAC数据...')
  try {
    await inTransaction(client, async () => {
      await client.query('DELETE FROM user_roles')
      log('  清空用户-角色关联')
      await client.query('DELETE FROM role_menus')
      log('  清空角色-菜单关联')
      await client.query('DELETE FROM admin_users')
      log('  清空管理员账号')
      await client.query('DELETE FROM roles')
      log('  清空角色')
      await client.query('DELETE FROM menus')
      log('  清空菜单')
    })
    log('数据清空完成\n')
  } catch (err) {
    log(`  清空失败: ${err instanceof Error ? err.message : String(err)}`)
    throw err
  }
}

/** 将旧菜单编码 data_management 迁移为 component_center，避免重命名后重复菜单 */
async function migrateComponentCenterMenuCode(client: Queryable, log: (msg: string) => void): Promise<void> {
  const legacy = await findMenuByCode(client, 'data_management')
  const current = await findMenuByCode(client, 'component_center')
  if (!legacy) return

  if (current && current.id !== legacy.id) {
    // 把新编码菜单下可能挂载的子菜单迁回旧菜单，保持层级稳定
    await client.query(`UPDATE menus SET parent_id = $1, updated_at = ${UTC_NOW} WHERE parent_id = $2`, [
      legacy.id,
      current.id,
    ])
    // 迁移角色-菜单关系，避免删除重复菜单后丢权限
    await client.query(
      `INSERT INTO role_menus (role_id, menu_id)
       SELECT DISTINCT rm.role_id, $1::int
       FROM role_menus rm
       WHERE rm.menu_id = $2
       AND NOT EXISTS (
         SELECT 1 FROM role_menus x WHERE x.role_id = rm.role_id AND x.menu_id = $1::int
       )`,
      [legacy.id, current.id],
    )
    await client.query('DELETE FROM role_menus WHERE menu_id = $1', [current.id])
    // 先把重复记录改成临时编码，避免唯一键冲突，再删除
    await client.query(`UPDATE menus SET code = $1, updated_at = ${UTC_NOW} WHERE id = $2`, [
      `component_center_legacy_${current.id}`,
      current.id,
    ])
    await client.query('DELETE FROM menus WHERE id = $1', [current.id])
    log('  已合并重复菜单: [data_management] + [component_center]')
  }

  await client.query(`UPDATE menus SET code = $1, name = $2, updated_at = ${UTC_NOW} WHERE id = $3`, [
    'component_center',
    '组件示例中心',
    legacy.id,
  ])
  log('  菜单编码迁移: [data_management] -> [component_center]')
}

/** 将旧的 query_management 菜单/按钮编码迁移为 list_page，避免重复菜单 */
async function migrateListPageMenuCodes(client: Queryable, log: (msg: string) => void): Promise<void> {
  const codeMappings: Array<[string, string]> = [
    ['system_query_management', 'system_list_page'],
    ['system_query_management_add', 'system_list_page_add'],
    ['system_query_management_edit', 'system_list_page_edit'],
    ['system_query_management_delete', 'system_list_page_delete'],
  ]

  for (const [oldCode, newCode] of codeMappings) {
    const legacy = await findMenuByCode(client, oldCode)
    const current = await findMenuByCode(client, newCode)
    if (!legacy) continue

    if (current && current.id !== legacy.id) {
      await client.query(`UPDATE menus SET parent_id = $1, updated_at = ${UTC_NOW} WHERE parent_id = $2`, [
        current.id,
        legacy.id,
      ])
      await client.query(
        `INSERT INTO role_menus (role_id, menu_id)
         SELECT DISTINCT rm.role_id, $1::int
         FROM role_menus rm
         WHERE rm.menu_id = $2
         AND NOT EXISTS (
           SELECT 1 FROM role_menus x WHERE x.role_id = rm.role_id AND x.menu_id = $1::int
         )`,
        [current.id, legacy.id],
      )
      await client.query('DELETE FROM role_menus WHERE menu_id = $1', [legacy.id])
      await client.query(`UPDATE menus SET code = $1, updated_at = ${UTC_NOW} WHERE id = $2`, [
        `legacy_${oldCode}_${legacy.id}`,
        legacy.id,
      ])
      await client.query('DELETE FROM menus WHERE id = $1', [legacy.id])
      log(`  已合并重复菜单编码: [${oldCode}] + [${newCode}]`)
      continue
    }

    await client.query(`UPDATE menus SET code = $1, updated_at = ${UTC_NOW} WHERE id = $2`, [newCode, legacy.id])
    log(`  菜单编码迁移: [${oldCode}] -> [${newCode}]`)
  }
}

/** 同步 PostgreSQL 表的主键序列到当前最大 id（表名为内部常量，非用户输入） */
async function syncIdSequence(client: Queryable, tableName: 'menus', log: (msg: string) => void): Promise<void> {
  await client.query(
    `SELECT setval(
       pg_get_serial_sequence('${tableName}', 'id'),
       COALESCE((SELECT MAX(id) FROM ${tableName}), 0) + 1,
       false
     )`,
  )
  log(`  已同步序列: ${tableName}.id`)
}

async function initMenus(client: Queryable, log: (msg: string) => void): Promise<{ added: number; updated: number }> {
  let added = 0
  let updated = 0

  await inTransaction(client, async () => {
    await migrateComponentCenterMenuCode(client, log)
    await migrateListPageMenuCodes(client, log)

    log('初始化菜单数据...')
    const { rows: idRows } = await client.query<{ id: number }>('SELECT id FROM menus')
    const existingIds = new Set(idRows.map((r) => r.id))

    for (const menu of MENUS_DATA) {
      const existing = await findMenuByCode(client, menu.code)
      if (existing) {
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
        log(`  更新菜单: [${menu.code}] ${menu.name}`)
        continue
      }

      // 固定 id 被别的菜单占用时（历史数据）不强插，改走序列
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
      added += 1
      existingIds.add(newId)
      log(`  创建菜单: [${menu.code}] ${menu.name} (ID: ${newId})`)
    }

    for (const code of RETIRED_MENU_CODES) {
      const retired = await findMenuByCode(client, code)
      if (retired && (retired.is_active || retired.is_visible)) {
        await client.query(
          `UPDATE menus SET is_active = false, is_visible = false, updated_at = ${UTC_NOW} WHERE id = $1`,
          [retired.id],
        )
        updated += 1
        log(`  下线菜单: [${code}]`)
      }
    }
  })

  if (added > 0 || updated > 0) {
    log(`菜单同步完成，新增 ${added} 项，更新 ${updated} 项\n`)
  } else {
    log('菜单无变更\n')
  }

  // 兼容显式写入固定 id 后序列未自动推进的问题
  await syncIdSequence(client, 'menus', log)
  return { added, updated }
}

/** 刷新超级管理员权限（授予全部菜单），返回角色 id 与菜单数 */
async function refreshSuperAdminPermissions(
  client: Queryable,
  log: (msg: string) => void,
): Promise<{ roleId: number; menuCount: number }> {
  log('刷新超级管理员权限...')
  return inTransaction(client, async () => {
    const { rows } = await client.query<{ id: number }>("SELECT id FROM roles WHERE code = 'super_admin' LIMIT 1")
    let roleId = rows[0]?.id
    if (roleId === undefined) {
      const inserted = await client.query<{ id: number }>(
        `INSERT INTO roles (name, code, description, created_at) VALUES ($1, $2, $3, ${UTC_NOW}) RETURNING id`,
        ['超级管理员', 'super_admin', '拥有所有权限的超级管理员'],
      )
      roleId = inserted.rows[0]!.id
      log('  创建角色: 超级管理员')
    }

    // admin_role.menus = all_menus：关联集合置为全部菜单（FK 保证不存在指向已删菜单的关联，只需补齐缺失项）
    await client.query(
      `INSERT INTO role_menus (role_id, menu_id) SELECT $1::int, id FROM menus ON CONFLICT DO NOTHING`,
      [roleId],
    )
    const { rows: countRows } = await client.query<{ n: number }>('SELECT count(*)::int AS n FROM menus')
    const menuCount = countRows[0]?.n ?? 0
    log(`  超级管理员刷新为 ${menuCount} 个菜单权限`)
    return { roleId, menuCount }
  })
}

async function initAdminUser(
  client: Queryable,
  roleId: number,
  adminPassword: string,
  log: (msg: string) => void,
): Promise<boolean> {
  log('初始化管理员账号...')
  let created = false
  await inTransaction(client, async () => {
    const { rows } = await client.query<{ id: number }>("SELECT id FROM admin_users WHERE username = 'admin' LIMIT 1")
    let userId = rows[0]?.id
    if (userId === undefined) {
      const passwordHash = await generatePasswordHash(adminPassword)
      const inserted = await client.query<{ id: number }>(
        `INSERT INTO admin_users (username, password_hash, created_at) VALUES ($1, $2, ${UTC_NOW}) RETURNING id`,
        ['admin', passwordHash],
      )
      userId = inserted.rows[0]!.id
      created = true
      log('  创建用户: admin')
      log(`  初始密码: ${adminPassword}`)
    } else {
      log('  用户已存在: admin')
    }

    const assigned = await client.query('INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [
      userId,
      roleId,
    ])
    if (assigned.rowCount) log('  分配角色: 超级管理员')
  })
  log('管理员账号初始化完成\n')
  return created
}

/** 可复用入口（setup-once 调用）；失败时抛出，由调用方决定退出码 */
export async function seedRbac(options: SeedRbacOptions): Promise<SeedRbacResult> {
  const log = options.log ?? console.log
  const incremental = options.incremental ?? false
  const client = new pg.Client({ connectionString: options.databaseUrl })
  await client.connect()
  try {
    log('='.repeat(60))
    log('RBAC系统同步')
    log(`${'='.repeat(60)}\n`)

    let menus: { added: number; updated: number }
    let role: { roleId: number; menuCount: number }
    if (incremental) {
      log('模式: 增量同步\n')
      menus = await initMenus(client, log)
      role = await refreshSuperAdminPermissions(client, log)
    } else {
      log('模式: 全量重建\n')
      await clearRbacData(client, log)
      menus = await initMenus(client, log)
      log('初始化角色...')
      role = await refreshSuperAdminPermissions(client, log)
      log('角色初始化完成\n')
    }
    const adminCreated = await initAdminUser(client, role.roleId, options.adminPassword, log)

    log('='.repeat(60))
    log('同步完成！')
    log('='.repeat(60))
    log('\n登录信息：')
    log('  用户名: admin')
    log(`  密码: ${options.adminPassword}`)

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

// 按脚本文件名判断是否为直接运行：本文件会被 setup-once 打包进同一个产物，import.meta.url 不可靠
const isMain = /[\\/]seed-rbac\.(?:ts|js|mjs)$/.test(process.argv[1] ?? '')
if (isMain) {
  let incremental = false
  try {
    const { values } = parseArgs({
      args: process.argv.slice(2).filter((arg) => arg !== '--'),
      options: { incremental: { type: 'boolean', default: false } },
    })
    incremental = values.incremental
  } catch (err) {
    // 参数错误退出码 2
    console.error('usage: seed-rbac [--incremental]')
    console.error(`seed-rbac: error: ${err instanceof Error ? err.message : String(err)}`)
    process.exit(2)
  }
  const env = (process.env.NODE_ENV ?? 'development') as AppEnv
  loadEnvFiles(env)
  const config = loadConfig()
  seedRbac({ databaseUrl: config.databaseUrl, adminPassword: config.adminPassword, incremental }).catch(
    (err: unknown) => {
      console.error(`\n初始化失败: ${err instanceof Error ? err.message : String(err)}`)
      if (err instanceof Error && err.stack) console.error(err.stack)
      process.exit(1)
    },
  )
}
