/**
 * Visual modeler routes: /api/admin/modeler/*. Only registered in development (config.modelerEnabled) — generating
 * writes code into the repository and runs migrations — and only super admins may use them. Generating and undoing
 * need a recent identity check; API tokens are refused (common/api-token.ts).
 *
 *   GET  /meta                  field types, parent menus, dictionaries, AI configured, running job
 *   POST /validate              { spec } → { errors }
 *   POST /jobs                  { spec } → start generating (JobState)
 *   GET  /jobs/:id?offset=N     { job, log: { text, offset } } — the page polls this while a job runs
 *   GET  /history               generated modules and recent jobs
 *   POST /modules/:name/undo    start removing a generated module
 *   POST /ai/suggest            { description } → { spec, errors }
 *   POST /ai/translate          { texts } → { items: [{ zh, en, ja }] }
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { getCurrentAdminUser, loginRequired } from '@/common/auth'
import { ServiceError } from '@/common/errors'
import { jsonBody, queryString } from '@/common/http'
import { requestLanguage, translateMessage } from '@/common/i18n'
import { isSuperAdmin } from '@/common/rbac'
import { requireRecentAuth } from '@/common/session'
import type { SpecFile } from '../../../../scripts/scaffold'
import { ModelerService } from './service'

const BASE = '/api/admin/modeler'

export async function registerModelerRoutes(app: FastifyInstance): Promise<void> {
  if (!app.config.modelerEnabled) return
  const service = new ModelerService(
    app.db,
    async () => (await app.settings.get()).ai,
    () => app.config.settingsAllowPrivateNetwork || app.settings.isPinned('ai.api_base'),
  )
  app.addHook('onClose', async () => service.close())

  const superAdminOnly = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = await getCurrentAdminUser(request)
    if (!user || !isSuperAdmin(user)) return reply.status(403).send({ error: '在线建模只对超级管理员开放' })
  }
  const opts = { preHandler: [loginRequired, superAdminOnly] }
  const specOf = (request: FastifyRequest) => (jsonBody(request).spec ?? null) as SpecFile

  app.get(`${BASE}/meta`, opts, async () => service.meta())

  // Validation messages come as a list; the response hook only translates `error`
  const translated = (request: FastifyRequest, errors: string[]) => errors.map((e) => translateMessage(e, requestLanguage(request)))

  app.post(`${BASE}/validate`, opts, async (request) => ({ errors: translated(request, await service.validate(specOf(request))) }))

  app.post(`${BASE}/jobs`, opts, async (request, reply) => {
    requireRecentAuth(request)
    try {
      return reply.status(201).send(await service.generate(specOf(request)))
    } catch (err) {
      if (err instanceof ServiceError && Array.isArray(err.payload.errors)) err.payload.errors = translated(request, err.payload.errors as string[])
      throw err
    }
  })

  app.get(`${BASE}/jobs/:job_id`, opts, async (request) => {
    const offset = Number.parseInt(queryString(request, 'offset') || '0', 10)
    return service.job((request.params as { job_id: string }).job_id, Number.isFinite(offset) ? offset : 0)
  })

  app.get(`${BASE}/history`, opts, async () => service.history())

  app.post(`${BASE}/modules/:name/undo`, opts, async (request, reply) => {
    requireRecentAuth(request)
    return reply.status(201).send(service.undo((request.params as { name: string }).name))
  })

  app.post(`${BASE}/ai/suggest`, opts, async (request) => service.suggest(String(jsonBody(request).description ?? '')))

  app.post(`${BASE}/ai/translate`, opts, async (request) => {
    const texts = jsonBody(request).texts
    return service.translate(Array.isArray(texts) ? texts.map(String) : [])
  })
}
