/**
 * Menu tree helpers: my-menus returns a tree (children exists only when there are child nodes).
 * Sidebar / breadcrumbs / ⌘K / routes all read from here so visibility rules stay consistent:
 * is_active && is_visible && menu_type !== 'button'.
 */

/** Pages that are not menus but still get a breadcrumb / tab title (the Chinese source text is the i18n key) */
export const STATIC_TITLES = { '/profile': '个人设置', '/403': '无访问权限' }

export function isNavVisible(menu) {
  return Boolean(menu && menu.is_active && menu.is_visible && menu.menu_type !== 'button')
}

export function visibleChildren(menu) {
  return Array.isArray(menu?.children) ? menu.children.filter(isNavVisible) : []
}

export function flattenMenus(menus = []) {
  const result = []
  const walk = (nodes = [], parents = []) => {
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
export function findActiveMenu(flat, pathname) {
  return flat
    .filter((menu) => typeof menu.path === 'string' && menu.path.startsWith('/'))
    .sort((a, b) => b.path.length - a.path.length)
    .find((menu) => pathname === menu.path || pathname.startsWith(`${menu.path}/`))
}

/** Navigable leaf pages (has a path and type is menu) */
export function navigablePages(flat) {
  return flat.filter((menu) => menu.menu_type === 'menu' && typeof menu.path === 'string' && menu.path.startsWith('/'))
}

/**
 * Sections for the "mixed" nav mode: every root group is a section; root-level leaf pages (e.g. the dashboard)
 * share one HOME_SECTION so the sidebar always has something to list.
 */
export const HOME_SECTION = 'home'

export function sectionOf(active) {
  if (!active) return HOME_SECTION
  const root = active.parents[0] ?? active
  return visibleChildren(root).length > 0 ? root.id : HOME_SECTION
}

/** First navigable page inside a menu subtree (where clicking a top-level section lands) */
export function firstPage(menu) {
  if (menu.menu_type === 'menu' && typeof menu.path === 'string' && menu.path.startsWith('/')) return menu
  for (const child of visibleChildren(menu)) {
    const page = firstPage(child)
    if (page) return page
  }
  return null
}
