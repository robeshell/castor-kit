/**
 * 菜单树工具：my-menus 返回的是树（children 仅在有子节点时存在）。
 * 侧边栏 / 面包屑 / ⌘K / 路由都从这里取，保证可见性规则一致：
 * is_active && is_visible && menu_type !== 'button'。
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

/** 当前路径命中的菜单（最长前缀匹配） */
export function findActiveMenu(flat, pathname) {
  return flat
    .filter((menu) => typeof menu.path === 'string' && menu.path.startsWith('/'))
    .sort((a, b) => b.path.length - a.path.length)
    .find((menu) => pathname === menu.path || pathname.startsWith(`${menu.path}/`))
}

/** 可导航的叶子页面（有 path 且类型为 menu） */
export function navigablePages(flat) {
  return flat.filter((menu) => menu.menu_type === 'menu' && typeof menu.path === 'string' && menu.path.startsWith('/'))
}
