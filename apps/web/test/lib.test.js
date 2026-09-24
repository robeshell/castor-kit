import { describe, expect, it } from 'vitest'
import { findActiveMenu, flattenMenus, navigablePages } from '@/components/app/menu-tree'
import { formatDate, formatDateTime, formatNumber } from '@/lib/format'
import { resolveMenuIcon } from '@/lib/menu-icons'
import { Home, List } from 'lucide-react'

const MENUS = [
  { id: 1, name: '首页', code: 'dashboard', path: '/dashboard', menu_type: 'menu', is_active: true, is_visible: true, icon: 'IconHome' },
  {
    id: 2,
    name: '系统管理',
    code: 'system',
    menu_type: 'directory',
    is_active: true,
    is_visible: true,
    children: [
      { id: 21, name: '用户管理', code: 'system_users', path: '/system/users', menu_type: 'menu', is_active: true, is_visible: true },
      { id: 211, name: '新增', code: 'system_users_add', menu_type: 'button', is_active: true, is_visible: false },
      { id: 22, name: '隐藏页', code: 'hidden', path: '/system/hidden', menu_type: 'menu', is_active: true, is_visible: false },
    ],
  },
]

describe('menu-tree', () => {
  it('flatten 只保留可见、启用、非按钮菜单，并带上祖先链', () => {
    const flat = flattenMenus(MENUS)
    expect(flat.map((m) => m.id)).toEqual([1, 2, 21])
    expect(flat.find((m) => m.id === 21).parents.map((p) => p.id)).toEqual([2])
  })
  it('最长前缀匹配当前菜单', () => {
    const flat = flattenMenus(MENUS)
    expect(findActiveMenu(flat, '/system/users/12').id).toBe(21)
    expect(findActiveMenu(flat, '/nope')).toBeUndefined()
  })
  it('可导航页面只包含有 path 的 menu 类型', () => {
    expect(navigablePages(flattenMenus(MENUS)).map((m) => m.id)).toEqual([1, 21])
  })
})

describe('format', () => {
  it('时间按原样截断展示', () => {
    expect(formatDateTime('2026-08-01T12:35:48.834152')).toBe('2026-08-01 12:35:48')
    expect(formatDate('2026-08-01T12:35:48')).toBe('2026-08-01')
    expect(formatDateTime(null)).toBe('-')
  })
  it('数字千分位', () => {
    expect(formatNumber(1234567)).toBe('1,234,567')
    expect(formatNumber('12.50')).toBe('12.5')
    expect(formatNumber('abc')).toBe('-')
  })
})

describe('menu-icons', () => {
  it('Semi 图标名映射到 lucide，未知回退 List', () => {
    expect(resolveMenuIcon({ icon: 'IconHome' })).toBe(Home)
    expect(resolveMenuIcon({ icon: 'IconUnknown', code: 'x' })).toBe(List)
  })
})
