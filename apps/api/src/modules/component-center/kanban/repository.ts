/**
 * 看板页 repository 层（对齐 AuraStack backend/app/component_center/crud/kanban_page.py）
 */

import { asc, eq, inArray, sql } from 'drizzle-orm'
import type { Executor } from '@/db/client'
import { kanban_boards, kanban_cards, type KanbanBoard, type KanbanCard } from '@/db/schema'

const INT32_MIN = -2_147_483_648
const INT32_MAX = 2_147_483_647

/** 超出 integer 范围的 id 在 Python 侧按 bigint 比较、查不到；这里直接视为不存在（避免驱动报 out of range） */
export function isInt32(id: number): boolean {
  return Number.isInteger(id) && id >= INT32_MIN && id <= INT32_MAX
}

export type KanbanBoardInsert = typeof kanban_boards.$inferInsert
export type KanbanCardInsert = typeof kanban_cards.$inferInsert
export type KanbanBoardPatch = Partial<Pick<KanbanBoard, 'title' | 'color' | 'sort_order' | 'wip_limit' | 'is_active'>>
export type KanbanCardPatch = Partial<
  Pick<KanbanCard, 'board_id' | 'title' | 'description' | 'assignee' | 'tags' | 'sort_order' | 'is_active' | 'priority' | 'due_date'>
>

export class KanbanRepository {
  constructor(private readonly db: Executor) {}

  async allBoards(): Promise<KanbanBoard[]> {
    return this.db.select().from(kanban_boards).orderBy(asc(kanban_boards.sort_order))
  }

  /** `board.cards.order_by(KanbanCard.sort_order)`（逐列查询，与 Python 的查询形状一致） */
  async cardsOfBoard(boardId: number): Promise<KanbanCard[]> {
    return this.db
      .select()
      .from(kanban_cards)
      .where(eq(kanban_cards.board_id, boardId))
      .orderBy(asc(kanban_cards.sort_order))
  }

  async getBoard(id: number): Promise<KanbanBoard | null> {
    if (!isInt32(id)) return null
    const [row] = await this.db.select().from(kanban_boards).where(eq(kanban_boards.id, id))
    return row ?? null
  }

  async getCard(id: number): Promise<KanbanCard | null> {
    if (!isInt32(id)) return null
    const [row] = await this.db.select().from(kanban_cards).where(eq(kanban_cards.id, id))
    return row ?? null
  }

  async getBoardByCode(code: string): Promise<KanbanBoard | null> {
    const [row] = await this.db.select().from(kanban_boards).where(eq(kanban_boards.board_code, code)).limit(1)
    return row ?? null
  }

  async getCardByCode(code: string): Promise<KanbanCard | null> {
    const [row] = await this.db.select().from(kanban_cards).where(eq(kanban_cards.card_code, code)).limit(1)
    return row ?? null
  }

  async listCardsByIds(ids: number[]): Promise<KanbanCard[]> {
    const valid = ids.filter(isInt32)
    if (valid.length === 0) return []
    return this.db.select().from(kanban_cards).where(inArray(kanban_cards.id, valid))
  }

  async listBoardIds(ids: number[]): Promise<number[]> {
    const valid = ids.filter(isInt32)
    if (valid.length === 0) return []
    const rows = await this.db.select({ id: kanban_boards.id }).from(kanban_boards).where(inArray(kanban_boards.id, valid))
    return rows.map((r) => r.id)
  }

  async insertBoard(values: KanbanBoardInsert): Promise<KanbanBoard> {
    const [row] = await this.db.insert(kanban_boards).values(values).returning()
    return row!
  }

  async insertCard(values: KanbanCardInsert): Promise<KanbanCard> {
    const [row] = await this.db.insert(kanban_cards).values(values).returning()
    return row!
  }

  async updateBoard(id: number, patch: KanbanBoardPatch): Promise<void> {
    await this.db.update(kanban_boards).set(patch).where(eq(kanban_boards.id, id))
  }

  async updateCard(id: number, patch: KanbanCardPatch): Promise<void> {
    await this.db.update(kanban_cards).set(patch).where(eq(kanban_cards.id, id))
  }

  async deleteBoard(id: number): Promise<void> {
    await this.db.delete(kanban_boards).where(eq(kanban_boards.id, id))
  }

  async deleteCard(id: number): Promise<void> {
    await this.db.delete(kanban_cards).where(eq(kanban_cards.id, id))
  }

  /** `_sync_postgres_id_sequence`：主键序列落后时同步到 MAX(id)+1（表名来自白名单） */
  async syncIdSequence(table: 'kanban_boards' | 'kanban_cards'): Promise<void> {
    await this.db.execute(
      sql.raw(
        `SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE((SELECT MAX(id) FROM ${table}), 0) + 1, false)`,
      ),
    )
  }
}
