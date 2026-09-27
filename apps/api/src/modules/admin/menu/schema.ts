/**
 * Menu module schema layer: parameter mapping, validation, type conversion
 */

import { z } from 'zod'
import { exportBody, field, parseIntText, parseYesNo } from '@/common/validation'
import type { Menu } from '@/db/schema'

/** Export row: menu + parent code (`item.parent.code`) */
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

export const MENU_TYPES = ['directory', 'menu', 'button'] as const

export const menuBody = z.object({
  name: field.requiredText('菜单名称', '菜单名称不能为空'),
  code: field.requiredText('菜单编码', '菜单编码不能为空'),
  icon: field.text('图标'),
  path: field.text('路径'),
  component: field.text('组件'),
  parent_id: field.id('父级菜单'),
  sort_order: field.int('排序', 0),
  is_visible: field.bool('是否显示', true),
  is_active: field.bool('是否启用', true),
  menu_type: field.choice('菜单类型', MENU_TYPES, 'menu', '菜单类型只能是 directory、menu 或 button'),
  description: field.text('描述'),
})

export type MenuInput = z.output<typeof menuBody>

export const menuSortBody = z.object({ direction: field.text('direction') })

export const menuExportBody = exportBody({ search: field.text('搜索') })

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
  const text = (key: string) => (mapped[key] ?? '').trim()
  return {
    name: text('name'),
    code: text('code'),
    menu_type: text('menu_type') || 'menu',
    path: text('path') || null,
    component: text('component') || null,
    icon: text('icon') || null,
    parent_code: text('parent_code'),
    sort_order: parseIntText(mapped.sort_order, 0),
    is_visible: parseYesNo(mapped.is_visible, true)!,
    is_active: parseYesNo(mapped.is_active, true)!,
    description: text('description') || null,
  }
}
