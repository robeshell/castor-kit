/**
 * 看板页 service 层（对齐 AuraStack backend/app/component_center/service/kanban_page.py）
 */

import { randomUUID } from 'node:crypto'
import { ServiceError } from '@/common/errors'
import { notFound } from '@/common/http'
import { isPlainObject } from '@/common/py'
import type { Db } from '@/db/client'
import { kanbanBoardToDict, kanbanCardToDict, type KanbanBoard, type KanbanCard } from '@/db/schema'
import { parseLooseDate } from '@/common/py-date'
import { KanbanRepository, type KanbanBoardPatch, type KanbanCardPatch } from './repository'
import {
  changedFields,
  colorOrDefault,
  hasKey,
  normalizePriority,
  parseBool,
  parseIntOr,
  strOrEmpty,
  strOrNull,
} from './schema'

type Data = Record<string, unknown>

/** `uuid.uuid4().hex[:n]` */
function uuidHex(n: number): string {
  return randomUUID().replace(/-/g, '').slice(0, n)
}

/** 取驱动层的 pg 错误（drizzle 会把它包在 cause 里） */
function pgErrorOf(err: unknown): { code?: string; constraint?: string } | null {
  let cur: unknown = err
  for (let i = 0; i < 5 && cur && typeof cur === 'object'; i += 1) {
    if ('code' in cur && typeof (cur as { code: unknown }).code === 'string' && 'severity' in cur) {
      return cur as { code?: string; constraint?: string }
    }
    cur = (cur as { cause?: unknown }).cause
  }
  return null
}

/** `_is_sequence_conflict`：主键冲突（duplicate key ... <constraint>） */
function isSequenceConflict(err: unknown, constraint: string): boolean {
  const pgErr = pgErrorOf(err)
  return pgErr?.code === '23505' && pgErr.constraint === constraint
}

export class KanbanService {
  readonly repo: KanbanRepository

  constructor(private readonly db: Db) {
    this.repo = new KanbanRepository(db)
  }

  async getBoardOr404(id: number): Promise<KanbanBoard> {
    const board = await this.repo.getBoard(id)
    if (!board) throw notFound()
    return board
  }

  async getCardOr404(id: number): Promise<KanbanCard> {
    const card = await this.repo.getCard(id)
    if (!card) throw notFound()
    return card
  }

  private async boardDict(board: KanbanBoard) {
    return kanbanBoardToDict(board, await this.repo.cardsOfBoard(board.id), true)
  }

  // ── 看板列 ──────────────────────────────────────────────────────────

  async getAllBoards() {
    const boards = await this.repo.allBoards()
    const out = []
    for (const b of boards) out.push(await this.boardDict(b))
    return out
  }

  async createBoard(data: Data) {
    const title = strOrEmpty(data.title)
    const boardCode = strOrEmpty(data.board_code)
    if (!title) throw new ServiceError('列标题不能为空')
    if (!boardCode) throw new ServiceError('列编码不能为空')
    if (await this.repo.getBoardByCode(boardCode)) throw new ServiceError('列编码已存在')

    const payload = {
      title,
      board_code: boardCode,
      color: colorOrDefault(data.color),
      sort_order: parseIntOr(data.sort_order, 0),
      wip_limit: parseIntOr(data.wip_limit, 0),
      is_active: parseBool(data.is_active, true),
    }

    for (let attempt = 0; ; attempt += 1) {
      try {
        const board = await this.repo.insertBoard(payload)
        return kanbanBoardToDict(board, [], true)
      } catch (err) {
        if (attempt === 0 && isSequenceConflict(err, 'kanban_boards_pkey')) {
          await this.repo.syncIdSequence('kanban_boards')
          continue
        }
        throw err
      }
    }
  }

  async updateBoard(board: KanbanBoard, data: Data) {
    if (hasKey(data, 'title') && !strOrEmpty(data.title)) throw new ServiceError('列标题不能为空')

    const patch: KanbanBoardPatch = {}
    if (hasKey(data, 'title')) patch.title = strOrEmpty(data.title)
    if (hasKey(data, 'color')) patch.color = colorOrDefault(data.color)
    if (hasKey(data, 'sort_order')) patch.sort_order = parseIntOr(data.sort_order, board.sort_order || 0)
    if (hasKey(data, 'wip_limit')) patch.wip_limit = parseIntOr(data.wip_limit, board.wip_limit || 0)
    if (hasKey(data, 'is_active')) patch.is_active = parseBool(data.is_active, board.is_active)

    const changed = changedFields(board, patch)
    if (Object.keys(changed).length > 0) await this.repo.updateBoard(board.id, changed)
    return this.boardDict((await this.repo.getBoard(board.id))!)
  }

  async deleteBoard(board: KanbanBoard) {
    await this.repo.deleteBoard(board.id)
    return { message: '删除成功' }
  }

  // ── 卡片 ────────────────────────────────────────────────────────────

  async createCard(data: Data) {
    const title = strOrEmpty(data.title)
    let cardCode = strOrEmpty(data.card_code)
    const boardId = parseIntOr(data.board_id, 0)

    if (!title) throw new ServiceError('卡片标题不能为空')
    if (!cardCode) cardCode = `card_${uuidHex(8)}`
    if (!boardId) throw new ServiceError('所属列不存在')
    await this.getBoardOr404(boardId)
    if (await this.repo.getCardByCode(cardCode)) cardCode = `card_${uuidHex(10)}`

    const payload = {
      board_id: boardId,
      title,
      card_code: cardCode,
      description: strOrNull(data.description),
      priority: normalizePriority(data.priority),
      assignee: strOrNull(data.assignee),
      due_date: parseLooseDate(data.due_date),
      tags: strOrNull(data.tags),
      sort_order: parseIntOr(data.sort_order, 0),
      is_active: parseBool(data.is_active, true),
    }

    for (let attempt = 0; ; attempt += 1) {
      try {
        return kanbanCardToDict(await this.repo.insertCard(payload))
      } catch (err) {
        if (attempt === 0 && isSequenceConflict(err, 'kanban_cards_pkey')) {
          await this.repo.syncIdSequence('kanban_cards')
          continue
        }
        throw err
      }
    }
  }

  async updateCard(card: KanbanCard, data: Data) {
    if (hasKey(data, 'title') && !strOrEmpty(data.title)) throw new ServiceError('卡片标题不能为空')

    const patch: KanbanCardPatch = {}
    if (hasKey(data, 'board_id')) {
      const boardId = parseIntOr(data.board_id, 0)
      if (boardId) {
        await this.getBoardOr404(boardId)
        patch.board_id = boardId
      }
    }
    if (hasKey(data, 'title')) patch.title = strOrEmpty(data.title)
    if (hasKey(data, 'description')) patch.description = strOrNull(data.description)
    if (hasKey(data, 'assignee')) patch.assignee = strOrNull(data.assignee)
    if (hasKey(data, 'tags')) patch.tags = strOrNull(data.tags)
    if (hasKey(data, 'sort_order')) patch.sort_order = parseIntOr(data.sort_order, card.sort_order || 0)
    if (hasKey(data, 'is_active')) patch.is_active = parseBool(data.is_active, card.is_active)
    if (hasKey(data, 'priority')) patch.priority = normalizePriority(data.priority)
    if (hasKey(data, 'due_date')) patch.due_date = parseLooseDate(data.due_date)

    const changed = changedFields(card, patch)
    if (Object.keys(changed).length > 0) await this.repo.updateCard(card.id, changed)
    return kanbanCardToDict((await this.repo.getCard(card.id))!)
  }

  async deleteCard(card: KanbanCard) {
    await this.repo.deleteCard(card.id)
    return { message: '删除成功' }
  }

  /** 批量更新卡片的 board_id 和 sort_order（事务内，一次批量查询） */
  async reorderCards(items: unknown) {
    if (!Array.isArray(items)) throw new ServiceError('参数格式错误，需要数组')
    try {
      return await this.db.transaction(async (tx) => {
        const repo = new KanbanRepository(tx)
        // item.get(...)：元素不是 dict 时 Python 抛 AttributeError → 500
        const get = (item: unknown, key: string): unknown => {
          if (!isPlainObject(item)) throw new ServiceError(`'${typeof item}' object has no attribute 'get'`, 500)
          return item[key]
        }
        const cardIds = items.map((item) => parseIntOr(get(item, 'id'), 0)).filter((id) => id)
        const boardIds = [...new Set(items.map((item) => parseIntOr(get(item, 'board_id'), 0)))].filter((id) => id !== 0)

        const cardsById = new Map<number, KanbanCard>()
        if (cardIds.length > 0) for (const c of await repo.listCardsByIds(cardIds)) cardsById.set(c.id, c)
        if (boardIds.length > 0) {
          const existing = new Set(await repo.listBoardIds(boardIds))
          if (boardIds.some((id) => !existing.has(id))) throw new ServiceError('目标列不存在')
        }

        // 同一张卡片出现多次时以最后一次为准（对应 ORM 对象上的多次赋值、commit 时一次 flush）
        const finalPatch = new Map<number, KanbanCardPatch>()
        for (const item of items) {
          const cardId = parseIntOr(get(item, 'id'), 0)
          const boardId = parseIntOr(get(item, 'board_id'), 0)
          const sortOrder = parseIntOr(get(item, 'sort_order'), 0)
          const card = cardsById.get(cardId)
          if (card) {
            const patch = finalPatch.get(card.id) ?? {}
            if (boardId) patch.board_id = boardId
            patch.sort_order = sortOrder
            finalPatch.set(card.id, patch)
          }
        }
        for (const [id, patch] of finalPatch) {
          const changed = changedFields(cardsById.get(id)!, patch)
          if (Object.keys(changed).length > 0) await repo.updateCard(id, changed)
        }
        return { message: '排序已保存' }
      })
    } catch (err) {
      if (err instanceof ServiceError) throw err
      throw new ServiceError(err instanceof Error ? err.message : String(err), 500)
    }
  }
}
