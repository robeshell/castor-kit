/**
 * Kanban page routes
 *
 * Routes with an id check permissions first (403), then load the record (404), so a caller without permission can't tell whether an id exists.
 */

import type { FastifyInstance } from 'fastify'
import { hasMenuPermission, loginRequired } from '@/common/auth'
import { intParam, parseIntParam } from '@/common/http'
import { parseArrayBody, parseBody, parsePatch } from '@/common/validation'
import { boardBody, boardUpdateBody, cardBody, cardUpdateBody, reorderItem } from './schema'
import { KanbanService } from './service'

const BASE = '/api/admin/component-center/kanban'

export async function registerKanbanRoutes(app: FastifyInstance): Promise<void> {
  const service = new KanbanService(app.db)
  const opts = { preHandler: loginRequired }

  // ── Kanban columns ──────────────────────────────────────────────────────────

  app.get(`${BASE}/boards`, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'cc_admin_kanban'))) {
      return reply.status(403).send({ error: '无权限' })
    }
    return service.getAllBoards()
  })

  app.post(`${BASE}/boards`, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'cc_admin_kanban_add'))) {
      return reply.status(403).send({ error: '无权限新建列' })
    }
    return reply.status(201).send(await service.createBoard(parseBody(boardBody, request.body)))
  })

  app.put(`${BASE}/boards/${intParam('board_id')}`, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'cc_admin_kanban_edit'))) {
      return reply.status(403).send({ error: '无权限编辑列' })
    }
    const board = await service.getBoardOr404(parseIntParam((request.params as { board_id: string }).board_id))
    return service.updateBoard(board, parsePatch(boardUpdateBody, request.body))
  })

  app.delete(`${BASE}/boards/${intParam('board_id')}`, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'cc_admin_kanban_delete'))) {
      return reply.status(403).send({ error: '无权限删除列' })
    }
    const board = await service.getBoardOr404(parseIntParam((request.params as { board_id: string }).board_id))
    return service.deleteBoard(board)
  })

  // ── Cards ────────────────────────────────────────────────────────────

  app.put(`${BASE}/cards/reorder`, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'cc_admin_kanban_edit'))) {
      return reply.status(403).send({ error: '无权限' })
    }
    // request.get_json() or []
    return service.reorderCards(parseArrayBody(reorderItem, request.body, '参数格式错误，需要数组'))
  })

  app.post(`${BASE}/cards`, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'cc_admin_kanban_add'))) {
      return reply.status(403).send({ error: '无权限新建卡片' })
    }
    return reply.status(201).send(await service.createCard(parseBody(cardBody, request.body)))
  })

  app.put(`${BASE}/cards/${intParam('card_id')}`, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'cc_admin_kanban_edit'))) {
      return reply.status(403).send({ error: '无权限编辑卡片' })
    }
    const card = await service.getCardOr404(parseIntParam((request.params as { card_id: string }).card_id))
    return service.updateCard(card, parsePatch(cardUpdateBody, request.body))
  })

  app.delete(`${BASE}/cards/${intParam('card_id')}`, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'cc_admin_kanban_delete'))) {
      return reply.status(403).send({ error: '无权限删除卡片' })
    }
    const card = await service.getCardOr404(parseIntParam((request.params as { card_id: string }).card_id))
    return service.deleteCard(card)
  })
}
