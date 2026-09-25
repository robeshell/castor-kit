/**
 * 用户模块 repository 层
 */

import { and, asc, count, desc, eq, ilike, inArray, ne, type SQL } from 'drizzle-orm'
import { loadAdminsWithRolesByIds } from '@/common/auth'
import type { Executor } from '@/db/client'
import { admin_users, roles, user_roles, type Role } from '@/db/schema'

export class UserRepository {
  constructor(private readonly db: Executor) {}

  private searchWhere(search: string): SQL | undefined {
    return search ? ilike(admin_users.username, `%${search}%`) : undefined
  }

  async listPage(page: number, perPage: number, search: string) {
    const where = this.searchWhere(search)
    const [totalRow] = await this.db.select({ n: count() }).from(admin_users).where(where)
    const idRows = await this.db
      .select({ id: admin_users.id })
      .from(admin_users)
      .where(where)
      .orderBy(desc(admin_users.id))
      .limit(perPage)
      .offset((page - 1) * perPage)
    return {
      total: totalRow?.n ?? 0,
      items: await loadAdminsWithRolesByIds(this.db, idRows.map((r) => r.id)),
    }
  }

  async listAllOrdered(search: string) {
    const rows = await this.db
      .select({ id: admin_users.id })
      .from(admin_users)
      .where(this.searchWhere(search))
      .orderBy(asc(admin_users.id))
    return loadAdminsWithRolesByIds(this.db, rows.map((r) => r.id))
  }

  async listByIdsOrdered(ids: number[]) {
    if (ids.length === 0) return []
    const rows = await this.db
      .select({ id: admin_users.id })
      .from(admin_users)
      .where(inArray(admin_users.id, ids))
      .orderBy(asc(admin_users.id))
    return loadAdminsWithRolesByIds(this.db, rows.map((r) => r.id))
  }

  async getWithRoles(id: number) {
    const [user] = await loadAdminsWithRolesByIds(this.db, [id])
    return user ?? null
  }

  async getByUsername(username: string) {
    const [row] = await this.db.select().from(admin_users).where(eq(admin_users.username, username)).limit(1)
    return row ?? null
  }

  async insert(username: string, passwordHash: string) {
    const [row] = await this.db.insert(admin_users).values({ username, password_hash: passwordHash }).returning()
    return row!
  }

  async updatePasswordHash(id: number, passwordHash: string) {
    await this.db.update(admin_users).set({ password_hash: passwordHash }).where(eq(admin_users.id, id))
  }

  async delete(id: number) {
    await this.db.delete(admin_users).where(eq(admin_users.id, id))
  }

  /** 覆盖式设置用户角色（对应 `user.roles = [...]`） */
  async setRoles(userId: number, roleIds: number[]) {
    await this.db.delete(user_roles).where(eq(user_roles.user_id, userId))
    if (roleIds.length > 0) {
      await this.db.insert(user_roles).values(roleIds.map((roleId) => ({ user_id: userId, role_id: roleId })))
    }
  }

  async listRolesByIds(ids: number[]): Promise<Role[]> {
    if (ids.length === 0) return []
    return this.db.select().from(roles).where(inArray(roles.id, ids))
  }

  async listRolesByCodes(codes: string[]): Promise<Role[]> {
    if (codes.length === 0) return []
    return this.db.select().from(roles).where(inArray(roles.code, codes))
  }

  async getRoleByCode(code: string) {
    const [row] = await this.db.select().from(roles).where(eq(roles.code, code)).limit(1)
    return row ?? null
  }

  /** 除 userId 外拥有该角色的用户数 */
  async countOtherUsersWithRole(roleId: number, userId: number) {
    const [row] = await this.db
      .select({ n: count() })
      .from(user_roles)
      .where(and(eq(user_roles.role_id, roleId), ne(user_roles.user_id, userId)))
    return row?.n ?? 0
  }
}
