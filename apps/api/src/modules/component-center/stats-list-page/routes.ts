/**
 * List page with stats routes
 *
 * Routes with an id run get_or_404 first, then check permissions (preserves existing API behavior).
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { hasMenuPermission, loginRequired } from '@/common/auth'
import { getUploadedFile, intParam, jsonBody, parseIntParam, queryString } from '@/common/http'
import { parsePagination } from '@/common/pagination'
import { sendTable } from '@/common/tabular'
import { parseBool } from './schema'
import { StatsListPageService } from './service'

const BASE = '/api/admin/component-center/stats-list-page'

/** request.args: take the first value of each key */
function queryArgs(request: FastifyRequest): Record<string, unknown> {
  const query = (request.query ?? {}) as Record<string, unknown>
  return Object.fromEntries(Object.entries(query).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]))
}

export async function registerStatsListPageRoutes(app: FastifyInstance): Promise<void> {
  const service = new StatsListPageService(app.db)
  const opts = { preHandler: loginRequired }

  app.get(`${BASE}/stats`, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'system_stats_list_page'))) {
      return reply.status(403).send({ error: '无权限查看统计数据' })
    }
    return service.getStats()
  })

  app.get(BASE, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'system_stats_list_page'))) {
      return reply.status(403).send({ error: '无权限查看数据' })
    }
    const { page, per_page } = parsePagination(request.query as Record<string, unknown>)
    return service.listItems(page, per_page, {
      search: queryString(request, 'search').trim(),
      category: queryString(request, 'category').trim(),
      owner: queryString(request, 'owner').trim(),
      isActive: parseBool(queryString(request, 'is_active'), null),
      status: queryString(request, 'status').trim(),
    })
  })

  app.post(BASE, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'system_stats_list_page_add'))) {
      return reply.status(403).send({ error: '无权限新增记录' })
    }
    const [payload, status] = await service.createItem(jsonBody(request))
    return reply.status(status).send(payload)
  })

  const detailPath = `${BASE}/${intParam('item_id')}`
  const loadItem = (request: FastifyRequest) =>
    service.getItemOr404(parseIntParam((request.params as { item_id: string }).item_id))

  app.get(detailPath, opts, async (request, reply) => {
    const item = await loadItem(request)
    if (!(await hasMenuPermission(request, 'system_stats_list_page'))) {
      return reply.status(403).send({ error: '无权限查看详情' })
    }
    return service.toDict(item)
  })

  app.put(detailPath, opts, async (request, reply) => {
    const item = await loadItem(request)
    if (!(await hasMenuPermission(request, 'system_stats_list_page_edit'))) {
      return reply.status(403).send({ error: '无权限编辑记录' })
    }
    return service.updateItem(item, jsonBody(request))
  })

  app.delete(detailPath, opts, async (request, reply) => {
    const item = await loadItem(request)
    if (!(await hasMenuPermission(request, 'system_stats_list_page_delete'))) {
      return reply.status(403).send({ error: '无权限删除记录' })
    }
    return service.deleteItem(item)
  })

  const exportHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(await hasMenuPermission(request, 'system_stats_list_page'))) {
      return reply.status(403).send({ error: '无权限导出数据' })
    }
    const payload = request.method === 'GET' ? queryArgs(request) : jsonBody(request)
    return sendTable(reply, await service.exportItems(payload, request.method))
  }
  app.get(`${BASE}/export`, opts, exportHandler)
  app.post(`${BASE}/export`, opts, exportHandler)

  app.get(`${BASE}/template`, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'system_stats_list_page'))) {
      return reply.status(403).send({ error: '无权限下载模板' })
    }
    return sendTable(reply, await service.downloadTemplate(queryString(request, 'file_type', '') || null))
  })

  app.post(`${BASE}/import`, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'system_stats_list_page_edit'))) {
      return reply.status(403).send({ error: '无权限导入数据' })
    }
    return service.importItems(await getUploadedFile(request))
  })
}
