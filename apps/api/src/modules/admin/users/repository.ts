/**
 * Users module repository layer
 */

import { and, asc, count, desc, eq, ilike, inArray, ne, or, type SQL } from 'drizzle-orm'
import { loadAdminsWithRolesByIds } from '@/common/auth'
import type { Executor } from '@/db/client'
import { admin_users, roles, user_roles, type Role } from '@/db/schema'
import type { ProfileValues, UserStatus } from './schema'

export interface UserFilters {
  search: string
  /** '' = all */
  status: string
}

export class UserRepository {
  constructor(private readonly db: Executor) {}

  private searchWhere({ search, status }: UserFilters): SQL | undefined {
    const pattern = `%${search}%`
    return and(
      search
        ? or(
            ilike(admin_users.username, pattern),
            ilike(admin_users.nickname, pattern),
            ilike(admin_users.email, pattern),
            ilike(admin_users.phone, pattern),
          )
        : undefined,
      status ? eq(admin_users.status, status) : undefined,
    )
  }

  async listPage(page: number, perPage: number, filters: UserFilters) {
    const where = this.searchWhere(filters)
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

  async listAllOrdered(filters: UserFilters) {
    const rows = await this.db
      .select({ id: admin_users.id })
      .from(admin_users)
      .where(this.searchWhere(filters))
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

  /** Case-insensitive lookup; emails are stored lowercased but older rows may not be */
  async getByEmail(email: string) {
    const [row] = await this.db.select().from(admin_users).where(ilike(admin_users.email, email)).limit(1)
    return row ?? null
  }

  async insert(username: string, passwordHash: string, profile: ProfileValues = {}, status?: UserStatus) {
    const [row] = await this.db
      .insert(admin_users)
      .values({ username, password_hash: passwordHash, ...profile, ...(status ? { status } : {}) })
      .returning()
    return row!
  }

  async updatePasswordHash(id: number, passwordHash: string) {
    await this.db.update(admin_users).set({ password_hash: passwordHash }).where(eq(admin_users.id, id))
  }

  async updateProfile(id: number, profile: ProfileValues) {
    if (Object.keys(profile).length === 0) return
    await this.db.update(admin_users).set(profile).where(eq(admin_users.id, id))
  }

  async setStatus(id: number, status: UserStatus) {
    await this.db.update(admin_users).set({ status }).where(eq(admin_users.id, id))
  }

  async delete(id: number) {
    await this.db.delete(admin_users).where(eq(admin_users.id, id))
  }

  /** Replace a user's roles (like `user.roles = [...]`) */
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

  /** Number of active users other than userId that have this role (disabled accounts can't sign in, so they don't count) */
  async countOtherActiveUsersWithRole(roleId: number, userId: number) {
    const [row] = await this.db
      .select({ n: count() })
      .from(user_roles)
      .innerJoin(admin_users, eq(admin_users.id, user_roles.user_id))
      .where(and(eq(user_roles.role_id, roleId), ne(user_roles.user_id, userId), eq(admin_users.status, 'active')))
    return row?.n ?? 0
  }

  /** Number of active users that have this role */
  async countActiveUsersWithRole(roleId: number) {
    const [row] = await this.db
      .select({ n: count() })
      .from(user_roles)
      .innerJoin(admin_users, eq(admin_users.id, user_roles.user_id))
      .where(and(eq(user_roles.role_id, roleId), eq(admin_users.status, 'active')))
    return row?.n ?? 0
  }
}
