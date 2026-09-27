/**
 * Detail tabs page routes
 *
 * Routes with an id check permissions first (403), then load the record (404), so a caller without permission can't tell whether an id exists.
 */

import type { FastifyInstance } from 'fastify'
import { hasMenuPermission, loginRequired } from '@/common/auth'
import { intParam, parseIntParam, queryString } from '@/common/http'
import { routeBody } from '@/common/validation'
import { memberBody } from './schema'
import { DetailTabsService } from './service'

const BASE = '/api/admin/component-center/detail-tabs'

export async function registerDetailTabsRoutes(app: FastifyInstance): Promise<void> {
  const service = new DetailTabsService(app.db)
  const opts = { preHandler: loginRequired }
  const memberId = (request: { params: unknown }) => parseIntParam((request.params as { member_id: string }).member_id)

  app.get(`${BASE}/members`, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'cc_admin_detail_tabs'))) {
      return reply.status(403).send({ error: '无权限' })
    }
    const search = queryString(request, 'search', '').trim() || null
    return service.getAllMembers(search)
  })

  const memberInput = routeBody(memberBody, 'create')
  app.post(`${BASE}/members`, { ...opts, ...memberInput.route }, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'cc_admin_detail_tabs_add'))) {
      return reply.status(403).send({ error: '无权限新建成员' })
    }
    return reply.status(201).send(await service.createMember(memberInput.parse(request)))
  })

  app.get(`${BASE}/members/${intParam('member_id')}`, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'cc_admin_detail_tabs'))) {
      return reply.status(403).send({ error: '无权限' })
    }
    const member = await service.getMemberOr404(memberId(request))
    return service.getMember(member.id)
  })

  const memberPatch = routeBody(memberBody, 'patch')
  app.put(`${BASE}/members/${intParam('member_id')}`, { ...opts, ...memberPatch.route }, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'cc_admin_detail_tabs_edit'))) {
      return reply.status(403).send({ error: '无权限编辑成员' })
    }
    const member = await service.getMemberOr404(memberId(request))
    return service.updateMember(member, memberPatch.parse(request))
  })

  app.delete(`${BASE}/members/${intParam('member_id')}`, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'cc_admin_detail_tabs_delete'))) {
      return reply.status(403).send({ error: '无权限删除成员' })
    }
    const member = await service.getMemberOr404(memberId(request))
    return service.deleteMember(member)
  })
}
