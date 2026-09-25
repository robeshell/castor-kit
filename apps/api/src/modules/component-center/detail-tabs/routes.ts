/**
 * Detail tabs page routes
 *
 * Routes with an id do get_or_404 first, then the permission check (preserves existing API behavior).
 */

import type { FastifyInstance } from 'fastify'
import { hasMenuPermission, loginRequired } from '@/common/auth'
import { intParam, jsonBody, parseIntParam, queryString } from '@/common/http'
import { DetailTabsService } from './service'

const BASE = '/api/admin/component-center/detail-tabs'

export async function registerDetailTabsRoutes(app: FastifyInstance): Promise<void> {
  const service = new DetailTabsService(app.db)
  const opts = { preHandler: loginRequired }
  const memberId = (request: { params: unknown }) => parseIntParam((request.params as { member_id: string }).member_id)

  app.get(`${BASE}/members`, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'cc_admin_detail_tabs_page'))) {
      return reply.status(403).send({ error: '无权限' })
    }
    const search = queryString(request, 'search', '').trim() || null
    return service.getAllMembers(search)
  })

  app.post(`${BASE}/members`, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'cc_admin_detail_tabs_add'))) {
      return reply.status(403).send({ error: '无权限新建成员' })
    }
    return reply.status(201).send(await service.createMember(jsonBody(request)))
  })

  app.get(`${BASE}/members/${intParam('member_id')}`, opts, async (request, reply) => {
    const member = await service.getMemberOr404(memberId(request))
    if (!(await hasMenuPermission(request, 'cc_admin_detail_tabs_page'))) {
      return reply.status(403).send({ error: '无权限' })
    }
    return service.getMember(member.id)
  })

  app.put(`${BASE}/members/${intParam('member_id')}`, opts, async (request, reply) => {
    const member = await service.getMemberOr404(memberId(request))
    if (!(await hasMenuPermission(request, 'cc_admin_detail_tabs_edit'))) {
      return reply.status(403).send({ error: '无权限编辑成员' })
    }
    return service.updateMember(member, jsonBody(request))
  })

  app.delete(`${BASE}/members/${intParam('member_id')}`, opts, async (request, reply) => {
    const member = await service.getMemberOr404(memberId(request))
    if (!(await hasMenuPermission(request, 'cc_admin_detail_tabs_delete'))) {
      return reply.status(403).send({ error: '无权限删除成员' })
    }
    return service.deleteMember(member)
  })
}
