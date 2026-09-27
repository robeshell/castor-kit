/**
 * Tree list page routes
 *
 * Routes with an id check permissions first (403), then load the record (404), so a caller without permission can't tell whether an id exists.
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { hasMenuPermission, loginRequired } from '@/common/auth'
import { getUploadedFile, intParam, parseIntParam, queryString } from '@/common/http'
import { parsePagination } from '@/common/pagination'
import { sendTable } from '@/common/tabular'
import type { TreeListFilters } from './repository'
import { parseYesNo, routeBody } from '@/common/validation'
import { treeExportBody, treeNodeBody } from './schema'
import { TreeListPageService } from './service'

const BASE = '/api/admin/component-center/tree-list-page'

/** GET export: the list's query parameters as an export body (every filtered row; `fields` comma-separated) */
function exportQuery(request: FastifyRequest) {
  const q = (key: string) => queryString(request, key)
  return {
    fields: q('fields').split(',').map((f) => f.trim()).filter(Boolean),
    export_mode: 'filtered',
    filters: { search: q('search'), node_type: q('node_type'), status: q('status'), owner: q('owner'), is_active: q('is_active') },
    file_type: q('file_type'),
  }
}

function listFilters(request: FastifyRequest): TreeListFilters {
  return {
    search: queryString(request, 'search').trim(),
    nodeType: queryString(request, 'node_type').trim(),
    status: queryString(request, 'status').trim(),
    owner: queryString(request, 'owner').trim(),
    isActive: parseYesNo(queryString(request, 'is_active')),
  }
}

export async function registerTreeListPageRoutes(app: FastifyInstance): Promise<void> {
  const service = new TreeListPageService(app.db)
  const opts = { preHandler: loginRequired }

  // Tree structure (for the Tree component on the left)
  app.get(`${BASE}/tree`, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'cc_admin_tree_list'))) {
      return reply.status(403).send({ error: '无权限查看树形数据' })
    }
    return service.getTree(listFilters(request))
  })

  // Flat list (for the table on the right)
  app.get(BASE, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'cc_admin_tree_list'))) {
      return reply.status(403).send({ error: '无权限查看树形列表页数据' })
    }
    const { page, per_page } = parsePagination(request.query as Record<string, unknown>)
    // parent_id: 'root' for top-level nodes, an id for one node's children; anything else lists every node
    const parentIdRaw = queryString(request, 'parent_id').trim()
    const parentId = parentIdRaw === 'root' ? 'root' : /^\d+$/.test(parentIdRaw) ? Number(parentIdRaw) : null
    return service.listItems(page, per_page, listFilters(request), parentId)
  })

  const treeNodeInput = routeBody(treeNodeBody, 'create')
  app.post(BASE, { ...opts, ...treeNodeInput.route }, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'cc_admin_tree_list_add'))) {
      return reply.status(403).send({ error: '无权限新增节点' })
    }
    const [payload, status] = await service.createItem(treeNodeInput.parse(request))
    return reply.status(status).send(payload)
  })

  const detailPath = `${BASE}/${intParam('item_id')}`
  const loadItem = (request: FastifyRequest) =>
    service.getItemOr404(parseIntParam((request.params as { item_id: string }).item_id))

  app.get(detailPath, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'cc_admin_tree_list'))) {
      return reply.status(403).send({ error: '无权限查看节点详情' })
    }
    const item = await loadItem(request)
    return service.toDict(item)
  })

  const treeNodePatch = routeBody(treeNodeBody, 'patch')
  app.put(detailPath, { ...opts, ...treeNodePatch.route }, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'cc_admin_tree_list_edit'))) {
      return reply.status(403).send({ error: '无权限编辑节点' })
    }
    const item = await loadItem(request)
    return service.updateItem(item, treeNodePatch.parse(request))
  })

  app.delete(detailPath, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'cc_admin_tree_list_delete'))) {
      return reply.status(403).send({ error: '无权限删除节点' })
    }
    const item = await loadItem(request)
    return service.deleteItem(item)
  })

  const treeExportInput = routeBody(treeExportBody, 'create')
  const exportHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(await hasMenuPermission(request, 'cc_admin_tree_list_export'))) {
      return reply.status(403).send({ error: '无权限导出数据' })
    }
    const body = request.method === 'GET' ? exportQuery(request) : request.body
    return sendTable(reply, await service.exportItems(treeExportInput.parse({ body })))
  }
  app.get(`${BASE}/export`, opts, exportHandler)
  app.post(`${BASE}/export`, { ...opts, ...treeExportInput.route }, exportHandler)

  app.get(`${BASE}/template`, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'cc_admin_tree_list_import'))) {
      return reply.status(403).send({ error: '无权限下载导入模板' })
    }
    return sendTable(reply, await service.downloadTemplate(queryString(request, 'file_type', '') || null))
  })

  app.post(`${BASE}/import`, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'cc_admin_tree_list_import'))) {
      return reply.status(403).send({ error: '无权限导入数据' })
    }
    return service.importItems(await getUploadedFile(request))
  })
}
