/**
 * Announcement management routes
 *
 * Routes with an id check permissions first (403), then load the record (404), so a caller without permission can't tell whether an id exists.
 */

import type { FastifyInstance, FastifyRequest } from 'fastify'
import { hasMenuPermission, loginRequired } from '@/common/auth'
import { getUploadedFile, intParam, parseIntParam, queryString } from '@/common/http'
import { parsePagination } from '@/common/pagination'
import { sendTable } from '@/common/tabular'
import { routeBody } from '@/common/validation'
import { announcementBody, announcementExportBody } from './schema'
import { AnnouncementService } from './service'

const FORBIDDEN = { error: '无权限' }

export async function registerAnnouncementRoutes(app: FastifyInstance): Promise<void> {
  const service = new AnnouncementService(app.db)
  const opts = { preHandler: loginRequired }
  const itemIdOf = (request: FastifyRequest) => parseIntParam((request.params as { item_id: string }).item_id)
  const itemPath = `/api/admin/announcements/${intParam('item_id')}`

  app.get('/api/admin/announcements', opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'system_announcements'))) return reply.status(403).send(FORBIDDEN)
    const { page, per_page } = parsePagination(request.query as Record<string, unknown>)
    return service.listItems(page, per_page, {
      search: queryString(request, 'search').trim(),
      status: queryString(request, 'status').trim() || null,
      announceType: queryString(request, 'announce_type').trim() || null,
    })
  })

  const announcementInput = routeBody(announcementBody, 'create')
  app.post('/api/admin/announcements', { ...opts, ...announcementInput.route }, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'system_announcements_add'))) return reply.status(403).send(FORBIDDEN)
    return reply.status(201).send(await service.createItem(announcementInput.parse(request)))
  })

  const announcementPatch = routeBody(announcementBody, 'patch')
  app.put(itemPath, { ...opts, ...announcementPatch.route }, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'system_announcements_edit'))) return reply.status(403).send(FORBIDDEN)
    const item = await service.getOr404(itemIdOf(request))
    return service.updateItem(item, announcementPatch.parse(request))
  })

  app.delete(itemPath, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'system_announcements_delete'))) return reply.status(403).send(FORBIDDEN)
    const item = await service.getOr404(itemIdOf(request))
    return service.deleteItem(item)
  })

  app.post(`${itemPath}/publish`, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'system_announcements_edit'))) return reply.status(403).send(FORBIDDEN)
    const item = await service.getOr404(itemIdOf(request))
    return service.publishItem(item)
  })

  app.post(`${itemPath}/unpublish`, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'system_announcements_edit'))) return reply.status(403).send(FORBIDDEN)
    const item = await service.getOr404(itemIdOf(request))
    return service.unpublishItem(item)
  })

  const announcementExportInput = routeBody(announcementExportBody, 'create')
  app.post('/api/admin/announcements/export', { ...opts, ...announcementExportInput.route }, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'system_announcements_export'))) return reply.status(403).send(FORBIDDEN)
    return sendTable(reply, await service.exportItems(announcementExportInput.parse(request)))
  })

  app.get('/api/admin/announcements/template', opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'system_announcements_import'))) return reply.status(403).send(FORBIDDEN)
    return sendTable(reply, await service.downloadTemplate(queryString(request, 'file_type', '') || null))
  })

  app.post('/api/admin/announcements/import', opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'system_announcements_import'))) return reply.status(403).send(FORBIDDEN)
    return service.importItems(await getUploadedFile(request))
  })

  // Login required only; no menu permission check
  app.get('/api/admin/announcements/export-fields', opts, async () => service.exportFields())
}
