/**
 * Kanban page service layer
 */

import { randomUUID } from 'node:crypto'
import { writeError } from '@/common/db-errors'
import { ServiceError } from '@/common/errors'
import { notFound } from '@/common/http'
import { changedFields } from '@/common/validation'
import type { Db } from '@/db/client'
import { kanbanBoardToDict, kanbanCardToDict, type KanbanBoard, type KanbanCard } from '@/db/schema'
import type { z } from 'zod'
import { KanbanRepository, type KanbanCardPatch } from './repository'
import type { BoardInput, CardInput, reorderItem } from './schema'

const DEFAULT_COLOR = '#4080FF'

/** n random hex characters (generated card codes) */
function uuidHex(n: number): string {
  return randomUUID().replace(/-/g, '').slice(0, n)
}

/** The driver-level pg error (drizzle wraps it in cause) */
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

/** A primary-key conflict: the id sequence lags behind rows inserted with explicit ids (the demo seed) */
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

  // ── Kanban columns ──────────────────────────────────────────────────────────

  async getAllBoards() {
    const boards = await this.repo.allBoards()
    const out = []
    for (const b of boards) out.push(await this.boardDict(b))
    return out
  }

  async createBoard(values: BoardInput) {
    if (await this.repo.getBoardByCode(values.board_code)) throw new ServiceError('列编码已存在')
    const payload = { ...values, color: values.color ?? DEFAULT_COLOR }

    for (let attempt = 0; ; attempt += 1) {
      try {
        const board = await this.repo.insertBoard(payload)
        return kanbanBoardToDict(board, [], true)
      } catch (err) {
        if (attempt === 0 && isSequenceConflict(err, 'kanban_boards_pkey')) {
          await this.repo.syncIdSequence('kanban_boards')
          continue
        }
        throw writeError(err)
      }
    }
  }

  async updateBoard(board: KanbanBoard, values: Partial<BoardInput>) {
    const patch = values.color === null ? { ...values, color: DEFAULT_COLOR } : values
    const changed = changedFields(board, patch)
    if (Object.keys(changed).length > 0) await this.repo.updateBoard(board.id, changed)
    return this.boardDict((await this.repo.getBoard(board.id))!)
  }

  async deleteBoard(board: KanbanBoard) {
    await this.repo.deleteBoard(board.id)
    return { message: '删除成功' }
  }

  // ── Cards ────────────────────────────────────────────────────────────

  async createCard(values: CardInput) {
    if (values.board_id === null) throw new ServiceError('所属列不存在')
    await this.getBoardOr404(values.board_id)
    // A missing or taken code gets a generated one
    let cardCode = values.card_code ?? `card_${uuidHex(8)}`
    if (await this.repo.getCardByCode(cardCode)) cardCode = `card_${uuidHex(10)}`
    const payload = { ...values, board_id: values.board_id, card_code: cardCode }

    for (let attempt = 0; ; attempt += 1) {
      try {
        return kanbanCardToDict(await this.repo.insertCard(payload))
      } catch (err) {
        if (attempt === 0 && isSequenceConflict(err, 'kanban_cards_pkey')) {
          await this.repo.syncIdSequence('kanban_cards')
          continue
        }
        throw writeError(err)
      }
    }
  }

  async updateCard(card: KanbanCard, values: Partial<CardInput>) {
    const { board_id: boardId, ...rest } = values
    const patch: KanbanCardPatch = { ...rest }
    // Moving to another column: it must exist (null leaves the card where it is)
    if (boardId !== undefined && boardId !== null) {
      await this.getBoardOr404(boardId)
      patch.board_id = boardId
    }
    const changed = changedFields(card, patch)
    if (Object.keys(changed).length > 0) await this.repo.updateCard(card.id, changed)
    return kanbanCardToDict((await this.repo.getCard(card.id))!)
  }

  async deleteCard(card: KanbanCard) {
    await this.repo.deleteCard(card.id)
    return { message: '删除成功' }
  }

  /** Batch-update cards' column and position (one transaction); entries without a card id are skipped */
  async reorderCards(items: z.output<typeof reorderItem>[]) {
    try {
      return await this.db.transaction(async (tx) => {
        const repo = new KanbanRepository(tx)
        const cardIds = items.flatMap((item) => (item.id === null ? [] : [item.id]))
        const boardIds = [...new Set(items.flatMap((item) => (item.board_id === null ? [] : [item.board_id])))]

        const cardsById = new Map<number, KanbanCard>()
        if (cardIds.length > 0) for (const c of await repo.listCardsByIds(cardIds)) cardsById.set(c.id, c)
        if (boardIds.length > 0) {
          const existing = new Set(await repo.listBoardIds(boardIds))
          if (boardIds.some((id) => !existing.has(id))) throw new ServiceError('目标列不存在')
        }

        // A card listed more than once: the last entry wins
        const finalPatch = new Map<number, KanbanCardPatch>()
        for (const item of items) {
          const card = item.id === null ? undefined : cardsById.get(item.id)
          if (!card) continue
          const patch = finalPatch.get(card.id) ?? {}
          if (item.board_id !== null) patch.board_id = item.board_id
          patch.sort_order = item.sort_order
          finalPatch.set(card.id, patch)
        }
        for (const [id, patch] of finalPatch) {
          const changed = changedFields(cardsById.get(id)!, patch)
          if (Object.keys(changed).length > 0) await repo.updateCard(id, changed)
        }
        return { message: '排序已保存' }
      })
    } catch (err) {
      throw writeError(err)
    }
  }
}
