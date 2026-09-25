/**
 * Advanced table page routes
 *
 * Routes with an id do get_or_404 first, then the permission check (preserves existing API behavior).
 */

import type { FastifyInstance, FastifyRequest } from 'fastify'
import { hasMenuPermission, loginRequired } from '@/common/auth'
import { intParam, jsonBody, parseIntParam, rawJsonBody } from '@/common/http'
import { parsePagination } from '@/common/pagination'
import { pyTruthy } from '@/common/py'
import { parseBool } from './schema'
import { AdvancedTableService } from './service'

const BASE = '/api/admin/component-center/advanced-table'

/** `request.args.get(key)`: None when missing */
function queryArg(request: FastifyRequest, key: string): string | null {
  const value = (request.query as Record<string, unknown> | undefined)?.[key]
  const first = Array.isArray(value) ? value[0] : value
  return typeof first === 'string' ? first : null
}

export async function registerAdvancedTableRoutes(app: FastifyInstance): Promise<void> {
  const service = new AdvancedTableService(app.db)
  const opts = { preHandler: loginRequired }
  const itemId = (request: FastifyRequest) => parseIntParam((request.params as { item_id: string }).item_id)

  app.get(`${BASE}/stats`, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'cc_admin_advanced_table_page'))) {
      return reply.status(403).send({ error: '无权限查看统计数据' })
    }
    return service.getStats()
  })

  app.get(`${BASE}/rows`, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'cc_admin_advanced_table_page'))) {
      return reply.status(403).send({ error: '无权限查看数据' })
    }
    const { page, per_page } = parsePagination(request.query as Record<string, unknown>)
    const str = (key: string) => (queryArg(request, key) || '').trim()
    return service.listItems(
      page,
      per_page,
      {
        search: str('search'),
        status: str('status'),
        category: str('category'),
        owner: str('owner'),
        isActive: parseBool(queryArg(request, 'is_active'), null),
        pinnedOnly: parseBool(queryArg(request, 'pinned_only'), false),
      },
      (queryArg(request, 'sort_field') || 'sort_order').trim(),
      (queryArg(request, 'sort_order') || 'asc').trim(),
    )
  })

  app.post(`${BASE}/rows`, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'cc_admin_advanced_table_add'))) {
      return reply.status(403).send({ error: '无权限新增记录' })
    }
    return reply.status(201).send(await service.createItem(jsonBody(request)))
  })

  app.put(`${BASE}/rows/${intParam('item_id')}`, opts, async (request, reply) => {
    const item = await service.getOr404(itemId(request))
    if (!(await hasMenuPermission(request, 'cc_admin_advanced_table_edit'))) {
      return reply.status(403).send({ error: '无权限编辑记录' })
    }
    return service.updateItem(item, jsonBody(request))
  })

  app.delete(`${BASE}/rows/${intParam('item_id')}`, opts, async (request, reply) => {
    const item = await service.getOr404(itemId(request))
    if (!(await hasMenuPermission(request, 'cc_admin_advanced_table_delete'))) {
      return reply.status(403).send({ error: '无权限删除记录' })
    }
    return service.deleteItem(item)
  })

  app.put(`${BASE}/rows/reorder`, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'cc_admin_advanced_table_edit'))) {
      return reply.status(403).send({ error: '无权限排序' })
    }
    // request.get_json() or []
    const body = rawJsonBody(request)
    return service.reorderRows(pyTruthy(body) ? body : [])
  })

  app.post(`${BASE}/rows/batch-update`, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'cc_admin_advanced_table_edit'))) {
      return reply.status(403).send({ error: '无权限批量更新' })
    }
    return service.batchUpdate(jsonBody(request))
  })

  app.post(`${BASE}/rows/batch-delete`, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'cc_admin_advanced_table_delete'))) {
      return reply.status(403).send({ error: '无权限批量删除' })
    }
    return service.batchDelete(jsonBody(request))
  })
}
