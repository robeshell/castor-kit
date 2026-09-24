/**
 * 看板页路由（对齐 AuraStack backend/app/component_center/api/kanban_page.py）
 *
 * 与 Flask 一致：带 id 的路由先 get_or_404，再做权限检查。
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

  // ── 看板列 ──────────────────────────────────────────────────────────

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

  // ── 卡片 ────────────────────────────────────────────────────────────

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
