/**
 * routes layer template → apps/api/src/modules/<domain>/<resource>/routes.ts
 *
 * TODO: replace <Resource> with the type name (PascalCase), <resource> with the resource name (URLs use hyphenated plural, e.g. customer-orders)
 * TODO: replace <domain_resource> with the permission code prefix (e.g. system_customer; the component_center domain uses the cc_ prefix)
 * TODO: register in apps/api/src/modules/<domain>/router.ts:
 *         import { register<Resource>Routes } from './<resource>/routes'
 *         await register<Resource>Routes(app)
 *
 * Permission codes: <domain_resource> (view), <domain_resource>_add, <domain_resource>_edit,
 *          <domain_resource>_delete, <domain_resource>_export, <domain_resource>_import (import and its template)
 * Conventions:
 * - Permission checks are always imported from common/auth (never define a custom hasPermission here)
 * - No raw SQL here (go through service → repository)
 * - Routes with an id check permissions (403) first, then getOr404 (404): a caller without permission can't probe ids
 * - JSON bodies are declared with routeBody(schema, 'create' | 'patch' | 'array'): `.route` goes into the route options
 *   (the OpenAPI check compares the schema with the documented requestBody), `.parse(request)` runs after the permission check
 * - Business errors are thrown by the service as ServiceError; the global error handler turns them into { error, ...payload }
 */

import type { FastifyInstance } from 'fastify'
import { hasMenuPermission, loginRequired } from '@/common/auth'
import { getUploadedFile, intParam, parseIntParam, queryString } from '@/common/http'
import { parsePagination } from '@/common/pagination'
import { sendTable } from '@/common/tabular'
import { routeBody } from '@/common/validation'
import { declareEvents } from '@/common/webhooks'
import { <resource>Body, <resource>ExportBody } from './schema'
import { <Resource>Service } from './service'

const BASE = '/api/admin/<resource>s'

// Webhook events this module emits (offered on the webhooks page)
declareEvents({ '<resource>.created': '<资源> 已新增', '<resource>.updated': '<资源> 已修改', '<resource>.deleted': '<资源> 已删除' })

export async function register<Resource>Routes(app: FastifyInstance): Promise<void> {
  const service = new <Resource>Service(app.db, app.events)
  const opts = { preHandler: loginRequired }
  const itemPath = `${BASE}/${intParam('item_id')}`
  const itemId = (params: unknown) => parseIntParam((params as { item_id: string }).item_id)

  app.get(BASE, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, '<domain_resource>'))) {
      return reply.status(403).send({ error: '无权限' })
    }
    const { page, per_page } = parsePagination(request.query as Record<string, unknown>)
    // TODO: read the list filters the page sends and pass them down (see filterWhere in repository.ts), e.g.
    // const filters = { status: queryString(request, 'status').trim() }; document them as query parameters in the OpenAPI doc
    return service.listItems(page, per_page, queryString(request, 'search').trim())
  })

  const create = routeBody(<resource>Body, 'create')
  app.post(BASE, { ...opts, ...create.route }, async (request, reply) => {
    if (!(await hasMenuPermission(request, '<domain_resource>_add'))) {
      return reply.status(403).send({ error: '无权限新建' })
    }
    return reply.status(201).send(await service.createItem(create.parse(request)))
  })

  app.get(itemPath, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, '<domain_resource>'))) {
      return reply.status(403).send({ error: '无权限' })
    }
    const item = await service.getOr404(itemId(request.params))
    return service.getItem(item)
  })

  const update = routeBody(<resource>Body, 'patch')
  app.put(itemPath, { ...opts, ...update.route }, async (request, reply) => {
    if (!(await hasMenuPermission(request, '<domain_resource>_edit'))) {
      return reply.status(403).send({ error: '无权限编辑' })
    }
    const item = await service.getOr404(itemId(request.params))
    return service.updateItem(item, update.parse(request))
  })

  app.delete(itemPath, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, '<domain_resource>_delete'))) {
      return reply.status(403).send({ error: '无权限删除' })
    }
    const item = await service.getOr404(itemId(request.params))
    return service.deleteItem(item)
  })

  const exportRequest = routeBody(<resource>ExportBody, 'create')
  app.post(`${BASE}/export`, { ...opts, ...exportRequest.route }, async (request, reply) => {
    if (!(await hasMenuPermission(request, '<domain_resource>_export'))) {
      return reply.status(403).send({ error: '无权限导出' })
    }
    return sendTable(reply, await service.exportItems(exportRequest.parse(request)))
  })

  app.get(`${BASE}/template`, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, '<domain_resource>_import'))) {
      return reply.status(403).send({ error: '无权限' })
    }
    return sendTable(reply, await service.downloadTemplate(queryString(request, 'file_type', 'xlsx')))
  })

  app.post(`${BASE}/import`, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, '<domain_resource>_import'))) {
      return reply.status(403).send({ error: '无权限导入' })
    }
    return service.importItems(await getUploadedFile(request))
  })
}
