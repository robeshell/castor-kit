/**
 * Tree list page routes
 *
 * Routes with an id run get_or_404 first, then check permissions (preserves existing API behavior).
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { hasMenuPermission, loginRequired } from '@/common/auth'
import { getUploadedFile, intParam, jsonBody, parseIntParam, queryString } from '@/common/http'
import { parsePagination } from '@/common/pagination'
import { sendTable } from '@/common/tabular'
import type { TreeListFilters } from './repository'
import { parseBool, tryInt } from './schema'
import { TreeListPageService } from './service'

const BASE = '/api/admin/component-center/tree-list-page'

/** request.args: take the first value of each key */
function queryArgs(request: FastifyRequest): Record<string, unknown> {
  const query = (request.query ?? {}) as Record<string, unknown>
  return Object.fromEntries(Object.entries(query).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]))
}

function listFilters(request: FastifyRequest): TreeListFilters {
  return {
    search: queryString(request, 'search').trim(),
    nodeType: queryString(request, 'node_type').trim(),
    status: queryString(request, 'status').trim(),
    owner: queryString(request, 'owner').trim(),
    isActive: parseBool(queryString(request, 'is_active'), null),
  }
}

export async function registerTreeListPageRoutes(app: FastifyInstance): Promise<void> {
  const service = new TreeListPageService(app.db)
  const opts = { preHandler: loginRequired }

  // Tree structure (for the Tree component on the left)
  app.get(`${BASE}/tree`, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'system_tree_list_page'))) {
      return reply.status(403).send({ error: '无权限查看树形数据' })
    }
    return service.getTree(listFilters(request))
  })

  // Flat list (for the table on the right)
  app.get(BASE, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'system_tree_list_page'))) {
      return reply.status(403).send({ error: '无权限查看树形列表页数据' })
    }
    const { page, per_page } = parsePagination(request.query as Record<string, unknown>)
    const parentIdRaw = queryArgs(request).parent_id
    let parentId: 'root' | number | null = null
    if (parentIdRaw === 'root') parentId = 'root'
    else if (typeof parentIdRaw === 'string') parentId = tryInt(parentIdRaw)
    return service.listItems(page, per_page, listFilters(request), parentId)
  })

  app.post(BASE, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'system_tree_list_page_add'))) {
      return reply.status(403).send({ error: '无权限新增节点' })
    }
    const [payload, status] = await service.createItem(jsonBody(request))
    return reply.status(status).send(payload)
  })

  const detailPath = `${BASE}/${intParam('item_id')}`
  const loadItem = (request: FastifyRequest) =>
    service.getItemOr404(parseIntParam((request.params as { item_id: string }).item_id))

  app.get(detailPath, opts, async (request, reply) => {
    const item = await loadItem(request)
    if (!(await hasMenuPermission(request, 'system_tree_list_page'))) {
      return reply.status(403).send({ error: '无权限查看节点详情' })
    }
    return service.toDict(item)
  })

  app.put(detailPath, opts, async (request, reply) => {
    const item = await loadItem(request)
    if (!(await hasMenuPermission(request, 'system_tree_list_page_edit'))) {
      return reply.status(403).send({ error: '无权限编辑节点' })
    }
    return service.updateItem(item, jsonBody(request))
  })

  app.delete(detailPath, opts, async (request, reply) => {
    const item = await loadItem(request)
    if (!(await hasMenuPermission(request, 'system_tree_list_page_delete'))) {
      return reply.status(403).send({ error: '无权限删除节点' })
    }
    return service.deleteItem(item)
  })

  const exportHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(await hasMenuPermission(request, 'system_tree_list_page'))) {
      return reply.status(403).send({ error: '无权限导出数据' })
    }
    const payload = request.method === 'GET' ? queryArgs(request) : jsonBody(request)
    return sendTable(reply, await service.exportItems(payload, request.method))
  }
  app.get(`${BASE}/export`, opts, exportHandler)
  app.post(`${BASE}/export`, opts, exportHandler)

  app.get(`${BASE}/template`, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'system_tree_list_page'))) {
      return reply.status(403).send({ error: '无权限下载导入模板' })
    }
    return sendTable(reply, await service.downloadTemplate(queryString(request, 'file_type', '') || null))
  })

  app.post(`${BASE}/import`, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'system_tree_list_page_edit'))) {
      return reply.status(403).send({ error: '无权限导入数据' })
    }
    return service.importItems(await getUploadedFile(request))
  })
}
