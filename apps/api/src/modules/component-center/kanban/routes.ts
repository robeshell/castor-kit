/**
 * Kanban page routes
 *
 * Routes with an id run get_or_404 first, then check permissions (preserves existing API behavior).
 */

import type { FastifyInstance } from 'fastify'
import { hasMenuPermission, loginRequired } from '@/common/auth'
import { intParam, jsonBody, parseIntParam, rawJsonBody } from '@/common/http'
import { pyTruthy } from '@/common/py'
import { KanbanService } from './service'

const BASE = '/api/admin/component-center/kanban'

export async function registerKanbanRoutes(app: FastifyInstance): Promise<void> {
  const service = new KanbanService(app.db)
  const opts = { preHandler: loginRequired }

  // ── Kanban columns ──────────────────────────────────────────────────────────

  app.get(`${BASE}/boards`, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'cc_admin_kanban_page'))) {
      return reply.status(403).send({ error: '无权限' })
    }
    return service.getAllBoards()
  })

  app.post(`${BASE}/boards`, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'cc_admin_kanban_add'))) {
      return reply.status(403).send({ error: '无权限新建列' })
    }
    return reply.status(201).send(await service.createBoard(jsonBody(request)))
  })

  app.put(`${BASE}/boards/${intParam('board_id')}`, opts, async (request, reply) => {
    const board = await service.getBoardOr404(parseIntParam((request.params as { board_id: string }).board_id))
    if (!(await hasMenuPermission(request, 'cc_admin_kanban_edit'))) {
      return reply.status(403).send({ error: '无权限编辑列' })
    }
    return service.updateBoard(board, jsonBody(request))
  })

  app.delete(`${BASE}/boards/${intParam('board_id')}`, opts, async (request, reply) => {
    const board = await service.getBoardOr404(parseIntParam((request.params as { board_id: string }).board_id))
    if (!(await hasMenuPermission(request, 'cc_admin_kanban_delete'))) {
      return reply.status(403).send({ error: '无权限删除列' })
    }
    return service.deleteBoard(board)
  })

  // ── Cards ────────────────────────────────────────────────────────────

  app.put(`${BASE}/cards/reorder`, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'cc_admin_kanban_edit'))) {
      return reply.status(403).send({ error: '无权限' })
    }
    // request.get_json() or []
    const body = rawJsonBody(request)
    return service.reorderCards(pyTruthy(body) ? body : [])
  })

  app.post(`${BASE}/cards`, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'cc_admin_kanban_add'))) {
      return reply.status(403).send({ error: '无权限新建卡片' })
    }
    return reply.status(201).send(await service.createCard(jsonBody(request)))
  })

  app.put(`${BASE}/cards/${intParam('card_id')}`, opts, async (request, reply) => {
    const card = await service.getCardOr404(parseIntParam((request.params as { card_id: string }).card_id))
    if (!(await hasMenuPermission(request, 'cc_admin_kanban_edit'))) {
      return reply.status(403).send({ error: '无权限编辑卡片' })
    }
    return service.updateCard(card, jsonBody(request))
  })

  app.delete(`${BASE}/cards/${intParam('card_id')}`, opts, async (request, reply) => {
    const card = await service.getCardOr404(parseIntParam((request.params as { card_id: string }).card_id))
    if (!(await hasMenuPermission(request, 'cc_admin_kanban_delete'))) {
      return reply.status(403).send({ error: '无权限删除卡片' })
    }
    return service.deleteCard(card)
  })
}
