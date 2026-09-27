import type { MenuNode } from '@/context/AuthContext'

/**
 * Menu tree helpers: my-menus returns a tree (children exists only when there are child nodes).
 * Sidebar / breadcrumbs / ⌘K / routes all read from here so visibility rules stay consistent:
 * is_active && is_visible && menu_type !== 'button'.
 */

/** A visible menu with its ancestors (root first), as flattenMenus returns it */
export type FlatMenu = MenuNode & { parents: MenuNode[] }

/** A menu with a route path (a string starting with '/') */
export type RoutedMenu<M extends MenuNode = MenuNode> = M & { path: string }

/** Pages that are not menus but still get a breadcrumb / tab title (the Chinese source text is the i18n key) */
export const STATIC_TITLES: Partial<Record<string, string>> = { '/profile': '个人设置', '/403': '无访问权限' }

/** The menu has a route path (a string starting with '/') */
export function hasRoutePath<M extends MenuNode>(menu: M): menu is RoutedMenu<M> {
  return typeof menu.path === 'string' && menu.path.startsWith('/')
}

export function isNavVisible(menu: MenuNode | null | undefined): boolean {
  return Boolean(menu && menu.is_active && menu.is_visible && menu.menu_type !== 'button')
}

export function visibleChildren(menu: MenuNode | null | undefined): MenuNode[] {
  return Array.isArray(menu?.children) ? menu.children.filter(isNavVisible) : []
}

export function flattenMenus(menus: MenuNode[] = []): FlatMenu[] {
  const result: FlatMenu[] = []
  const walk = (nodes: MenuNode[] = [], parents: MenuNode[] = []) => {
    nodes.forEach((node) => {
      if (!isNavVisible(node)) return
      result.push({ ...node, parents })
      walk(node.children || [], [...parents, node])
    })
  }
  walk(menus)
  return result
}

/** Menu matching the current path (longest prefix match) */
export function findActiveMenu(flat: FlatMenu[], pathname: string): RoutedMenu<FlatMenu> | undefined {
  return flat
    .filter((menu): menu is RoutedMenu<FlatMenu> => typeof menu.path === 'string' && menu.path.startsWith('/'))
    .sort((a, b) => b.path.length - a.path.length)
    .find((menu) => pathname === menu.path || pathname.startsWith(`${menu.path}/`))
}

/** Navigable leaf pages (has a path and type is menu) */
export function navigablePages(flat: FlatMenu[]): RoutedMenu<FlatMenu>[] {
  return flat.filter(
    (menu): menu is RoutedMenu<FlatMenu> => menu.menu_type === 'menu' && typeof menu.path === 'string' && menu.path.startsWith('/'),
  )
}

/**
 * Sections for the "mixed" nav mode: every root group is a section; root-level leaf pages (e.g. the dashboard)
 * share one HOME_SECTION so the sidebar always has something to list.
 */
export const HOME_SECTION = 'home'

/** A mixed-mode section: a root group's id, or HOME_SECTION */
export type Section = number | typeof HOME_SECTION

export function sectionOf(active: FlatMenu | null | undefined): Section {
  if (!active) return HOME_SECTION
  const root = active.parents[0] ?? active
  return visibleChildren(root).length > 0 ? root.id : HOME_SECTION
}

/** First navigable page inside a menu subtree (where clicking a top-level section lands) */
export function firstPage(menu: MenuNode): RoutedMenu | null {
  if (menu.menu_type === 'menu' && hasRoutePath(menu)) return menu
  for (const child of visibleChildren(menu)) {
    const page = firstPage(child)
    if (page) return page
  }
  return null
}
