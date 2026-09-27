/**
 * List page routes
 *
 * Routes with an id check permissions first (403), then load the record (404), so a caller without permission can't tell whether an id exists.
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { currentUsername, hasMenuPermission, loginRequired } from '@/common/auth'
import { getUploadedFile, intParam, parseIntParam, queryString } from '@/common/http'
import { parsePagination } from '@/common/pagination'
import { sendTable } from '@/common/tabular'
import { parseBody, parsePatch } from '@/common/validation'
import { listPageBody, listPageExportBody, previewBody } from './schema'
import { listFilters, ListPageService } from './service'

const BASE = '/api/admin/component-center/list-page'

type IdParams = { item_id: string }

/** The list's filters from the query string */
function queryFilters(request: FastifyRequest) {
  const q = (key: string) => queryString(request, key)
  return { search: q('search'), category: q('category'), owner: q('owner'), is_active: q('is_active'), status: q('status') }
}

export async function registerListPageRoutes(app: FastifyInstance): Promise<void> {
  const service = new ListPageService(app.db)
  const opts = { preHandler: loginRequired }

  app.get(BASE, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'cc_admin_list'))) {
      return reply.status(403).send({ error: '无权限查看列表页数据' })
    }
    const { page, per_page } = parsePagination(request.query as Record<string, unknown>)
    return service.listItems(page, per_page, listFilters(queryFilters(request)))
  })

  app.post(BASE, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'cc_admin_list_add'))) {
      return reply.status(403).send({ error: '无权限新增记录' })
    }
    return reply.status(201).send(await service.createItem(parseBody(listPageBody, request.body)))
  })

  const detailPath = `${BASE}/${intParam('item_id')}`

  app.get(detailPath, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'cc_admin_list'))) {
      return reply.status(403).send({ error: '无权限查看记录详情' })
    }
    const item = await service.getOr404(parseIntParam((request.params as IdParams).item_id))
    return service.toDict(item)
  })

  app.put(detailPath, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'cc_admin_list_edit'))) {
      return reply.status(403).send({ error: '无权限编辑记录' })
    }
    const item = await service.getOr404(parseIntParam((request.params as IdParams).item_id))
    return service.updateItem(item, parsePatch(listPageBody, request.body))
  })

  app.delete(detailPath, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'cc_admin_list_delete'))) {
      return reply.status(403).send({ error: '无权限删除记录' })
    }
    const item = await service.getOr404(parseIntParam((request.params as IdParams).item_id))
    return service.deleteItem(item)
  })

  const exportHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(await hasMenuPermission(request, 'cc_admin_list_export'))) {
      return reply.status(403).send({ error: '无权限导出数据' })
    }
    // GET exports every row matching the list's query parameters (`fields` comma-separated)
    const body =
      request.method === 'GET'
        ? {
            fields: queryString(request, 'fields').split(',').map((f) => f.trim()).filter(Boolean),
            export_mode: 'filtered',
            filters: queryFilters(request),
            file_type: queryString(request, 'file_type'),
          }
        : request.body
    return sendTable(reply, await service.exportItems(parseBody(listPageExportBody, body)))
  }
  app.get(`${BASE}/export`, opts, exportHandler)
  app.post(`${BASE}/export`, opts, exportHandler)

  app.get(`${BASE}/template`, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'cc_admin_list_import'))) {
      return reply.status(403).send({ error: '无权限下载导入模板' })
    }
    return sendTable(reply, await service.downloadTemplate(queryString(request, 'file_type')))
  })

  app.post(`${BASE}/import`, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'cc_admin_list_import'))) {
      return reply.status(403).send({ error: '无权限导入数据' })
    }
    return service.importItems(await getUploadedFile(request))
  })

  app.post(`${BASE}/run-preview`, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'cc_admin_list'))) {
      return reply.status(403).send({ error: '无权限执行数据预览' })
    }
    return service.runPreview(parseBody(previewBody, request.body))
  })

  app.get(`${BASE}/${intParam('item_id')}/versions`, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'cc_admin_list'))) {
      return reply.status(403).send({ error: '无权限查看版本历史' })
    }
    const item = await service.getOr404(parseIntParam((request.params as IdParams).item_id))
    const { page, per_page } = parsePagination(request.query as Record<string, unknown>)
    return service.listVersions(item, page, per_page)
  })

  app.post(
    `${BASE}/${intParam('item_id')}/versions/${intParam('version_id')}/rollback`,
    opts,
    async (request, reply) => {
      if (!(await hasMenuPermission(request, 'cc_admin_list_edit'))) {
        return reply.status(403).send({ error: '无权限回滚版本' })
      }
      const params = request.params as IdParams & { version_id: string }
      const item = await service.getOr404(parseIntParam(params.item_id))
      const versionItem = await service.getVersionOr404(parseIntParam(params.version_id))
      const operator = (await currentUsername(request)) || 'system'
      return service.rollbackVersion(item, versionItem, operator)
    },
  )
}
