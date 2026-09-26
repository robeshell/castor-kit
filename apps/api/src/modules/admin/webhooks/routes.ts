/**
 * Webhooks module routes: system_webhooks to view (list, events, delivery records), _add / _edit / _delete to change.
 * Creating, changing and revealing or rotating the secret need a recent identity check; new receivers and address
 * changes are announced to every super admin. None of the write endpoints accept API tokens.
 */

import type { FastifyInstance, FastifyRequest } from 'fastify'
import { getCurrentAdminUser, hasMenuPermission, loginRequired } from '@/common/auth'
import { intParam, jsonBody, parseIntParam, queryString } from '@/common/http'
import { parsePagination } from '@/common/pagination'
import { requireRecentAuth } from '@/common/session'
import { WebhookService } from './service'

const STATUSES = ['pending', 'delivering', 'success', 'failed'] as const

export async function registerWebhookRoutes(app: FastifyInstance): Promise<void> {
  const service = new WebhookService(app.db, app.config, app.events, app.log)
  const opts = { preHandler: loginRequired }
  const hookOf = (request: FastifyRequest) => service.getOr404(parseIntParam((request.params as { webhook_id: string }).webhook_id))
  const actorOf = async (request: FastifyRequest) => {
    const user = (await getCurrentAdminUser(request))!
    return { id: user.id, name: user.nickname || user.username }
  }
  const BASE = '/api/admin/webhooks'
  const ONE = `${BASE}/${intParam('webhook_id')}`

  app.get(BASE, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'system_webhooks'))) return reply.status(403).send({ error: '无权限查看 Webhook' })
    return service.list()
  })

  app.get(`${BASE}/events`, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'system_webhooks'))) return reply.status(403).send({ error: '无权限查看 Webhook' })
    return service.eventOptions()
  })

  app.post(BASE, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'system_webhooks_add'))) return reply.status(403).send({ error: '无权限新增 Webhook' })
    requireRecentAuth(request)
    const actor = await actorOf(request)
    return reply.status(201).send(await service.create(jsonBody(request), actor.id, actor.name))
  })

  app.put(ONE, opts, async (request, reply) => {
    const hook = await hookOf(request)
    if (!(await hasMenuPermission(request, 'system_webhooks_edit'))) return reply.status(403).send({ error: '无权限编辑 Webhook' })
    requireRecentAuth(request)
    return service.update(hook, jsonBody(request), (await actorOf(request)).name)
  })

  app.delete(ONE, opts, async (request, reply) => {
    const hook = await hookOf(request)
    if (!(await hasMenuPermission(request, 'system_webhooks_delete'))) return reply.status(403).send({ error: '无权限删除 Webhook' })
    return service.remove(hook)
  })

  app.get(`${ONE}/secret`, opts, async (request, reply) => {
    const hook = await hookOf(request)
    if (!(await hasMenuPermission(request, 'system_webhooks_edit'))) return reply.status(403).send({ error: '无权限编辑 Webhook' })
    requireRecentAuth(request)
    return service.secret(hook)
  })

  app.post(`${ONE}/secret`, opts, async (request, reply) => {
    const hook = await hookOf(request)
    if (!(await hasMenuPermission(request, 'system_webhooks_edit'))) return reply.status(403).send({ error: '无权限编辑 Webhook' })
    requireRecentAuth(request)
    return service.rotateSecret(hook)
  })

  app.post(`${ONE}/test`, opts, async (request, reply) => {
    const hook = await hookOf(request)
    if (!(await hasMenuPermission(request, 'system_webhooks_edit'))) return reply.status(403).send({ error: '无权限编辑 Webhook' })
    return service.test(hook)
  })

  app.get(`${ONE}/deliveries`, opts, async (request, reply) => {
    const hook = await hookOf(request)
    if (!(await hasMenuPermission(request, 'system_webhooks'))) return reply.status(403).send({ error: '无权限查看 Webhook' })
    const { page, per_page } = parsePagination(request.query as Record<string, unknown>)
    const status = queryString(request, 'status').trim()
    return service.deliveries(hook, page, per_page, (STATUSES as readonly string[]).includes(status) ? (status as (typeof STATUSES)[number]) : '')
  })

  app.post(`${BASE}/deliveries/${intParam('delivery_id')}/redeliver`, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'system_webhooks_edit'))) return reply.status(403).send({ error: '无权限编辑 Webhook' })
    return service.redeliver(parseIntParam((request.params as { delivery_id: string }).delivery_id))
  })
}
