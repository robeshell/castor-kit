/**
 * Advanced table page routes
 *
 * Routes with an id check permissions first (403), then load the record (404), so a caller without permission can't tell whether an id exists.
 */

import type { FastifyInstance, FastifyRequest } from 'fastify'
import { hasMenuPermission, loginRequired } from '@/common/auth'
import { intParam, parseIntParam, queryString } from '@/common/http'
import { parsePagination } from '@/common/pagination'
import { parseYesNo, routeBody } from '@/common/validation'
import { batchDeleteBody, batchUpdateBody, reorderItem, rowBody } from './schema'
import { AdvancedTableService } from './service'

const BASE = '/api/admin/component-center/advanced-table'

export async function registerAdvancedTableRoutes(app: FastifyInstance): Promise<void> {
  const service = new AdvancedTableService(app.db)
  const opts = { preHandler: loginRequired }
  const itemId = (request: FastifyRequest) => parseIntParam((request.params as { item_id: string }).item_id)

  app.get(`${BASE}/stats`, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'cc_admin_advanced_table'))) {
      return reply.status(403).send({ error: '无权限查看统计数据' })
    }
    return service.getStats()
  })

  app.get(`${BASE}/rows`, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'cc_admin_advanced_table'))) {
      return reply.status(403).send({ error: '无权限查看数据' })
    }
    const { page, per_page } = parsePagination(request.query as Record<string, unknown>)
    const str = (key: string) => queryString(request, key).trim()
    return service.listItems(
      page,
      per_page,
      {
        search: str('search'),
        status: str('status'),
        category: str('category'),
        owner: str('owner'),
        isActive: parseYesNo(str('is_active')),
        pinnedOnly: parseYesNo(str('pinned_only'), false)!,
      },
      str('sort_field') || 'sort_order',
      str('sort_order') || 'asc',
    )
  })

  const rowInput = routeBody(rowBody, 'create')
  app.post(`${BASE}/rows`, { ...opts, ...rowInput.route }, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'cc_admin_advanced_table_add'))) {
      return reply.status(403).send({ error: '无权限新增记录' })
    }
    return reply.status(201).send(await service.createItem(rowInput.parse(request)))
  })

  const rowPatch = routeBody(rowBody, 'patch')
  app.put(`${BASE}/rows/${intParam('item_id')}`, { ...opts, ...rowPatch.route }, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'cc_admin_advanced_table_edit'))) {
      return reply.status(403).send({ error: '无权限编辑记录' })
    }
    const item = await service.getOr404(itemId(request))
    return service.updateItem(item, rowPatch.parse(request))
  })

  app.delete(`${BASE}/rows/${intParam('item_id')}`, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'cc_admin_advanced_table_delete'))) {
      return reply.status(403).send({ error: '无权限删除记录' })
    }
    const item = await service.getOr404(itemId(request))
    return service.deleteItem(item)
  })

  const reorderItems = routeBody(reorderItem, 'array', '参数格式错误，需要数组')
  app.put(`${BASE}/rows/reorder`, { ...opts, ...reorderItems.route }, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'cc_admin_advanced_table_edit'))) {
      return reply.status(403).send({ error: '无权限排序' })
    }
    // request.get_json() or []
    return service.reorderRows(reorderItems.parse(request))
  })

  const batchPatch = routeBody(batchUpdateBody, 'patch')
  app.post(`${BASE}/rows/batch-update`, { ...opts, ...batchPatch.route }, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'cc_admin_advanced_table_edit'))) {
      return reply.status(403).send({ error: '无权限批量更新' })
    }
    return service.batchUpdate(batchPatch.parse(request))
  })

  const batchDeleteInput = routeBody(batchDeleteBody, 'create')
  app.post(`${BASE}/rows/batch-delete`, { ...opts, ...batchDeleteInput.route }, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'cc_admin_advanced_table_delete'))) {
      return reply.status(403).send({ error: '无权限批量删除' })
    }
    return service.batchDelete(batchDeleteInput.parse(request))
  })
}
