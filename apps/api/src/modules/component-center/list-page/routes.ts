/**
 * 列表页路由（对齐 AuraStack backend/app/component_center/api/list_page.py）
 *
 * 检查顺序与 Flask 逐路由一致：详情 GET/PUT/DELETE 先 get_or_404 再做权限检查；
 * versions / rollback 则是先权限检查再 get_or_404。
 */

import { stat } from 'node:fs/promises'
import { resolve, sep } from 'node:path'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { hasAnyMenuPermission, hasMenuPermission, loginRequired } from '@/common/auth'
import { getUploadedFile, intParam, jsonBody, notFound, parseIntParam, queryString } from '@/common/http'
import { parsePagination } from '@/common/pagination'
import { sendTable } from '@/common/tabular'
import { parseBool } from './schema'
import { ListPageService } from './service'

const BASE = '/api/admin/component-center/list-page'

type IdParams = { item_id: string }

/** `request.args.get(key)`：不存在 → undefined（对应 None） */
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
    if (!(await hasMenuPermission(request, 'system_list_page'))) {
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
    if (!(await hasMenuPermission(request, 'system_list_page'))) {
      return reply.status(403).send({ error: '无权限下载导入模板' })
    }
    return sendTable(reply, await service.downloadTemplate(queryArg(request, 'file_type')))
  })

  app.post(`${BASE}/import`, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'system_list_page_edit'))) {
      return reply.status(403).send({ error: '无权限导入数据' })
    }
    return service.importItems(await getUploadedFile(request))
  })

  app.post(`${BASE}/upload-image`, opts, async (request, reply) => {
    if (!(await hasAnyMenuPermission(request, 'system_list_page_add', 'system_list_page_edit'))) {
      return reply.status(403).send({ error: '无权限上传图片' })
    }
    return service.saveImage(await getUploadedFile(request))
  })

  app.post(`${BASE}/upload-file`, opts, async (request, reply) => {
    if (!(await hasAnyMenuPermission(request, 'system_list_page_add', 'system_list_page_edit'))) {
      return reply.status(403).send({ error: '无权限上传附件' })
    }
    return service.saveFile(await getUploadedFile(request))
  })

  // 回读：`<path:filename>` → 通配 `*`。reply.sendFile 由 app.ts 全局注册的 @fastify/static 提供。
  await app.register(async (scope) => {

    /**
     * Flask 的 path 转换器要求至少一个字符且不能以 `/` 开头，否则不命中路由（→ 404）。
     * 文件名经 secure_filename 后只含 [A-Za-z0-9_.-]，再校验解析后的路径仍在上传目录内（防目录穿越）。
     */
    async function sendUpload(reply: FastifyReply, safeName: string, dir: string, asAttachment: boolean) {
      const root = resolve(dir)
      const target = resolve(root, safeName)
      if (!target.startsWith(root + sep)) throw notFound()
      const info = await stat(target).catch(() => null)
      if (!info || !info.isFile()) throw notFound()
      // 与 Flask send_from_directory 一致：no-cache + inline/attachment（secure_filename 结果全是 token 字符，无需引号）
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
      const operator = request.session.get('username') || 'system'
      return service.rollbackVersion(item, versionItem, operator)
    },
  )
}
