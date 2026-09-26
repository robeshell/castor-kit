/**
 * Files module routes
 *
 * Upload and read need only a signed-in user (avatars and business forms upload files; ids are unguessable UUIDs).
 * The management list needs system_files, deleting needs system_files_delete.
 */

import type { FastifyInstance, FastifyRequest } from 'fastify'
import { getCurrentAdminUser, hasMenuPermission, loginRequired } from '@/common/auth'
import { getUploadedFile, queryString } from '@/common/http'
import { parsePagination } from '@/common/pagination'
import { StorageProvider } from '@/common/storage'
import { FILE_KINDS, type FileKind } from './schema'
import { FileService } from './service'

const BASE = '/api/admin/files'

export async function registerFileRoutes(app: FastifyInstance): Promise<void> {
  const service = new FileService(app.db, new StorageProvider(app.settings, app.config.storageLocalDir), app.settings, app.log)
  const opts = { preHandler: loginRequired }
  const fileOf = (request: FastifyRequest) => service.getOr404((request.params as { file_id: string }).file_id)

  app.post(BASE, opts, async (request, reply) => {
    const user = await getCurrentAdminUser(request)
    return reply.status(201).send(await service.upload(await getUploadedFile(request), user?.id ?? null))
  })

  app.get(BASE, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'system_files'))) {
      return reply.status(403).send({ error: '无权限查看文件列表' })
    }
    const { page, per_page } = parsePagination(request.query as Record<string, unknown>)
    const kind = queryString(request, 'kind').trim()
    const referenced = queryString(request, 'referenced').trim()
    return service.list(page, per_page, {
      search: queryString(request, 'search').trim(),
      kind: (FILE_KINDS as readonly string[]).includes(kind) ? (kind as FileKind) : '',
      referenced: referenced === 'yes' || referenced === 'no' ? referenced : '',
    })
  })

  app.get(`${BASE}/:file_id/info`, opts, async (request) => service.info(await fileOf(request)))

  // Preview / download: `?download=1` forces an attachment
  app.get(`${BASE}/:file_id`, opts, async (request, reply) => {
    const file = await fileOf(request)
    if (request.headers['if-none-match'] === `"${file.sha256}"`) return reply.status(304).send()
    const { download, headers } = await service.serve(file, queryString(request, 'download') === '1')
    if (download.kind === 'redirect') return reply.redirect(download.url, 302)
    return reply.headers(headers).send(download.stream)
  })

  app.delete(`${BASE}/:file_id`, opts, async (request, reply) => {
    const file = await fileOf(request)
    if (!(await hasMenuPermission(request, 'system_files_delete'))) {
      return reply.status(403).send({ error: '无权限删除文件' })
    }
    return service.remove(file)
  })
}
