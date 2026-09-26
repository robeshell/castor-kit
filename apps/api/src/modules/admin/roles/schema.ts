/**
 * Roles module schema layer
 */

import type { DataScopeCode } from '@/common/data-scope'
import { formatDateTime } from '@/common/serialize'
import type { Menu, Role } from '@/db/schema'

/** Export row: role + its menus in the order they were actually loaded */
export type RoleExportItem = Role & { menus: Menu[] }

/** Labels for roles.data_scope (export files) */
export const DATA_SCOPE_LABELS: Record<DataScopeCode, string> = {
  all: '全部数据',
  dept_and_children: '本部门及下级',
  dept: '本部门',
  self: '仅本人',
  custom: '自定义部门',
}

export const EXPORT_FIELD_MAP: Record<string, [string, (item: RoleExportItem) => unknown]> = {
  id: ['ID', (item) => item.id],
  name: ['角色名称', (item) => item.name],
  code: ['角色编码', (item) => item.code],
  description: ['描述', (item) => item.description || ''],
  data_scope: ['数据范围', (item) => DATA_SCOPE_LABELS[item.data_scope as DataScopeCode] ?? item.data_scope],
  menu_codes: ['菜单编码', (item) => item.menus.map((m) => m.code).join(',')],
  menu_names: ['菜单名称', (item) => item.menus.map((m) => m.name).join(',')],
  created_at: ['创建时间', (item) => formatDateTime(item.created_at)],
}

export const IMPORT_HEADER_MAP: Record<string, string> = {
  角色名称: 'name',
  角色编码: 'code',
  描述: 'description',
  菜单编码: 'menu_codes',
}

export const TEMPLATE_HEADERS = ['角色名称', '角色编码', '描述', '菜单编码']
export const TEMPLATE_ROWS = [['示例角色', 'demo_role', '示例描述', 'dashboard,system_users']]

export function parseCodes(raw: unknown): string[] {
  if (raw === null || raw === undefined) return []
  const text = String(raw).trim()
  if (!text) return []
  return text
    .replace(/，/g, ',')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

export interface ErrorRow {
  line: number
  reason: string
  row: Record<string, string>
}

export function buildErrorRow(line: number, reason: string, row: Record<string, unknown>): ErrorRow {
  return {
    line,
    reason,
    row: Object.fromEntries(Object.entries(row ?? {}).map(([k, v]) => [k, v === null || v === undefined ? '' : String(v)])),
  }
}
