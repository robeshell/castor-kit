/**
 * Sessions module routes
 *
 * - Online users: system_sessions to list (within the caller's data scope), system_sessions_revoke to force a sign-out
 * - Profile: every signed-in user sees and signs out their own other devices
 */

import type { FastifyInstance, FastifyRequest } from 'fastify'
import { getCurrentAdminUser, hasMenuPermission, loginRequired } from '@/common/auth'
import { resolveDataScope, UNRESTRICTED } from '@/common/data-scope'
import { parsePagination } from '@/common/pagination'
import { isSuperAdmin } from '@/common/rbac'
import { queryString } from '@/common/http'
import { SessionService, type SessionCaller } from './service'

type KeyParams = { key: string }

export async function registerSessionRoutes(app: FastifyInstance): Promise<void> {
  const service = new SessionService(app.db)
  const opts = { preHandler: loginRequired }
  const callerOf = async (request: FastifyRequest): Promise<SessionCaller> => {
    const user = (await getCurrentAdminUser(request))!
    return { userId: user.id, superAdmin: isSuperAdmin(user), currentSessionId: request.authSession!.id }
  }

  app.get('/api/admin/sessions', opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'system_sessions'))) {
      return reply.status(403).send({ error: '无权限查看在线用户' })
    }
    const { page, per_page } = parsePagination(request.query as Record<string, unknown>)
    return service.list(
      page,
      per_page,
      { search: queryString(request, 'search').trim() },
      await resolveDataScope(request),
      request.authSession!.id,
    )
  })

  app.delete<{ Params: KeyParams }>('/api/admin/sessions/:key', opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'system_sessions_revoke'))) {
      return reply.status(403).send({ error: '无权限强制下线' })
    }
    return service.revoke(request.params.key, await callerOf(request), await resolveDataScope(request))
  })

  app.get('/api/admin/profile/sessions', opts, async (request) => {
    const caller = await callerOf(request)
    const { page, per_page } = parsePagination(request.query as Record<string, unknown>)
    return service.list(page, per_page, { search: '', userId: caller.userId }, UNRESTRICTED, caller.currentSessionId)
  })

  app.delete<{ Params: KeyParams }>('/api/admin/profile/sessions/:key', opts, async (request) => {
    return service.revoke(request.params.key, await callerOf(request), UNRESTRICTED, true)
  })

  app.post('/api/admin/profile/sessions/revoke-others', opts, async (request) => {
    return service.revokeOthers(await callerOf(request))
  })
}
