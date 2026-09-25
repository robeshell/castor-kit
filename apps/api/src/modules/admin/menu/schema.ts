/**
 * 菜单模块 schema 层：参数映射、校验、类型转换
 */

import { ServiceError } from '@/common/errors'
import { pyInt, pyStr, pyStrOrEmpty } from '@/common/py'
import type { Menu } from '@/db/schema'

/** 导出行：菜单 + 父级编码（`item.parent.code`） */
export type MenuExportItem = Menu & { parent_code: string | null }

export const EXPORT_FIELD_MAP: Record<string, [string, (item: MenuExportItem) => unknown]> = {
  id: ['ID', (item) => item.id],
  name: ['菜单名称', (item) => item.name],
  code: ['菜单编码', (item) => item.code],
  menu_type: ['类型', (item) => item.menu_type],
  path: ['路径', (item) => item.path || ''],
  component: ['组件', (item) => item.component || ''],
  icon: ['图标', (item) => item.icon || ''],
  parent_code: ['父级编码', (item) => item.parent_code ?? ''],
  sort_order: ['排序', (item) => (item.sort_order !== null ? item.sort_order : 0)],
  is_visible: ['是否显示', (item) => (item.is_visible ? '是' : '否')],
  is_active: ['是否启用', (item) => (item.is_active ? '是' : '否')],
  description: ['描述', (item) => item.description || ''],
}

export const IMPORT_HEADER_MAP: Record<string, string> = {
  菜单名称: 'name',
  菜单编码: 'code',
  类型: 'menu_type',
  路径: 'path',
  组件: 'component',
  图标: 'icon',
  父级编码: 'parent_code',
  排序: 'sort_order',
  是否显示: 'is_visible',
  是否启用: 'is_active',
  描述: 'description',
}

export const TEMPLATE_HEADERS = ['菜单名称', '菜单编码', '类型', '路径', '组件', '图标', '父级编码', '排序', '是否显示', '是否启用', '描述']
export const TEMPLATE_ROWS = [['示例菜单', 'demo_menu', 'menu', '/demo/menu', 'DemoMenu', 'IconApps', '', 99, '是', '是', '示例描述']]

export const MENU_TYPES = new Set(['directory', 'menu', 'button'])

export const MENU_MUTABLE_FIELDS = [
  'name',
  'code',
  'icon',
  'path',
  'component',
  'parent_id',
  'sort_order',
  'is_visible',
  'is_active',
  'menu_type',
  'description',
] as const
export type MenuMutableField = (typeof MENU_MUTABLE_FIELDS)[number]

const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on', '是', '启用'])
const FALSE_VALUES = new Set(['0', 'false', 'no', 'off', '否', '停用'])

export function parseBool(value: unknown, fallback: boolean | null = null): boolean | null {
  if (value === null || value === undefined || value === '') return fallback
  if (typeof value === 'boolean') return value
  const raw = pyStr(value).trim().toLowerCase()
  if (TRUE_VALUES.has(raw)) return true
  if (FALSE_VALUES.has(raw)) return false
  return fallback
}

export function parseIntOr(value: unknown, fallback = 0): number {
  try {
    return pyInt(value)
  } catch {
    return fallback
  }
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

export function validateCreatePayload(data: Record<string, unknown>): void {
  if (!pyStrOrEmpty(data.name) || !pyStrOrEmpty(data.code)) {
    throw new ServiceError('菜单名称和编码不能为空', 400)
  }
}

export function validateUpdatePayload(data: Record<string, unknown>): void {
  if ('name' in data && !pyStrOrEmpty(data.name)) throw new ServiceError('菜单名称不能为空', 400)
  if ('code' in data && !pyStrOrEmpty(data.code)) throw new ServiceError('菜单编码不能为空', 400)
}

export function mapImportHeaders(fieldnames: string[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const header of fieldnames) {
    const key = (header ?? '').trim()
    if (Object.hasOwn(IMPORT_HEADER_MAP, key)) map.set(header, IMPORT_HEADER_MAP[key]!)
  }
  return map
}

export interface ParsedImportRow {
  name: string
  code: string
  menu_type: string
  path: string | null
  component: string | null
  icon: string | null
  parent_code: string
  sort_order: number
  is_visible: boolean
  is_active: boolean
  description: string | null
}

export function parseImportRow(mapped: Record<string, string>): ParsedImportRow {
  const text = (key: string) => pyStrOrEmpty(mapped[key])
  return {
    name: text('name'),
    code: text('code'),
    menu_type: pyStrOrEmpty(mapped.menu_type || 'menu') || 'menu',
    path: text('path') || null,
    component: text('component') || null,
    icon: text('icon') || null,
    parent_code: text('parent_code'),
    sort_order: parseIntOr(mapped.sort_order, 0),
    is_visible: parseBool(mapped.is_visible, true)!,
    is_active: parseBool(mapped.is_active, true)!,
    description: text('description') || null,
  }
}
