/**
 * Menu tree helpers: my-menus returns a tree (children exists only when there are child nodes).
 * Sidebar / breadcrumbs / ⌘K / routes all read from here so visibility rules stay consistent:
 * is_active && is_visible && menu_type !== 'button'.
 */

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
