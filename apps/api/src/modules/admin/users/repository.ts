/**
 * Users module repository layer
 */

import { and, asc, count, desc, eq, ilike, inArray, ne, or, sql, type SQL } from 'drizzle-orm'
import { loadAdminsWithRolesByIds } from '@/common/auth'
import { dataScopeWhere, UNRESTRICTED, type DataScope } from '@/common/data-scope'
import { clearFileRefs, syncFileRefs } from '@/common/file-refs'
import { revokeSessions } from '@/common/session'
import { descendantIds } from '@/common/tree'
import type { Executor } from '@/db/client'
import { admin_users, departments, roles, user_roles, type Department, type Role } from '@/db/schema'
import type { ProfileValues, UserStatus } from './schema'

export interface UserFilters {
  search: string
  /** '' = all */
  status: string
  /** Department filter (already expanded to its subtree); null = no filter */
  deptIds?: number[] | null
}

export class UserRepository {
  constructor(private readonly db: Executor) {}

  /** Rows the scope may see: the user's department, or the user themselves */
  private scopeWhere(scope: DataScope): SQL | undefined {
    return dataScopeWhere(scope, { deptColumn: admin_users.dept_id, ownerColumn: admin_users.id })
  }

  private searchWhere({ search, status, deptIds }: UserFilters, scope: DataScope): SQL | undefined {
    const pattern = `%${search}%`
    return and(
      this.scopeWhere(scope),
      deptIds ? (deptIds.length > 0 ? inArray(admin_users.dept_id, deptIds) : sql`false`) : undefined,
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

  async listPage(page: number, perPage: number, filters: UserFilters, scope: DataScope) {
    const where = this.searchWhere(filters, scope)
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

  async listAllOrdered(filters: UserFilters, scope: DataScope) {
    const rows = await this.db
      .select({ id: admin_users.id })
      .from(admin_users)
      .where(this.searchWhere(filters, scope))
      .orderBy(asc(admin_users.id))
    return loadAdminsWithRolesByIds(this.db, rows.map((r) => r.id))
  }

  async listByIdsOrdered(ids: number[], scope: DataScope) {
    if (ids.length === 0) return []
    const rows = await this.db
      .select({ id: admin_users.id })
      .from(admin_users)
      .where(and(inArray(admin_users.id, ids), this.scopeWhere(scope)))
      .orderBy(asc(admin_users.id))
    return loadAdminsWithRolesByIds(this.db, rows.map((r) => r.id))
  }

  /** A user by id, only if the scope may see them (unrestricted by default, for re-reads after writes) */
  async getWithRoles(id: number, scope: DataScope = UNRESTRICTED) {
    if (!scope.all) {
      const [visible] = await this.db
        .select({ id: admin_users.id })
        .from(admin_users)
        .where(and(eq(admin_users.id, id), this.scopeWhere(scope)))
        .limit(1)
      if (!visible) return null
    }
    const [user] = await loadAdminsWithRolesByIds(this.db, [id])
    return user ?? null
  }

  /** Whether an existing user (looked up without scope, e.g. by username on import) is inside the scope */
  async isInScope(id: number, scope: DataScope): Promise<boolean> {
    return (await this.getWithRoles(id, scope)) !== null
  }

  // ---- departments (lookups for the dept column / filter) ----

  async getDeptById(id: number): Promise<Department | null> {
    const [row] = await this.db.select().from(departments).where(eq(departments.id, id)).limit(1)
    return row ?? null
  }

  async getDeptByCode(code: string): Promise<Department | null> {
    const [row] = await this.db.select().from(departments).where(eq(departments.code, code)).limit(1)
    return row ?? null
  }

  async deptNames(ids: number[]): Promise<Map<number, string>> {
    if (ids.length === 0) return new Map()
    const rows = await this.db.select({ id: departments.id, name: departments.name }).from(departments).where(inArray(departments.id, ids))
    return new Map(rows.map((r) => [r.id, r.name]))
  }

  deptSubtree(rootId: number): Promise<number[]> {
    return descendantIds(this.db, 'departments', [rootId])
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

  async insert(username: string, passwordHash: string, profile: ProfileValues = {}, status?: UserStatus, deptId?: number | null) {
    const [row] = await this.db
      .insert(admin_users)
      .values({ username, password_hash: passwordHash, ...profile, ...(status ? { status } : {}), ...(deptId !== undefined ? { dept_id: deptId } : {}) })
      .returning()
    await this.syncAvatarRef(row!.id, profile)
    return row!
  }

  /** Set by an admin (edit / import): the user's existing sessions end, they sign in with the new password */
  async updatePasswordHash(id: number, passwordHash: string) {
    await this.db.update(admin_users).set({ password_hash: passwordHash }).where(eq(admin_users.id, id))
    await revokeSessions(this.db, { userId: id })
  }

  async updateProfile(id: number, profile: ProfileValues) {
    if (Object.keys(profile).length === 0) return
    await this.db.update(admin_users).set(profile).where(eq(admin_users.id, id))
    await this.syncAvatarRef(id, profile)
  }

  /** An avatar uploaded to the file center (/api/admin/files/<id>) is registered as a reference so it isn't cleaned up */
  private async syncAvatarRef(id: number, profile: ProfileValues) {
    if ('avatar' in profile) await syncFileRefs(this.db, 'admin_users', id, { avatar: profile.avatar })
  }

  async setDept(id: number, deptId: number | null) {
    await this.db.update(admin_users).set({ dept_id: deptId }).where(eq(admin_users.id, id))
  }

  async setStatus(id: number, status: UserStatus) {
    await this.db.update(admin_users).set({ status }).where(eq(admin_users.id, id))
    if (status === 'disabled') await revokeSessions(this.db, { userId: id })
  }

  async delete(id: number) {
    await clearFileRefs(this.db, 'admin_users', id)
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
