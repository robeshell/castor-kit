/**
 * List page routes
 *
 * Check order (preserves existing API behavior): detail GET/PUT/DELETE run get_or_404 before the permission check;
 * versions / rollback check permissions first, then get_or_404.
 */

import { stat } from 'node:fs/promises'
import { resolve, sep } from 'node:path'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { currentUsername, hasMenuPermission, loginRequired } from '@/common/auth'
import { getUploadedFile, intParam, jsonBody, notFound, parseIntParam, queryString } from '@/common/http'
import { parsePagination } from '@/common/pagination'
import { sendTable } from '@/common/tabular'
import { parseBool } from './schema'
import { ListPageService } from './service'

const BASE = '/api/admin/component-center/list-page'

type IdParams = { item_id: string }

/** `request.args.get(key)`: missing → undefined (i.e. None) */
function queryArg(request: FastifyRequest, key: string): string | undefined {
  const value = (request.query as Record<string, unknown> | undefined)?.[key]
  const first = Array.isArray(value) ? value[0] : value
  return typeof first === 'string' ? first : undefined
}

export async function registerListPageRoutes(app: FastifyInstance): Promise<void> {
  const service = new ListPageService(app.db, app.config.instanceDir)
  const opts = { preHandler: loginRequired }

  app.get(BASE, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'system_list_page'))) {
      return reply.status(403).send({ error: '无权限查看列表页数据' })
    }
    const { page, per_page } = parsePagination(request.query as Record<string, unknown>)
    return service.listItems(page, per_page, {
      search: queryString(request, 'search'),
      category: queryString(request, 'category'),
      owner: queryString(request, 'owner'),
      is_active: parseBool(queryArg(request, 'is_active'), null),
      status: queryString(request, 'status'),
    })
  })

  app.post(BASE, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'system_list_page_add'))) {
      return reply.status(403).send({ error: '无权限新增记录' })
    }
    return reply.status(201).send(await service.createItem(jsonBody(request)))
  })

  const detailPath = `${BASE}/${intParam('item_id')}`

  app.get(detailPath, opts, async (request, reply) => {
    const item = await service.getOr404(parseIntParam((request.params as IdParams).item_id))
    if (!(await hasMenuPermission(request, 'system_list_page'))) {
      return reply.status(403).send({ error: '无权限查看记录详情' })
    }
    return service.toDict(item)
  })

  app.put(detailPath, opts, async (request, reply) => {
    const item = await service.getOr404(parseIntParam((request.params as IdParams).item_id))
    if (!(await hasMenuPermission(request, 'system_list_page_edit'))) {
      return reply.status(403).send({ error: '无权限编辑记录' })
    }
    return service.updateItem(item, jsonBody(request))
  })

  app.delete(detailPath, opts, async (request, reply) => {
    const item = await service.getOr404(parseIntParam((request.params as IdParams).item_id))
    if (!(await hasMenuPermission(request, 'system_list_page_delete'))) {
      return reply.status(403).send({ error: '无权限删除记录' })
    }
    return service.deleteItem(item)
  })

  const exportHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(await hasMenuPermission(request, 'system_list_page_export'))) {
      return reply.status(403).send({ error: '无权限导出数据' })
    }
    if (request.method === 'GET') {
      const args: Record<string, unknown> = {}
      for (const key of ['fields', 'search', 'category', 'owner', 'is_active', 'status', 'file_type']) {
        args[key] = queryArg(request, key)
      }
      return sendTable(reply, await service.exportItems(args, 'GET'))
    }
    return sendTable(reply, await service.exportItems(jsonBody(request), 'POST'))
  }
  app.get(`${BASE}/export`, opts, exportHandler)
  app.post(`${BASE}/export`, opts, exportHandler)

  app.get(`${BASE}/template`, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'system_list_page_import'))) {
      return reply.status(403).send({ error: '无权限下载导入模板' })
    }
    return sendTable(reply, await service.downloadTemplate(queryArg(request, 'file_type')))
  })

  app.post(`${BASE}/import`, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'system_list_page_import'))) {
      return reply.status(403).send({ error: '无权限导入数据' })
    }
    return service.importItems(await getUploadedFile(request))
  })

  // Read-back of files uploaded before the file center existed (new uploads go through /api/admin/files).
  // `<path:filename>` → wildcard `*`. reply.sendFile comes from @fastify/static, registered globally in app.ts.
  await app.register(async (scope) => {

    /**
     * The filename param must be at least one character and must not start with `/`; otherwise the route is treated as unmatched (→ 404).
     * After secure_filename the name contains only [A-Za-z0-9_.-]; the resolved path is also checked to stay inside the upload dir (prevents directory traversal).
     */
    async function sendUpload(reply: FastifyReply, safeName: string, dir: string, asAttachment: boolean) {
      const root = resolve(dir)
      const target = resolve(root, safeName)
      if (!target.startsWith(root + sep)) throw notFound()
      const info = await stat(target).catch(() => null)
      if (!info || !info.isFile()) throw notFound()
      // no-cache + inline/attachment (secure_filename output is all token characters, so no quoting needed)
      reply.header('Cache-Control', 'no-cache')
      reply.header('Content-Disposition', `${asAttachment ? 'attachment' : 'inline'}; filename=${safeName}`)
      return reply.sendFile(safeName, root, { cacheControl: false })
    }

    function wildcard(request: FastifyRequest): string {
      const name = (request.params as { '*': string })['*'] ?? ''
      if (!name || name.startsWith('/')) throw notFound()
      return name
    }

    scope.get(`${BASE}/image/*`, opts, async (request, reply) => {
      const name = wildcard(request)
      if (!(await hasMenuPermission(request, 'system_list_page'))) {
        return reply.status(403).send({ error: '无权限查看图片' })
      }
      const safeName = ListPageService.sanitizeImageFilename(name)
      return sendUpload(reply, safeName, await service.getImageUploadDir(), false)
    })

    scope.get(`${BASE}/file/*`, opts, async (request, reply) => {
      const name = wildcard(request)
      if (!(await hasMenuPermission(request, 'system_list_page'))) {
        return reply.status(403).send({ error: '无权限查看附件' })
      }
      const safeName = ListPageService.sanitizeImageFilename(name)
      return sendUpload(reply, safeName, await service.getFileUploadDir(), true)
    })
  })

  app.post(`${BASE}/run-preview`, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'system_list_page'))) {
      return reply.status(403).send({ error: '无权限执行数据预览' })
    }
    return service.runPreview(jsonBody(request))
  })

  app.get(`${BASE}/${intParam('item_id')}/versions`, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'system_list_page'))) {
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
      if (!(await hasMenuPermission(request, 'system_list_page_edit'))) {
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
