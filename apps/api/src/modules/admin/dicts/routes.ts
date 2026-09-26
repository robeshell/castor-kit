/**
 * Data dictionary routes
 *
 * Routes with an id run get_or_404 first, then the permission check.
 */

import type { FastifyInstance, FastifyRequest } from 'fastify'
import { hasMenuPermission, loginRequired } from '@/common/auth'
import { getUploadedFile, intParam, jsonBody, parseIntParam, queryString } from '@/common/http'
import { parsePagination } from '@/common/pagination'
import { sendTable } from '@/common/tabular'
import { parseBool } from './schema'
import { DictsService } from './service'

function queryArg(request: FastifyRequest, key: string): string | null {
  const value = (request.query as Record<string, unknown> | undefined)?.[key]
  return value === undefined ? null : queryString(request, key)
}

export async function registerDictRoutes(app: FastifyInstance): Promise<void> {
  const service = new DictsService(app.db)
  const opts = { preHandler: loginRequired }

  const dictIdOf = (request: FastifyRequest) => parseIntParam((request.params as { dict_id: string }).dict_id)
  const itemIdOf = (request: FastifyRequest) => parseIntParam((request.params as { item_id: string }).item_id)

  // Intentionally no menu permission: any logged-in user can use it for cross-module dropdowns (e.g. form select options)
  app.get('/api/admin/dicts/options', opts, async (request) => {
    return service.getDictOptions(queryString(request, 'codes').trim())
  })

  app.get('/api/admin/dicts', opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'system_dicts'))) {
      return reply.status(403).send({ error: '无权限查看数据字典' })
    }
    const { page, per_page } = parsePagination(request.query as Record<string, unknown>)
    return service.listDictTypes(
      page,
      per_page,
      queryString(request, 'search').trim(),
      parseBool(queryArg(request, 'is_active')),
    )
  })

  app.post('/api/admin/dicts', opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'system_dicts_add'))) {
      return reply.status(403).send({ error: '无权限新增数据字典' })
    }
    return reply.status(201).send(await service.createDictType(jsonBody(request)))
  })

  const dictPath = `/api/admin/dicts/${intParam('dict_id')}`

  app.get(dictPath, opts, async (request, reply) => {
    const type = await service.getTypeOr404(dictIdOf(request))
    if (!(await hasMenuPermission(request, 'system_dicts'))) {
      return reply.status(403).send({ error: '无权限查看数据字典' })
    }
    return service.getDictType(type, parseBool(queryArg(request, 'include_items')) === true)
  })

  app.put(dictPath, opts, async (request, reply) => {
    const type = await service.getTypeOr404(dictIdOf(request))
    if (!(await hasMenuPermission(request, 'system_dicts_edit'))) {
      return reply.status(403).send({ error: '无权限编辑数据字典' })
    }
    return service.updateDictType(type, jsonBody(request))
  })

  app.delete(dictPath, opts, async (request, reply) => {
    const type = await service.getTypeOr404(dictIdOf(request))
    if (!(await hasMenuPermission(request, 'system_dicts_delete'))) {
      return reply.status(403).send({ error: '无权限删除数据字典' })
    }
    return service.deleteDictType(type)
  })

  app.get(`${dictPath}/items`, opts, async (request, reply) => {
    const type = await service.getTypeOr404(dictIdOf(request))
    if (!(await hasMenuPermission(request, 'system_dicts'))) {
      return reply.status(403).send({ error: '无权限查看字典项' })
    }
    return service.listDictItems(type, queryString(request, 'search').trim(), parseBool(queryArg(request, 'is_active')))
  })

  app.post(`${dictPath}/items`, opts, async (request, reply) => {
    const type = await service.getTypeOr404(dictIdOf(request))
    if (!(await hasMenuPermission(request, 'system_dicts_add'))) {
      return reply.status(403).send({ error: '无权限新增字典项' })
    }
    return reply.status(201).send(await service.createDictItem(type, jsonBody(request)))
  })

  app.get(`${dictPath}/items/export`, opts, async (request, reply) => {
    const type = await service.getTypeOr404(dictIdOf(request))
    if (!(await hasMenuPermission(request, 'system_dicts_export'))) {
      return reply.status(403).send({ error: '无权限导出字典项' })
    }
    return sendTable(reply, await service.exportDictItems(type, queryArg(request, 'file_type')))
  })

  app.get(`${dictPath}/items/template`, opts, async (request, reply) => {
    const type = await service.getTypeOr404(dictIdOf(request))
    if (!(await hasMenuPermission(request, 'system_dicts_import'))) {
      return reply.status(403).send({ error: '无权限下载模板' })
    }
    return sendTable(reply, await service.downloadDictItemsTemplate(type, queryArg(request, 'file_type')))
  })

  app.post(`${dictPath}/items/import`, opts, async (request, reply) => {
    const type = await service.getTypeOr404(dictIdOf(request))
    if (!(await hasMenuPermission(request, 'system_dicts_import'))) {
      return reply.status(403).send({ error: '无权限导入字典项' })
    }
    return service.importDictItems(type, await getUploadedFile(request))
  })

  const itemPath = `/api/admin/dicts/items/${intParam('item_id')}`

  app.get(itemPath, opts, async (request, reply) => {
    const item = await service.getItemOr404(itemIdOf(request))
    if (!(await hasMenuPermission(request, 'system_dicts'))) {
      return reply.status(403).send({ error: '无权限查看字典项' })
    }
    return service.getDictItem(item)
  })

  app.put(itemPath, opts, async (request, reply) => {
    const item = await service.getItemOr404(itemIdOf(request))
    if (!(await hasMenuPermission(request, 'system_dicts_edit'))) {
      return reply.status(403).send({ error: '无权限编辑字典项' })
    }
    return service.updateDictItem(item, jsonBody(request))
  })

  app.delete(itemPath, opts, async (request, reply) => {
    const item = await service.getItemOr404(itemIdOf(request))
    if (!(await hasMenuPermission(request, 'system_dicts_delete'))) {
      return reply.status(403).send({ error: '无权限删除字典项' })
    }
    return service.deleteDictItem(item)
  })
}
