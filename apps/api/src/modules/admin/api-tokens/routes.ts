/**
 * API tokens module routes
 *
 * - Profile: every signed-in user manages their own tokens (creating one needs a recent identity check)
 * - Security & audit → API Token: system_api_tokens lists every token in the caller's data scope,
 *   system_api_tokens_revoke revokes
 * None of these accept an API token themselves (common/api-token.ts API_TOKEN_DENIED).
 */

import type { FastifyInstance, FastifyRequest } from 'fastify'
import { getCurrentAdminUser, hasMenuPermission, loadAdminsWithRolesByIds, loginRequired } from '@/common/auth'
import { resolveDataScope } from '@/common/data-scope'
import { intParam, jsonBody, parseIntParam, queryString } from '@/common/http'
import { parsePagination } from '@/common/pagination'
import { requireRecentAuth } from '@/common/session'
import { ApiTokenService } from './service'

const STATUSES = ['active', 'expired', 'revoked'] as const

export async function registerApiTokenRoutes(app: FastifyInstance): Promise<void> {
  const service = new ApiTokenService(app.db, app.settings)
  const opts = { preHandler: loginRequired }
  const me = async (request: FastifyRequest) => (await getCurrentAdminUser(request))!
  const idOf = (request: FastifyRequest) => parseIntParam((request.params as { token_id: string }).token_id)

  app.get('/api/admin/profile/api-tokens', opts, async (request) => service.listOwn(await me(request)))

  app.get('/api/admin/profile/api-tokens/scopes', opts, async (request) => service.scopeOptions(await me(request)))

  app.post('/api/admin/profile/api-tokens', opts, async (request) => {
    // A token is a long-lived credential: minting one needs the password (and 2FA code) again
    requireRecentAuth(request)
    return service.create(await me(request), jsonBody(request))
  })

  app.delete(`/api/admin/profile/api-tokens/${intParam('token_id')}`, opts, async (request) => {
    return service.revokeOwn(await me(request), idOf(request))
  })

  app.get('/api/admin/api-tokens', opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'system_api_tokens'))) {
      return reply.status(403).send({ error: '无权限查看 API Token' })
    }
    const { page, per_page } = parsePagination(request.query as Record<string, unknown>)
    const status = queryString(request, 'status').trim()
    return service.list(
      page,
      per_page,
      {
        search: queryString(request, 'search').trim(),
        status: (STATUSES as readonly string[]).includes(status) ? (status as (typeof STATUSES)[number]) : '',
      },
      await resolveDataScope(request),
    )
  })

  app.delete(`/api/admin/api-tokens/${intParam('token_id')}`, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'system_api_tokens_revoke'))) {
      return reply.status(403).send({ error: '无权限吊销 API Token' })
    }
    return service.revoke(idOf(request), await resolveDataScope(request), await me(request), async (id) => {
      const [user] = await loadAdminsWithRolesByIds(app.db, [id])
      return user ?? null
    })
  })
}
