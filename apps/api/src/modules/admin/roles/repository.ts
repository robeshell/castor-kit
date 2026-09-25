/**
 * 角色模块 repository 层
 *
 * 几处“无 ORDER BY”的查询刻意保持固定的 SQL 形状（别名、JOIN 结构不要随意改），使 PostgreSQL 选择稳定的执行计划、
 * 返回既有的行序（角色导出的菜单编码顺序就取决于这些查询）：
 * - `listWithMenusPyOrder`：角色列表，roles LEFT OUTER JOIN role_menus/menus 一次查出
 * - `lazyMenus`：单个角色的菜单，menus × role_menus 按角色过滤
 * - `currentUserRoleMenus`：当前用户 → 角色 → 菜单一次 JOIN 查出；同一请求内当前用户的角色
 *   直接复用这份菜单集合与顺序
 */

import { and, asc, eq, ilike, inArray, or, sql } from 'drizzle-orm'
import type { Executor } from '@/db/client'
import { menus, role_menus, roles, type Menu, type Role, type RoleWithMenus } from '@/db/schema'

const MENU_COLUMNS = (alias: string) =>
  sql.raw(
    [
      'id',
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
      'created_at',
      'updated_at',
    ]
      .map((c) => `${alias}.${c} AS ${alias}_${c}`)
      .join(', '),
  )

const MENU_KEYS = [
  'id',
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
  'created_at',
  'updated_at',
] as const

function menuFromRow(row: Record<string, unknown>, alias: string): Menu | null {
  if (row[`${alias}_id`] === null || row[`${alias}_id`] === undefined) return null
  return Object.fromEntries(MENU_KEYS.map((k) => [k, row[`${alias}_${k}`]])) as unknown as Menu
}

function roleFromRow(row: Record<string, unknown>, prefix: string): Role {
  return {
    id: row[`${prefix}id`] as number,
    name: row[`${prefix}name`] as string,
    code: row[`${prefix}code`] as string,
    description: row[`${prefix}description`] as string | null,
    created_at: row[`${prefix}created_at`] as string | null,
  }
}

export class RoleRepository {
  constructor(private readonly db: Executor) {}

  /** 全部角色及其菜单（一次 JOIN 查出）：按结果行首次出现顺序返回角色 */
  async listWithMenusPyOrder(): Promise<RoleWithMenus[]> {
    const result = await this.db.execute<Record<string, unknown>>(sql`
      SELECT roles.id AS roles_id, roles.name AS roles_name, roles.code AS roles_code,
             roles.description AS roles_description, roles.created_at AS roles_created_at, ${MENU_COLUMNS('menus_1')}
      FROM roles LEFT OUTER JOIN (role_menus AS role_menus_1 JOIN menus AS menus_1 ON menus_1.id = role_menus_1.menu_id)
        ON roles.id = role_menus_1.role_id
    `)
    const byId = new Map<number, RoleWithMenus>()
    for (const row of result.rows) {
      const id = row.roles_id as number
      let role = byId.get(id)
      if (!role) {
        role = { ...roleFromRow(row, 'roles_'), menus: [] }
        byId.set(id, role)
      }
      const menu = menuFromRow(row, 'menus_1')
      if (menu && !role.menus.some((m) => m.id === menu.id)) role.menus.push(menu)
    }
    return [...byId.values()]
  }

  /** 单个角色的菜单（经 role_menus 关联，无 ORDER BY） */
  async lazyMenus(roleId: number): Promise<Menu[]> {
    const result = await this.db.execute<Record<string, unknown>>(sql`
      SELECT ${MENU_COLUMNS('menus')}
      FROM menus, role_menus
      WHERE ${roleId} = role_menus.role_id AND menus.id = role_menus.menu_id
    `)
    return result.rows.map((row) => menuFromRow(row, 'menus')!)
  }

  /** 当前用户的角色菜单预加载查询：返回该用户每个角色的菜单（按结果行顺序） */
  async currentUserRoleMenus(username: string): Promise<Map<number, Menu[]>> {
    const result = await this.db.execute<Record<string, unknown>>(sql`
      SELECT anon_1.admin_users_id AS anon_1_admin_users_id, anon_1.admin_users_username AS anon_1_admin_users_username,
             anon_1.admin_users_password_hash AS anon_1_admin_users_password_hash,
             anon_1.admin_users_created_at AS anon_1_admin_users_created_at, ${MENU_COLUMNS('menus_1')},
             roles_1.id AS roles_1_id, roles_1.name AS roles_1_name, roles_1.code AS roles_1_code,
             roles_1.description AS roles_1_description, roles_1.created_at AS roles_1_created_at
      FROM (SELECT admin_users.id AS admin_users_id, admin_users.username AS admin_users_username,
                   admin_users.password_hash AS admin_users_password_hash, admin_users.created_at AS admin_users_created_at
            FROM admin_users WHERE admin_users.username = ${username} LIMIT ${1}) AS anon_1
        LEFT OUTER JOIN (user_roles AS user_roles_1 JOIN roles AS roles_1 ON roles_1.id = user_roles_1.role_id)
          ON anon_1.admin_users_id = user_roles_1.user_id
        LEFT OUTER JOIN (role_menus AS role_menus_1 JOIN menus AS menus_1 ON menus_1.id = role_menus_1.menu_id)
          ON roles_1.id = role_menus_1.role_id
    `)
    const map = new Map<number, Menu[]>()
    for (const row of result.rows) {
      const roleId = row.roles_1_id as number | null
      if (roleId === null || roleId === undefined) continue
      const list = map.get(roleId) ?? []
      map.set(roleId, list)
      const menu = menuFromRow(row, 'menus_1')
      if (menu && !list.some((m) => m.id === menu.id)) list.push(menu)
    }
    return map
  }

  async getById(id: number): Promise<Role | null> {
    const [row] = await this.db.select().from(roles).where(eq(roles.id, id)).limit(1)
    return row ?? null
  }

  async getWithMenus(id: number): Promise<RoleWithMenus | null> {
    const role = await this.getById(id)
    return role ? { ...role, menus: await this.lazyMenus(id) } : null
  }

  async getByCode(code: string): Promise<Role | null> {
    const [row] = await this.db.select().from(roles).where(eq(roles.code, code)).limit(1)
    return row ?? null
  }

  async listMenusByIds(ids: number[]): Promise<Menu[]> {
    if (ids.length === 0) return []
    return this.db.select().from(menus).where(inArray(menus.id, ids))
  }

  async listMenusByCodes(codes: string[]): Promise<Menu[]> {
    if (codes.length === 0) return []
    return this.db.select().from(menus).where(inArray(menus.code, codes))
  }

  async listForExportFiltered(search: string): Promise<Role[]> {
    const where = search ? or(ilike(roles.name, `%${search}%`), ilike(roles.code, `%${search}%`)) : undefined
    return this.db.select().from(roles).where(where).orderBy(asc(roles.id))
  }

  async listByIdsOrdered(ids: number[]): Promise<Role[]> {
    if (ids.length === 0) return []
    return this.db.select().from(roles).where(inArray(roles.id, ids)).orderBy(asc(roles.id))
  }

  async insert(values: { name: string; code: string; description: string | null }): Promise<Role> {
    const [row] = await this.db.insert(roles).values(values).returning()
    return row!
  }

  async update(id: number, values: Partial<Pick<Role, 'name' | 'code' | 'description'>>): Promise<void> {
    if (Object.keys(values).length === 0) return
    await this.db.update(roles).set(values).where(eq(roles.id, id))
  }

  async delete(id: number): Promise<void> {
    await this.db.delete(roles).where(eq(roles.id, id))
  }

  /** 覆盖式设置角色菜单（对应 `role.menus = [...]`），只增删差异部分 */
  async setMenus(roleId: number, menuIds: number[]): Promise<void> {
    const wanted = new Set(menuIds)
    const current = await this.db.select({ id: role_menus.menu_id }).from(role_menus).where(eq(role_menus.role_id, roleId))
    const currentIds = new Set(current.map((r) => r.id))
    const toRemove = [...currentIds].filter((id) => !wanted.has(id))
    const toAdd = [...wanted].filter((id) => !currentIds.has(id))
    if (toRemove.length > 0) {
      await this.db.delete(role_menus).where(and(eq(role_menus.role_id, roleId), inArray(role_menus.menu_id, toRemove)))
    }
    if (toAdd.length > 0) {
      await this.db.insert(role_menus).values(toAdd.map((menuId) => ({ role_id: roleId, menu_id: menuId })))
    }
  }
}
