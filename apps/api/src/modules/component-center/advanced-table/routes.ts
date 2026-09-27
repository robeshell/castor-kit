/**
 * Advanced table page routes
 *
 * Routes with an id check permissions first (403), then load the record (404), so a caller without permission can't tell whether an id exists.
 */

import type { FastifyInstance, FastifyRequest } from 'fastify'
import { hasMenuPermission, loginRequired } from '@/common/auth'
import { intParam, parseIntParam, queryString } from '@/common/http'
import { parsePagination } from '@/common/pagination'
import { parseArrayBody, parseBody, parsePatch, parseYesNo } from '@/common/validation'
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

  app.post(`${BASE}/rows`, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'cc_admin_advanced_table_add'))) {
      return reply.status(403).send({ error: '无权限新增记录' })
    }
    return reply.status(201).send(await service.createItem(parseBody(rowBody, request.body)))
  })

  app.put(`${BASE}/rows/${intParam('item_id')}`, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'cc_admin_advanced_table_edit'))) {
      return reply.status(403).send({ error: '无权限编辑记录' })
    }
    const item = await service.getOr404(itemId(request))
    return service.updateItem(item, parsePatch(rowBody, request.body))
  })

  app.delete(`${BASE}/rows/${intParam('item_id')}`, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'cc_admin_advanced_table_delete'))) {
      return reply.status(403).send({ error: '无权限删除记录' })
    }
    const item = await service.getOr404(itemId(request))
    return service.deleteItem(item)
  })

  app.put(`${BASE}/rows/reorder`, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'cc_admin_advanced_table_edit'))) {
      return reply.status(403).send({ error: '无权限排序' })
    }
    // request.get_json() or []
    return service.reorderRows(parseArrayBody(reorderItem, request.body, '参数格式错误，需要数组'))
  })

  app.post(`${BASE}/rows/batch-update`, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'cc_admin_advanced_table_edit'))) {
      return reply.status(403).send({ error: '无权限批量更新' })
    }
    return service.batchUpdate(parsePatch(batchUpdateBody, request.body))
  })

  app.post(`${BASE}/rows/batch-delete`, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'cc_admin_advanced_table_delete'))) {
      return reply.status(403).send({ error: '无权限批量删除' })
    }
    return service.batchDelete(parseBody(batchDeleteBody, request.body))
  })
}
