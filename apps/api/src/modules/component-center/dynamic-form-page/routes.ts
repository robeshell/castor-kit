/**
 * 动态表单页路由
 *
 * 带 id 的路由先 get_or_404，再做权限检查（保持既有接口行为）。
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { hasMenuPermission, loginRequired } from '@/common/auth'
import { getUploadedFile, intParam, jsonBody, parseIntParam, queryString } from '@/common/http'
import { parsePagination } from '@/common/pagination'
import { sendTable } from '@/common/tabular'
import { parseBool } from './schema'
import { DynamicFormPageService } from './service'

const BASE = '/api/admin/component-center/dynamic-form-page'

/** request.args：每个键取第一个值 */
function queryArgs(request: FastifyRequest): Record<string, unknown> {
  const query = (request.query ?? {}) as Record<string, unknown>
  return Object.fromEntries(Object.entries(query).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]))
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
      isActive: parseBool(queryString(request, 'is_active'), null),
    })
  })

  app.post(BASE, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'system_dynamic_form_page_add'))) {
      return reply.status(403).send({ error: '无权限新增记录' })
    }
    const [payload, status] = await service.createItem(jsonBody(request))
    return reply.status(status).send(payload)
  })

  const detailPath = `${BASE}/${intParam('item_id')}`
  const loadItem = (request: FastifyRequest) =>
    service.getItemOr404(parseIntParam((request.params as { item_id: string }).item_id))

  app.get(detailPath, opts, async (request, reply) => {
    const record = await loadItem(request)
    if (!(await hasMenuPermission(request, 'system_dynamic_form_page'))) {
      return reply.status(403).send({ error: '无权限查看记录详情' })
    }
    return service.toDictWithFields(record)
  })

  app.put(detailPath, opts, async (request, reply) => {
    const item = await loadItem(request)
    if (!(await hasMenuPermission(request, 'system_dynamic_form_page_edit'))) {
      return reply.status(403).send({ error: '无权限编辑记录' })
    }
    return service.updateItem(item, jsonBody(request))
  })

  app.delete(detailPath, opts, async (request, reply) => {
    const item = await loadItem(request)
    if (!(await hasMenuPermission(request, 'system_dynamic_form_page_delete'))) {
      return reply.status(403).send({ error: '无权限删除记录' })
    }
    return service.deleteItem(item)
  })

  const exportHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(await hasMenuPermission(request, 'system_dynamic_form_page'))) {
      return reply.status(403).send({ error: '无权限导出数据' })
    }
    const payload = request.method === 'GET' ? queryArgs(request) : jsonBody(request)
    return sendTable(reply, await service.exportItems(payload, request.method))
  }
  app.get(`${BASE}/export`, opts, exportHandler)
  app.post(`${BASE}/export`, opts, exportHandler)

  app.get(`${BASE}/template`, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'system_dynamic_form_page'))) {
      return reply.status(403).send({ error: '无权限下载导入模板' })
    }
    return sendTable(reply, await service.downloadTemplate(queryString(request, 'file_type', '') || null))
  })

  app.post(`${BASE}/import`, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'system_dynamic_form_page_edit'))) {
      return reply.status(403).send({ error: '无权限导入数据' })
    }
    return service.importItems(await getUploadedFile(request))
  })
}
