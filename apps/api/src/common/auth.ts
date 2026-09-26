/**
 * Authentication and authorization
 *
 * Permission checks in routes must always be imported from here; never define a custom hasPermission inside a module.
 */

import { eq, inArray, type SQL } from 'drizzle-orm'
import type { FastifyReply, FastifyRequest, preHandlerAsyncHookHandler } from 'fastify'
import type { Executor } from '@/db/client'
import { admin_users, type AdminUserWithRoles } from '@/db/schema'
import { userHasMenuCode } from './rbac'
import { clearSession, isSignedIn } from './session'

const LOGIN_PAGE = '/admin/login'

function isApiRequest(request: FastifyRequest): boolean {
  return request.url.startsWith('/api/')
}

/**
 * Login-required preHandler.
 *
 * Besides the session flag, the account must still exist and be active: a disabled (or deleted) user's session is
 * cleared here, so it ends on their next request. The user is cached on the request, so later permission checks
 * don't query again.
 */
export const loginRequired: preHandlerAsyncHookHandler = async (request, reply) => {
  if (!isSignedIn(request) || !(await getCurrentAdminUser(request))) {
    endSession(request)
    if (isApiRequest(request)) {
      return reply.status(401).send({ error: '未授权访问', redirect: LOGIN_PAGE })
    }
    return reply.redirect(LOGIN_PAGE)
  }
}

/**
 * Drop a stale session (no-op when there is none). A session in a sign-in step (2FA) is kept: the sign-in page may
 * call a protected endpoint meanwhile, and that must not throw the user back to the password step.
 */
function endSession(request: FastifyRequest): void {
  if (request.apiToken) return
  if (request.session.get('sid') && !request.authSession?.mfa_state) clearSession(request)
}

const WITH_ROLES_MENUS = {
  user_roles: {
    with: {
      role: {
        with: {
          role_menus: { with: { menu: true } },
        },
      },
    },
  },
} as const

type AdminRowWithRelations = NonNullable<Awaited<ReturnType<typeof findAdminRow>>>
async function findAdminRow(db: Executor, where: SQL) {
  return db.query.admin_users.findFirst({ where, with: WITH_ROLES_MENUS })
}

function flattenAdmin(row: AdminRowWithRelations): AdminUserWithRoles {
  const { user_roles: userRoles, ...user } = row
  return {
    ...user,
    roles: userRoles
      .map(({ role }) => {
        const { role_menus: roleMenus, ...rest } = role
        return { ...rest, menus: roleMenus.map((rm) => rm.menu) }
      })
      .sort((a, b) => a.id - b.id),
  }
}

/**
 * Load a user by username, eager-loading roles → menus in a single query
 */
export async function loadAdminWithRoles(db: Executor, username: string): Promise<AdminUserWithRoles | null> {
  const row = await findAdminRow(db, eq(admin_users.username, username))
  return row ? flattenAdmin(row) : null
}

/** Batch-load by id (eager-loading roles → menus); results follow the order of ids, missing ids are skipped */
export async function loadAdminsWithRolesByIds(db: Executor, ids: number[]): Promise<AdminUserWithRoles[]> {
  if (ids.length === 0) return []
  const rows = await db.query.admin_users.findMany({ where: inArray(admin_users.id, ids), with: WITH_ROLES_MENUS })
  const byId = new Map(rows.map((r) => [r.id, flattenAdmin(r)]))
  return ids.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []))
}

/**
 * Current logged-in user (cached per request to avoid N+1 in permission checks).
 * Disabled accounts count as signed out: null here, so every permission check fails for them too.
 */
export async function getCurrentAdminUser(request: FastifyRequest): Promise<AdminUserWithRoles | null> {
  if (request.currentAdminUser !== undefined) return request.currentAdminUser

  // An API token acts as its creator; a session in a sign-in step (2FA) isn't signed in yet
  const session = request.authSession
  const userId = request.apiToken ? request.apiToken.created_by : session && !session.mfa_state ? session.user_id : null
  const [user] = userId !== null ? await loadAdminsWithRolesByIds(request.server.db, [userId]) : []
  request.currentAdminUser = user && user.status === 'active' ? user : null
  return request.currentAdminUser
}

/** Username of the signed-in user (undefined when signed out) */
export async function currentUsername(request: FastifyRequest): Promise<string | undefined> {
  return (await getCurrentAdminUser(request))?.username
}

/**
 * Whether the current user holds a menu / button permission. With an API token the code must also be one of the
 * token's scopes — checked first, so a super admin's token is limited to what it was granted too.
 */
export async function hasMenuPermission(request: FastifyRequest, menuCode: string): Promise<boolean> {
  if (request.apiToken && !request.apiToken.scopes.includes(menuCode)) return false
  const user = await getCurrentAdminUser(request)
  return Boolean(user && userHasMenuCode(user, menuCode))
}

export async function hasAnyMenuPermission(request: FastifyRequest, ...menuCodes: string[]): Promise<boolean> {
  for (const code of menuCodes) {
    if (code && (await hasMenuPermission(request, code))) return true
  }
  return false
}

/** Menu permission preHandler (by menu code) */
export function menuPermissionRequired(menuCode: string): preHandlerAsyncHookHandler {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const api = isApiRequest(request)
    if (!isSignedIn(request)) {
      return api ? reply.status(401).send({ error: '未登录' }) : reply.redirect(LOGIN_PAGE)
    }
    const user = await getCurrentAdminUser(request)
    if (!user) {
      endSession(request)
      return api ? reply.status(401).send({ error: '登录已失效，请重新登录' }) : reply.redirect(LOGIN_PAGE)
    }
    if (!userHasMenuCode(user, menuCode)) {
      return reply.status(403).send({ error: api ? `缺少权限: ${menuCode}` : '无权限' })
    }
  }
}
