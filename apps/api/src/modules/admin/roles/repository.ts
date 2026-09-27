/**
 * Roles module repository layer
 */

import { and, asc, eq, ilike, inArray, or } from 'drizzle-orm'
import type { Executor } from '@/db/client'
import { departments, menus, role_depts, role_menus, roles, type Menu, type Role, type RoleWithMenus } from '@/db/schema'

export class RoleRepository {
  constructor(private readonly db: Executor) {}

  /** All roles (by id) with their menus */
  async listWithMenus(): Promise<RoleWithMenus[]> {
    const rows = await this.db.select().from(roles).orderBy(asc(roles.id))
    const byRole = await this.menusByRole(rows.map((r) => r.id))
    return rows.map((r) => ({ ...r, menus: byRole.get(r.id) ?? [] }))
  }

  /** The menus of each role, ordered by (sort_order, id) */
  async menusByRole(roleIds: number[]): Promise<Map<number, Menu[]>> {
    const map = new Map<number, Menu[]>()
    if (roleIds.length === 0) return map
    const rows = await this.db
      .select({ roleId: role_menus.role_id, menu: menus })
      .from(role_menus)
      .innerJoin(menus, eq(menus.id, role_menus.menu_id))
      .where(inArray(role_menus.role_id, roleIds))
      .orderBy(asc(menus.sort_order), asc(menus.id))
    for (const { roleId, menu } of rows) map.set(roleId, [...(map.get(roleId) ?? []), menu])
    return map
  }

  async getById(id: number): Promise<Role | null> {
    const [row] = await this.db.select().from(roles).where(eq(roles.id, id)).limit(1)
    return row ?? null
  }

  async getWithMenus(id: number): Promise<RoleWithMenus | null> {
    const role = await this.getById(id)
    return role ? { ...role, menus: (await this.menusByRole([id])).get(id) ?? [] } : null
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

  async allMenuIds(): Promise<number[]> {
    const rows = await this.db.select({ id: menus.id }).from(menus)
    return rows.map((r) => r.id)
  }

  /** role_id → departments of its custom data scope */
  async deptIdsByRole(roleIds: number[]): Promise<Map<number, number[]>> {
    const map = new Map<number, number[]>()
    if (roleIds.length === 0) return map
    const rows = await this.db
      .select({ role_id: role_depts.role_id, dept_id: role_depts.dept_id })
      .from(role_depts)
      .where(inArray(role_depts.role_id, roleIds))
      .orderBy(asc(role_depts.dept_id))
    for (const r of rows) map.set(r.role_id, [...(map.get(r.role_id) ?? []), r.dept_id])
    return map
  }

  /** Replace a role's custom-scope departments */
  async setDepts(roleId: number, deptIds: number[]): Promise<void> {
    await this.db.delete(role_depts).where(eq(role_depts.role_id, roleId))
    if (deptIds.length > 0) await this.db.insert(role_depts).values(deptIds.map((dept_id) => ({ role_id: roleId, dept_id })))
  }

  async listDeptsByCodes(codes: string[]): Promise<{ id: number; code: string }[]> {
    if (codes.length === 0) return []
    return this.db.select({ id: departments.id, code: departments.code }).from(departments).where(inArray(departments.code, codes))
  }

  /** role_id → codes of its custom-scope departments */
  async deptCodesByRole(roleIds: number[]): Promise<Map<number, string[]>> {
    const map = new Map<number, string[]>()
    if (roleIds.length === 0) return map
    const rows = await this.db
      .select({ role_id: role_depts.role_id, code: departments.code })
      .from(role_depts)
      .innerJoin(departments, eq(departments.id, role_depts.dept_id))
      .where(inArray(role_depts.role_id, roleIds))
      .orderBy(asc(departments.code))
    for (const r of rows) map.set(r.role_id, [...(map.get(r.role_id) ?? []), r.code])
    return map
  }

  async existingDeptIds(ids: number[]): Promise<number[]> {
    if (ids.length === 0) return []
    const rows = await this.db.select({ id: departments.id }).from(departments).where(inArray(departments.id, ids))
    return rows.map((r) => r.id)
  }

  async insert(values: { name: string; code: string; description: string | null; data_scope?: string }): Promise<Role> {
    const [row] = await this.db.insert(roles).values(values).returning()
    return row!
  }

  async update(id: number, values: Partial<Pick<Role, 'name' | 'code' | 'description' | 'data_scope'>>): Promise<void> {
    if (Object.keys(values).length === 0) return
    await this.db.update(roles).set(values).where(eq(roles.id, id))
  }

  async delete(id: number): Promise<void> {
    await this.db.delete(roles).where(eq(roles.id, id))
  }

  /** Replace a role's menus (like `role.menus = [...]`), inserting/deleting only the difference */
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
