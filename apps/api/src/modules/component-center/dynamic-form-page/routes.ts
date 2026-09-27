/**
 * Dynamic form page routes
 *
 * Routes with an id check permissions first (403), then load the record (404), so a caller without permission can't tell whether an id exists.
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { hasMenuPermission, loginRequired } from '@/common/auth'
import { getUploadedFile, intParam, parseIntParam, queryString } from '@/common/http'
import { parsePagination } from '@/common/pagination'
import { sendTable } from '@/common/tabular'
import { parseBody, parsePatch, parseYesNo } from '@/common/validation'
import { dynamicFormBody, dynamicFormExportBody, dynamicFormUpdateBody } from './schema'
import { DynamicFormPageService } from './service'

const BASE = '/api/admin/component-center/dynamic-form-page'

/** GET export: the list's query parameters as an export body (every filtered row; `fields` comma-separated) */
function exportQuery(request: FastifyRequest) {
  const q = (key: string) => queryString(request, key)
  return {
    fields: q('fields').split(',').map((f) => f.trim()).filter(Boolean),
    export_mode: 'filtered',
    filters: { search: q('search'), category: q('category'), status: q('status'), owner: q('owner'), is_active: q('is_active') },
    file_type: q('file_type'),
  }
}

export async function registerDynamicFormPageRoutes(app: FastifyInstance): Promise<void> {
  const service = new DynamicFormPageService(app.db)
  const opts = { preHandler: loginRequired }

  app.get(BASE, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'system_dynamic_form_page'))) {
      return reply.status(403).send({ error: '无权限查看动态表单页数据' })
    }
    const { page, per_page } = parsePagination(request.query as Record<string, unknown>)
    return service.listItems(page, per_page, {
      search: queryString(request, 'search').trim(),
      category: queryString(request, 'category').trim(),
      status: queryString(request, 'status').trim(),
      owner: queryString(request, 'owner').trim(),
      isActive: parseYesNo(queryString(request, 'is_active')),
    })
  })

  app.post(BASE, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'system_dynamic_form_page_add'))) {
      return reply.status(403).send({ error: '无权限新增记录' })
    }
    const [payload, status] = await service.createItem(parseBody(dynamicFormBody, request.body))
    return reply.status(status).send(payload)
  })

  const detailPath = `${BASE}/${intParam('item_id')}`
  const loadItem = (request: FastifyRequest) =>
    service.getItemOr404(parseIntParam((request.params as { item_id: string }).item_id))

  app.get(detailPath, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'system_dynamic_form_page'))) {
      return reply.status(403).send({ error: '无权限查看记录详情' })
    }
    const record = await loadItem(request)
    return service.toDictWithFields(record)
  })

  app.put(detailPath, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'system_dynamic_form_page_edit'))) {
      return reply.status(403).send({ error: '无权限编辑记录' })
    }
    const item = await loadItem(request)
    return service.updateItem(item, parsePatch(dynamicFormUpdateBody, request.body))
  })

  app.delete(detailPath, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'system_dynamic_form_page_delete'))) {
      return reply.status(403).send({ error: '无权限删除记录' })
    }
    const item = await loadItem(request)
    return service.deleteItem(item)
  })

  const exportHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(await hasMenuPermission(request, 'system_dynamic_form_page_export'))) {
      return reply.status(403).send({ error: '无权限导出数据' })
    }
    const body = request.method === 'GET' ? exportQuery(request) : request.body
    return sendTable(reply, await service.exportItems(parseBody(dynamicFormExportBody, body)))
  }
  app.get(`${BASE}/export`, opts, exportHandler)
  app.post(`${BASE}/export`, opts, exportHandler)

  app.get(`${BASE}/template`, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'system_dynamic_form_page_import'))) {
      return reply.status(403).send({ error: '无权限下载导入模板' })
    }
    return sendTable(reply, await service.downloadTemplate(queryString(request, 'file_type', '') || null))
  })

  app.post(`${BASE}/import`, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'system_dynamic_form_page_import'))) {
      return reply.status(403).send({ error: '无权限导入数据' })
    }
    return service.importItems(await getUploadedFile(request))
  })
}
