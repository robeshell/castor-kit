/**
 * Pure functions for RBAC permission checks
 *
 * Takes a user with roles → menus already eager-loaded (see getCurrentAdminUser in common/auth.ts).
 * Note: only the "check" functions short-circuit for super_admin; collect* only gathers menus actually assigned to roles.
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

/** Whether the user (or any of their roles) has the given menu/button code permission */
export function userHasMenuCode(user: UserLike, menuCode: string): boolean {
  if (isSuperAdmin(user)) return true
  return user.roles.some((role) => role.menus.some((menu) => menu.code === menuCode))
}

/** Whether the user can access the given menu id */
export function userHasMenuAccess(user: UserLike, menuId: number): boolean {
  if (isSuperAdmin(user)) return true
  return user.roles.some((role) => role.menus.some((menu) => menu.id === menuId))
}

export function collectMenuIds(user: UserLike): number[] {
  const ids = new Set<number>()
  for (const role of user.roles) for (const menu of role.menus) ids.add(menu.id)
  return [...ids]
}

/** Deduplicated menu codes in no guaranteed order; compare them as a set */
export function collectMenuCodes(user: UserLike): string[] {
  const codes = new Set<string>()
  for (const role of user.roles) for (const menu of role.menus) codes.add(menu.code)
  return [...codes]
}
