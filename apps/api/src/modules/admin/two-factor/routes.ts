/**
 * Two-factor (two-step verification) module routes
 *
 * - POST /api/admin/login/two-factor: second sign-in step (session waiting in 'verify')
 * - /api/admin/two-factor/*: the signed-in user's own 2FA; setup / enable also accept a session waiting in 'setup'
 *   (a role that requires 2FA enrolls during sign-in and is signed in once enable succeeds)
 * - DELETE /api/admin/users/:id/two-factor: an admin removes someone's binding (system_users_edit, data scope)
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { getCurrentAdminUser, hasMenuPermission, loadAdminsWithRolesByIds, loginRequired } from '@/common/auth'
import { ensureCsrfToken } from '@/common/csrf'
import { resolveDataScope } from '@/common/data-scope'
import { ServiceError } from '@/common/errors'
import { intParam, jsonBody, parseIntParam } from '@/common/http'
import { authRateLimit } from '@/common/rate-limit'
import { isSuperAdmin } from '@/common/rbac'
import { getClientIp, getUserAgent } from '@/common/request-meta'
import { attachSession, createSession, isSignedIn, revokeSessions, type MfaState } from '@/common/session'
import type { AdminUserWithRoles } from '@/db/schema'
import { AuthService } from '../auth/service'
import { UserService } from '../users/service'
import { TwoFactorService } from './service'

export async function registerTwoFactorRoutes(app: FastifyInstance): Promise<void> {
  const service = new TwoFactorService(app.db, app.config.secretKey, app.settings)
  const auth = new AuthService(app.db, app.config, app.log, app.settings)
  const users = new UserService(app.db, app.settings)
  const clientOf = (request: FastifyRequest) => ({ ip: getClientIp(request), userAgent: getUserAgent(request) })

  /** The user behind a session waiting in the given sign-in step, or 401 */
  const pendingUser = async (request: FastifyRequest, state: MfaState): Promise<AdminUserWithRoles> => {
    const session = request.authSession
    if (!session || session.mfa_state !== state) throw new ServiceError('登录已失效，请重新登录', 401)
    const [user] = await loadAdminsWithRolesByIds(app.db, [session.user_id])
    if (!user || user.status !== 'active') throw new ServiceError('登录已失效，请重新登录', 401)
    return user
  }

  /** Signed in, or in the enrollment step of sign-in */
  const enrollingUser = async (request: FastifyRequest): Promise<AdminUserWithRoles> =>
    isSignedIn(request) ? (await getCurrentAdminUser(request))! : pendingUser(request, 'setup')
  const enrollGuard = async (request: FastifyRequest, reply: FastifyReply) => {
    if (!isSignedIn(request) && request.authSession?.mfa_state !== 'setup') {
      return reply.status(401).send({ error: '未登录' })
    }
  }

  /** Second step passed: replace the pending session with a signed-in one (new id, new CSRF token) */
  const completeSignIn = async (request: FastifyRequest, user: AdminUserWithRoles) => {
    const client = clientOf(request)
    const payload = await auth.finishSignIn(user, client)
    await revokeSessions(app.db, { id: request.authSession!.id })
    const sid = await createSession(app.db, user.id, client, { ttlHours: (await app.settings.get()).sessionTtlHours })
    attachSession(request, { id: sid })
    return { ...payload, csrf_token: ensureCsrfToken(request.session) }
  }

  app.post('/api/admin/login/two-factor', { onRequest: authRateLimit(app) }, async (request) => {
    const user = await pendingUser(request, 'verify')
    const client = clientOf(request)
    await auth.assertNotBlocked(user.username, client.ip)
    if (!(await service.verify(user.id, jsonBody(request)))) {
      await auth.recordSecondFactorFailure(user, client)
      throw new ServiceError('验证码错误', 400)
    }
    return completeSignIn(request, user)
  })

  app.get('/api/admin/two-factor', { preHandler: loginRequired }, async (request) => {
    return service.status((await getCurrentAdminUser(request))!)
  })

  app.post('/api/admin/two-factor/setup', { preHandler: enrollGuard }, async (request) => {
    return service.startSetup((await enrollingUser(request)).id)
  })

  app.post('/api/admin/two-factor/enable', { preHandler: enrollGuard, onRequest: authRateLimit(app) }, async (request) => {
    const user = await enrollingUser(request)
    const { recovery_codes } = await service.enable(user.id, jsonBody(request))
    if (isSignedIn(request)) return { message: '两步验证已开启', recovery_codes }
    return { ...(await completeSignIn(request, user)), recovery_codes }
  })

  app.post('/api/admin/two-factor/disable', { preHandler: loginRequired }, async (request) => {
    return service.disable((await getCurrentAdminUser(request))!, jsonBody(request))
  })

  app.post('/api/admin/two-factor/recovery-codes', { preHandler: loginRequired }, async (request) => {
    return service.regenerateRecoveryCodes((await getCurrentAdminUser(request))!.id, jsonBody(request))
  })

  app.delete(`/api/admin/users/${intParam('user_id')}/two-factor`, { preHandler: loginRequired }, async (request, reply) => {
    const target = await users.getUserOr404(parseIntParam((request.params as { user_id: string }).user_id), await resolveDataScope(request))
    if (!(await hasMenuPermission(request, 'system_users_edit'))) {
      return reply.status(403).send({ error: '无权限编辑用户' })
    }
    const caller = (await getCurrentAdminUser(request))!
    if (isSuperAdmin(target) && !isSuperAdmin(caller)) throw new ServiceError('只有超级管理员可以操作超级管理员账号', 403)
    return service.reset(target.id)
  })
}
