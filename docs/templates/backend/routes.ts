/**
 * routes 层模板 → apps/api/src/modules/<domain>/<resource>/routes.ts
 *
 * TODO: 替换 <Resource> 为类型名（大驼峰），<resource> 为资源名（URL 用连字符复数，如 customer-orders）
 * TODO: 替换 <domain_resource> 为权限编码前缀（如 system_customer；component_center 域用 cc_ 前缀）
 * TODO: 在 apps/api/src/modules/<domain>/router.ts 中注册：
 *         import { register<Resource>Routes } from './<resource>/routes'
 *         await register<Resource>Routes(app)
 *
 * 权限编码：<domain_resource>（查看 / 模板）、<domain_resource>_add、<domain_resource>_edit、
 *          <domain_resource>_delete、<domain_resource>_export、<domain_resource>_import
 * 约定：
 * - 权限判断一律 import 自 common/auth（禁止在这里自定义 hasPermission）
 * - 不直接写 SQL（经 service → repository）
 * - 带 id 的路由先 get_or_404（404）再做权限检查（403）
 * - 业务错误由 service 抛 ServiceError，全局错误处理器转成 { error, ...payload }
 */

import type { FastifyInstance } from 'fastify'
import { hasMenuPermission, loginRequired } from '@/common/auth'
import { getUploadedFile, intParam, jsonBody, parseIntParam, queryString } from '@/common/http'
import { parsePagination } from '@/common/pagination'
import { sendTable } from '@/common/tabular'
import { <Resource>Service } from './service'

const BASE = '/api/admin/<resource>s'

export async function register<Resource>Routes(app: FastifyInstance): Promise<void> {
  const service = new <Resource>Service(app.db)
  const opts = { preHandler: loginRequired }
  const itemPath = `${BASE}/${intParam('item_id')}`
  const itemId = (params: unknown) => parseIntParam((params as { item_id: string }).item_id)

  app.get(BASE, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, '<domain_resource>'))) {
      return reply.status(403).send({ error: '无权限' })
    }
    const { page, per_page } = parsePagination(request.query as Record<string, unknown>)
    return service.listItems(page, per_page, queryString(request, 'search').trim())
  })

  app.post(BASE, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, '<domain_resource>_add'))) {
      return reply.status(403).send({ error: '无权限新增' })
    }
    return reply.status(201).send(await service.createItem(jsonBody(request)))
  })

  app.get(itemPath, opts, async (request, reply) => {
    const item = await service.getOr404(itemId(request.params))
    if (!(await hasMenuPermission(request, '<domain_resource>'))) {
      return reply.status(403).send({ error: '无权限' })
    }
    return service.getItem(item)
  })

  app.put(itemPath, opts, async (request, reply) => {
    const item = await service.getOr404(itemId(request.params))
    if (!(await hasMenuPermission(request, '<domain_resource>_edit'))) {
      return reply.status(403).send({ error: '无权限编辑' })
    }
    return service.updateItem(item, jsonBody(request))
  })

  app.delete(itemPath, opts, async (request, reply) => {
    const item = await service.getOr404(itemId(request.params))
    if (!(await hasMenuPermission(request, '<domain_resource>_delete'))) {
      return reply.status(403).send({ error: '无权限删除' })
    }
    return service.deleteItem(item)
  })

  app.post(`${BASE}/export`, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, '<domain_resource>_export'))) {
      return reply.status(403).send({ error: '无权限导出' })
    }
    return sendTable(reply, await service.exportItems(jsonBody(request)))
  })

  app.get(`${BASE}/template`, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, '<domain_resource>'))) {
      return reply.status(403).send({ error: '无权限' })
    }
    return sendTable(reply, await service.downloadTemplate(queryString(request, 'file_type', 'xlsx')))
  })

  app.post(`${BASE}/import`, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, '<domain_resource>_import'))) {
      return reply.status(403).send({ error: '无权限导入' })
    }
    return service.importItems(await getUploadedFile(request))
  })
}
