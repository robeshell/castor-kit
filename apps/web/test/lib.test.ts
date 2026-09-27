import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { findActiveMenu, flattenMenus, navigablePages } from '@/components/app/menu-tree'
import { formatBytes, formatDate, formatDateTime, formatNumber, localToIso, parseApiTime } from '@/lib/format'
import { resolveMenuIcon } from '@/lib/menu-icons'
import { Home, List } from 'lucide-react'
import type { MenuNode } from '@/context/AuthContext'

/** A menu as /my-menus returns it: fields a test doesn't set are null */
const menu = (fields: Pick<MenuNode, 'id' | 'name' | 'code'> & Partial<MenuNode>): MenuNode => ({
  icon: null,
  path: null,
  component: null,
  parent_id: null,
  sort_order: null,
  is_visible: null,
  is_active: null,
  menu_type: null,
  description: null,
  created_at: null,
  updated_at: null,
  ...fields,
})

const MENUS: MenuNode[] = [
  menu({ id: 1, name: '首页', code: 'dashboard', path: '/dashboard', menu_type: 'menu', is_active: true, is_visible: true, icon: 'Home' }),
  menu({
    id: 2,
    name: '系统管理',
    code: 'system',
    menu_type: 'directory',
    is_active: true,
    is_visible: true,
    children: [
      menu({ id: 21, name: '用户管理', code: 'system_users', path: '/system/users', menu_type: 'menu', is_active: true, is_visible: true }),
      menu({ id: 211, name: '新增', code: 'system_users_add', menu_type: 'button', is_active: true, is_visible: false }),
      menu({ id: 22, name: '隐藏页', code: 'hidden', path: '/system/hidden', menu_type: 'menu', is_active: true, is_visible: false }),
    ],
  }),
]

describe('menu-tree', () => {
  it('flatten 只保留可见、启用、非按钮菜单，并带上祖先链', () => {
    const flat = flattenMenus(MENUS)
    expect(flat.map((m) => m.id)).toEqual([1, 2, 21])
    expect(flat.find((m) => m.id === 21)?.parents.map((p) => p.id)).toEqual([2])
  })
  it('最长前缀匹配当前菜单', () => {
    const flat = flattenMenus(MENUS)
    expect(findActiveMenu(flat, '/system/users/12')?.id).toBe(21)
    expect(findActiveMenu(flat, '/nope')).toBeUndefined()
  })
  it('可导航页面只包含有 path 的 menu 类型', () => {
    expect(navigablePages(flattenMenus(MENUS)).map((m) => m.id)).toEqual([1, 21])
  })
})

describe('format', () => {
  describe('时间按浏览器时区展示（固定为 Asia/Shanghai）', () => {
    const tz = process.env.TZ
    beforeAll(() => {
      process.env.TZ = 'Asia/Shanghai'
    })
    afterAll(() => {
      process.env.TZ = tz
    })

    it('接口时间（UTC，带 Z）转为本地时间', () => {
      expect(formatDateTime('2026-08-01T12:35:48.834152Z')).toBe('2026-08-01 20:35:48')
      expect(formatDateTime('2026-08-01T20:35:48.000000Z')).toBe('2026-08-02 04:35:48')
      // Text without a zone is UTC, as the API reads it
      expect(formatDateTime('2026-08-01 12:35:48')).toBe('2026-08-01 20:35:48')
      expect(formatDate('2026-08-01T20:35:48.000000Z')).toBe('2026-08-02')
      expect(formatDate('2026-08-01')).toBe('2026-08-01')
      expect(formatDateTime(null)).toBe('-')
      expect(parseApiTime('2026-08-01T12:35:48.834152Z')).toBe(Date.UTC(2026, 7, 1, 12, 35, 48, 834))
      expect(parseApiTime('not a time')).toBeNaN()
    })

    it('日期时间选择器的输出带本地时区偏移', () => {
      expect(localToIso('2026-08-01', '20:35:48')).toBe('2026-08-01T20:35:48+08:00')
      expect(parseApiTime(localToIso('2026-08-01', '20:35:48'))).toBe(Date.UTC(2026, 7, 1, 12, 35, 48))
    })
  })
  it('数字千分位', () => {
    expect(formatNumber(1234567)).toBe('1,234,567')
    expect(formatNumber('12.50')).toBe('12.5')
    expect(formatNumber('abc')).toBe('-')
  })
})

describe('formatBytes', () => {
  it('按 1024 进位，保留一位小数，非法值用占位符', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(1536)).toBe('1.5 KB')
    expect(formatBytes(3 * 1024 * 1024)).toBe('3 MB')
    expect(formatBytes(150 * 1024 * 1024)).toBe('150 MB')
    expect(formatBytes('2048')).toBe('2 KB')
    expect(formatBytes(-1)).toBe('-')
    expect(formatBytes(undefined, '')).toBe('')
  })
})

describe('menu-icons', () => {
  it('IconXxx 图标名映射到 lucide，未知回退 List', () => {
    expect(resolveMenuIcon({ icon: 'Home' })).toBe(Home)
    expect(resolveMenuIcon({ icon: 'IconUnknown', code: 'x' })).toBe(List)
  })
})
