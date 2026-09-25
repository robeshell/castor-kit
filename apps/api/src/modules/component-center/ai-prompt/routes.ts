/**
 * AI 提示词工坊路由
 *
 * 检查顺序（保持既有接口行为）：先权限检查（403），再查模板（404 `模板不存在`）。
 */

import type { FastifyInstance, FastifyReply } from 'fastify'
import { hasMenuPermission, loginRequired } from '@/common/auth'
import { intParam, jsonBody } from '@/common/http'
import { AiPromptPersistError, AiPromptService } from './service'

const BASE = '/api/admin/component-center/ai/prompt'

type IdParams = { template_id: string }

/** 保存/删除失败：原样返回带具体文案的 500 */
async function withPersistError<T>(reply: FastifyReply, fn: () => Promise<T>): Promise<T | FastifyReply> {
  try {
    return await fn()
  } catch (err) {
    if (err instanceof AiPromptPersistError) return reply.status(500).send({ error: err.message })
    throw err
  }
}

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
    return withPersistError(reply, async () => reply.status(201).send(await service.createTemplate(jsonBody(request))))
  })

  app.put(`${BASE}/templates/${intParam('template_id')}`, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'cc_ai_prompt_edit'))) {
      return reply.status(403).send({ error: '无权限编辑模板' })
    }
    const template = await service.getTemplate((request.params as IdParams).template_id)
    if (!template) return reply.status(404).send({ error: '模板不存在' })
    return withPersistError(reply, () => service.updateTemplate(template, jsonBody(request)))
  })

  app.delete(`${BASE}/templates/${intParam('template_id')}`, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'cc_ai_prompt_delete'))) {
      return reply.status(403).send({ error: '无权限删除模板' })
    }
    const template = await service.getTemplate((request.params as IdParams).template_id)
    if (!template) return reply.status(404).send({ error: '模板不存在' })
    return withPersistError(reply, () => service.deleteTemplate(template))
  })

  app.post(`${BASE}/preview`, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'cc_ai_prompt'))) {
      return reply.status(403).send({ error: '无权限' })
    }
    return service.preview(jsonBody(request))
  })
}
