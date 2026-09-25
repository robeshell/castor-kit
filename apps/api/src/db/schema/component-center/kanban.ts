/**
 * kanban_boards / kanban_cards
 *
 * 由 drizzle-kit pull 生成后整理。color/sort_order 等列在现库里有 DB DEFAULT（.default()）；
 * created_at/updated_at 是应用侧默认值，用 ../columns 的 createdAt()/updatedAt()。
 */

import { relations } from 'drizzle-orm'
import { boolean, date, foreignKey, integer, pgTable, serial, text, unique, varchar } from 'drizzle-orm/pg-core'
import { toIso } from '@/common/serialize'
import { createdAt, updatedAt } from '../columns'

export const kanban_boards = pgTable('kanban_boards', {
  id: serial().primaryKey().notNull(),
  title: varchar({ length: 100 }).notNull(),
  board_code: varchar({ length: 50 }).notNull(),
  color: varchar({ length: 20 }).default('#4080FF'),
  sort_order: integer().default(0),
  wip_limit: integer().default(0),
  is_active: boolean().default(true),
  created_at: createdAt(),
  updated_at: updatedAt(),
}, (table) => [
  unique('kanban_boards_board_code_key').on(table.board_code),
])

export const kanban_cards = pgTable('kanban_cards', {
  id: serial().primaryKey().notNull(),
  board_id: integer().notNull(),
  title: varchar({ length: 200 }).notNull(),
  card_code: varchar({ length: 80 }).notNull(),
  description: text(),
  priority: varchar({ length: 20 }).default('medium'),
  assignee: varchar({ length: 100 }),
  due_date: date({ mode: 'string' }),
  tags: varchar({ length: 200 }),
  sort_order: integer().default(0),
  is_active: boolean().default(true),
  created_at: createdAt(),
  updated_at: updatedAt(),
}, (table) => [
  foreignKey({
      columns: [table.board_id],
      foreignColumns: [kanban_boards.id],
      name: 'kanban_cards_board_id_fkey'
    }).onDelete('cascade'),
  unique('kanban_cards_card_code_key').on(table.card_code),
])

export const kanbanBoardsRelations = relations(kanban_boards, ({ many }) => ({
  cards: many(kanban_cards),
}))

export const kanbanCardsRelations = relations(kanban_cards, ({ one }) => ({
  board: one(kanban_boards, { fields: [kanban_cards.board_id], references: [kanban_boards.id] }),
}))

export type KanbanBoard = typeof kanban_boards.$inferSelect
export type KanbanCard = typeof kanban_cards.$inferSelect

/** 看板卡片输出 */
export function kanbanCardToDict(card: KanbanCard) {
  return {
    id: card.id,
    board_id: card.board_id,
    title: card.title,
    card_code: card.card_code,
    description: card.description,
    priority: card.priority || 'medium',
    assignee: card.assignee,
    due_date: card.due_date || null,
    tags: card.tags || '',
    sort_order: card.sort_order ?? 0,
    is_active: card.is_active,
    created_at: toIso(card.created_at),
    updated_at: toIso(card.updated_at),
  }
}

/**
 * 看板列输出：cards 为该列按 sort_order 排好序的卡片
 * （cards_count 为该列卡片数，与卡片列表同一过滤条件）；includeCards=false 时不附带 cards。
 */
export function kanbanBoardToDict(board: KanbanBoard, cards: KanbanCard[], includeCards = true) {
  const d: Record<string, unknown> = {
    id: board.id,
    title: board.title,
    board_code: board.board_code,
    color: board.color || '#4080FF',
    sort_order: board.sort_order ?? 0,
    wip_limit: board.wip_limit ?? 0,
    is_active: board.is_active,
    cards_count: cards.length,
    created_at: toIso(board.created_at),
    updated_at: toIso(board.updated_at),
  }
  if (includeCards) d.cards = cards.map(kanbanCardToDict)
  return d
}
