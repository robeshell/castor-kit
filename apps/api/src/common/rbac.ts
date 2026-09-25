/**
 * RBAC 权限判定纯函数
 *
 * 参数为已预加载 roles → menus 的用户（见 common/auth.ts 的 getCurrentAdminUser）。
 * 注意：这里只有“判定”才有 super_admin 短路；collect* 只收集角色实际分配的菜单。
 */

interface MenuLike {
  id: number
  code: string
}
interface RoleLike {
  code: string
  menus: MenuLike[]
}
interface UserLike {
  roles: RoleLike[]
}

export function isSuperAdmin(user: UserLike): boolean {
  return user.roles.some((role) => role.code === 'super_admin')
}

/** 用户（或其任一角色）是否拥有指定菜单/按钮 code 权限 */
export function userHasMenuCode(user: UserLike, menuCode: string): boolean {
  if (isSuperAdmin(user)) return true
  return user.roles.some((role) => role.menus.some((menu) => menu.code === menuCode))
}

/** 用户是否拥有指定菜单 id 的访问权限 */
export function userHasMenuAccess(user: UserLike, menuId: number): boolean {
  if (isSuperAdmin(user)) return true
  return user.roles.some((role) => role.menus.some((menu) => menu.id === menuId))
}

export function collectMenuIds(user: UserLike): number[] {
  const ids = new Set<number>()
  for (const role of user.roles) for (const menu of role.menus) ids.add(menu.id)
  return [...ids]
}

/** 去重后的菜单 code，顺序不保证；比较时应按集合比较 */
export function collectMenuCodes(user: UserLike): string[] {
  const codes = new Set<string>()
  for (const role of user.roles) for (const menu of role.menus) codes.add(menu.code)
  return [...codes]
}
