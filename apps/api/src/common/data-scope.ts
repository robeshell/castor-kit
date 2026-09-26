/**
 * Data scope: which rows a user may see, on top of which menus / buttons they may use.
 *
 * Two steps so repositories never touch the request:
 * - routes: `const scope = await resolveDataScope(request)` (cached per request)
 * - repository: `and(otherWhere, dataScopeWhere(scope, { deptColumn: t.dept_id, ownerColumn: t.created_by }))`
 *
 * A role's roles.data_scope is one of DATA_SCOPES. With several roles the scopes are unioned; super_admin or any 'all'
 * role means unrestricted. Everything else fails closed: a restricted scope that resolves to nothing matches no rows.
 */

import { inArray, or, sql, type SQL } from 'drizzle-orm'
import type { AnyPgColumn } from 'drizzle-orm/pg-core'
import type { FastifyRequest } from 'fastify'
import type { Executor } from '@/db/client'
import { role_depts, type AdminUserWithRoles } from '@/db/schema'
import { getCurrentAdminUser } from './auth'
import { isSuperAdmin } from './rbac'
import { descendantIds } from './tree'

export const DATA_SCOPES = ['all', 'dept_and_children', 'dept', 'self', 'custom'] as const
export type DataScopeCode = (typeof DATA_SCOPES)[number]

export function isDataScopeCode(value: unknown): value is DataScopeCode {
  return typeof value === 'string' && (DATA_SCOPES as readonly string[]).includes(value)
}

export type DataScope =
  | { all: true }
  | {
      all: false
      /** Departments whose rows are visible */
      deptIds: number[]
      /** The user's own id: rows they own are visible when `self` is true */
      userId: number
      self: boolean
    }

export const UNRESTRICTED: DataScope = { all: true }

/** Nothing visible (e.g. not signed in); used when there's no user to resolve a scope for */
export const NOTHING: DataScope = { all: false, deptIds: [], userId: 0, self: false }

/** Role scopes → scope. Pure apart from the two lookups, which are only called when a role needs them */
export async function computeDataScope(
  user: AdminUserWithRoles,
  lookups: {
    /** Departments listed on the given roles (role_depts) */
    customDeptIds: (roleIds: number[]) => Promise<number[]>
    /** The given departments plus all their descendants */
    subtree: (deptIds: number[]) => Promise<number[]>
  },
): Promise<DataScope> {
  if (isSuperAdmin(user)) return UNRESTRICTED
  const scopes = new Set(user.roles.map((r) => r.data_scope))
  if (scopes.has('all')) return UNRESTRICTED

  const deptIds = new Set<number>()
  if (user.dept_id !== null) {
    if (scopes.has('dept_and_children')) (await lookups.subtree([user.dept_id])).forEach((id) => deptIds.add(id))
    else if (scopes.has('dept')) deptIds.add(user.dept_id)
  }
  const customRoleIds = user.roles.filter((r) => r.data_scope === 'custom').map((r) => r.id)
  if (customRoleIds.length > 0) (await lookups.customDeptIds(customRoleIds)).forEach((id) => deptIds.add(id))

  return { all: false, deptIds: [...deptIds].sort((a, b) => a - b), userId: user.id, self: scopes.has('self') }
}

/** Departments listed on the given roles */
async function roleDeptIds(db: Executor, roleIds: number[]): Promise<number[]> {
  const rows = await db.select({ id: role_depts.dept_id }).from(role_depts).where(inArray(role_depts.role_id, roleIds))
  return rows.map((r) => r.id)
}

/** Current user's data scope (cached on the request). Signed-out or disabled users get NOTHING */
export async function resolveDataScope(request: FastifyRequest): Promise<DataScope> {
  if (request.dataScope) return request.dataScope
  const user = await getCurrentAdminUser(request)
  const db = request.server.db
  const scope = user
    ? await computeDataScope(user, {
        customDeptIds: (roleIds) => roleDeptIds(db, roleIds),
        subtree: (deptIds) => descendantIds(db, 'departments', deptIds),
      })
    : NOTHING
  request.dataScope = scope
  return scope
}

/** Who is creating a row: stamped into created_by / dept_id by modules with data scope */
export interface Actor {
  userId: number | null
  deptId: number | null
}

export async function currentActor(request: FastifyRequest): Promise<Actor> {
  const user = await getCurrentAdminUser(request)
  return { userId: user?.id ?? null, deptId: user?.dept_id ?? null }
}

/**
 * SQL condition for a scope. `undefined` (= no filter) only for an unrestricted scope; a restricted scope with nothing
 * in it yields a condition that is always false.
 */
export function dataScopeWhere(
  scope: DataScope,
  columns: { deptColumn?: AnyPgColumn; ownerColumn?: AnyPgColumn },
): SQL | undefined {
  if (scope.all) return undefined
  const parts: SQL[] = []
  if (columns.deptColumn && scope.deptIds.length > 0) parts.push(inArray(columns.deptColumn, scope.deptIds))
  if (columns.ownerColumn && scope.self) parts.push(sql`${columns.ownerColumn} = ${scope.userId}`)
  if (parts.length === 0) return sql`false`
  return parts.length === 1 ? parts[0] : or(...parts)
}

/** Whether a department id falls inside the scope (for checks like "may this user be assigned to dept X") */
export function scopeCoversDept(scope: DataScope, deptId: number | null): boolean {
  if (scope.all) return true
  return deptId !== null && scope.deptIds.includes(deptId)
}
