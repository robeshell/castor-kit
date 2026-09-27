/**
 * List page with stats routes
 *
 * Routes with an id check permissions first (403), then load the record (404), so a caller without permission can't tell whether an id exists.
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { hasMenuPermission, loginRequired } from '@/common/auth'
import { getUploadedFile, intParam, parseIntParam, queryString } from '@/common/http'
import { parsePagination } from '@/common/pagination'
import { sendTable } from '@/common/tabular'
import { parseBody, parsePatch, parseYesNo } from '@/common/validation'
import { statsExportBody, statsItemBody } from './schema'
import { StatsListPageService } from './service'

const BASE = '/api/admin/component-center/stats-list-page'

/** GET export: the list's query parameters as an export body (every filtered row; `fields` comma-separated) */
function exportQuery(request: FastifyRequest) {
  const q = (key: string) => queryString(request, key)
  return {
    fields: q('fields').split(',').map((f) => f.trim()).filter(Boolean),
    export_mode: 'filtered',
    filters: { search: q('search'), category: q('category'), owner: q('owner'), is_active: q('is_active'), status: q('status') },
    file_type: q('file_type'),
  }
}

export async function registerStatsListPageRoutes(app: FastifyInstance): Promise<void> {
  const service = new StatsListPageService(app.db)
  const opts = { preHandler: loginRequired }

  app.get(`${BASE}/stats`, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'cc_admin_stats_list'))) {
      return reply.status(403).send({ error: '无权限查看统计数据' })
    }
    return service.getStats()
  })

  app.get(BASE, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'cc_admin_stats_list'))) {
      return reply.status(403).send({ error: '无权限查看数据' })
    }
    const { page, per_page } = parsePagination(request.query as Record<string, unknown>)
    return service.listItems(page, per_page, {
      search: queryString(request, 'search').trim(),
      category: queryString(request, 'category').trim(),
      owner: queryString(request, 'owner').trim(),
      isActive: parseYesNo(queryString(request, 'is_active')),
      status: queryString(request, 'status').trim(),
    })
  })

  app.post(BASE, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'cc_admin_stats_list_add'))) {
      return reply.status(403).send({ error: '无权限新增记录' })
    }
    const [payload, status] = await service.createItem(parseBody(statsItemBody, request.body))
    return reply.status(status).send(payload)
  })

  const detailPath = `${BASE}/${intParam('item_id')}`
  const loadItem = (request: FastifyRequest) =>
    service.getItemOr404(parseIntParam((request.params as { item_id: string }).item_id))

  app.get(detailPath, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'cc_admin_stats_list'))) {
      return reply.status(403).send({ error: '无权限查看详情' })
    }
    const item = await loadItem(request)
    return service.toDict(item)
  })

  app.put(detailPath, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'cc_admin_stats_list_edit'))) {
      return reply.status(403).send({ error: '无权限编辑记录' })
    }
    const item = await loadItem(request)
    return service.updateItem(item, parsePatch(statsItemBody, request.body))
  })

  app.delete(detailPath, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'cc_admin_stats_list_delete'))) {
      return reply.status(403).send({ error: '无权限删除记录' })
    }
    const item = await loadItem(request)
    return service.deleteItem(item)
  })

  const exportHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(await hasMenuPermission(request, 'cc_admin_stats_list_export'))) {
      return reply.status(403).send({ error: '无权限导出数据' })
    }
    const body = request.method === 'GET' ? exportQuery(request) : request.body
    return sendTable(reply, await service.exportItems(parseBody(statsExportBody, body)))
  }
  app.get(`${BASE}/export`, opts, exportHandler)
  app.post(`${BASE}/export`, opts, exportHandler)

  app.get(`${BASE}/template`, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'cc_admin_stats_list_import'))) {
      return reply.status(403).send({ error: '无权限下载模板' })
    }
    return sendTable(reply, await service.downloadTemplate(queryString(request, 'file_type', '') || null))
  })

  app.post(`${BASE}/import`, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'cc_admin_stats_list_import'))) {
      return reply.status(403).send({ error: '无权限导入数据' })
    }
    return service.importItems(await getUploadedFile(request))
  })
}
