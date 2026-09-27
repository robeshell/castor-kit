/**
 * AI prompt workshop routes
 *
 * Check order (preserves existing API behavior): permission check first (403), then template lookup (404 `模板不存在`).
 */

import type { FastifyInstance } from 'fastify'
import { hasMenuPermission, loginRequired } from '@/common/auth'
import { intParam } from '@/common/http'
import { parseBody, parsePatch } from '@/common/validation'
import { previewBody, templateBody } from './schema'
import { AiPromptService } from './service'

const BASE = '/api/admin/component-center/ai/prompt'

type IdParams = { template_id: string }

export async function registerAiPromptRoutes(app: FastifyInstance): Promise<void> {
  const service = new AiPromptService(app.db)
  const opts = { preHandler: loginRequired }

  app.get(`${BASE}/templates`, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'cc_ai_prompt'))) {
      return reply.status(403).send({ error: '无权限' })
    }
    const raw = (request.query as Record<string, unknown> | undefined)?.category
    const first = Array.isArray(raw) ? raw[0] : raw
    const category = typeof first === 'string' ? first.trim() : ''
    return service.listTemplates(category)
  })

  app.post(`${BASE}/templates`, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'cc_ai_prompt_add'))) {
      return reply.status(403).send({ error: '无权限新建模板' })
    }
    return reply.status(201).send(await service.createTemplate(parseBody(templateBody, request.body)))
  })

  app.put(`${BASE}/templates/${intParam('template_id')}`, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'cc_ai_prompt_edit'))) {
      return reply.status(403).send({ error: '无权限编辑模板' })
    }
    const template = await service.getTemplate((request.params as IdParams).template_id)
    if (!template) return reply.status(404).send({ error: '模板不存在' })
    return service.updateTemplate(template, parsePatch(templateBody, request.body))
  })

  app.delete(`${BASE}/templates/${intParam('template_id')}`, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'cc_ai_prompt_delete'))) {
      return reply.status(403).send({ error: '无权限删除模板' })
    }
    const template = await service.getTemplate((request.params as IdParams).template_id)
    if (!template) return reply.status(404).send({ error: '模板不存在' })
    return service.deleteTemplate(template)
  })

  app.post(`${BASE}/preview`, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'cc_ai_prompt'))) {
      return reply.status(403).send({ error: '无权限' })
    }
    return service.preview(parseBody(previewBody, request.body))
  })
}
