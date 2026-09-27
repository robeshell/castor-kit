import request from '@/shared/api/request'
import type { ApiBody, ApiResponse } from '@/shared/api/types'

/** A board column with its cards (times are ISO 8601 UTC) */
export type KanbanBoard = ApiResponse<'/api/admin/component-center/kanban/boards'>[number]
/** A card on a board */
export type KanbanCard = ApiResponse<'/api/admin/component-center/kanban/cards', 'post'>

// ── Board columns ──────────────────────────────────────
export const getKanbanBoards = () =>
  request.get<unknown, ApiResponse<'/api/admin/component-center/kanban/boards'>>('/admin/component-center/kanban/boards')

export const createKanbanBoard = (data: ApiBody<'/api/admin/component-center/kanban/boards', 'post'>) =>
  request.post<unknown, ApiResponse<'/api/admin/component-center/kanban/boards', 'post'>>('/admin/component-center/kanban/boards', data)

export const updateKanbanBoard = (id: number, data: ApiBody<'/api/admin/component-center/kanban/boards/{board_id}', 'put'>) =>
  request.put<unknown, ApiResponse<'/api/admin/component-center/kanban/boards/{board_id}', 'put'>>(
    `/admin/component-center/kanban/boards/${id}`,
    data
  )

export const deleteKanbanBoard = (id: number) =>
  request.delete<unknown, ApiResponse<'/api/admin/component-center/kanban/boards/{board_id}', 'delete'>>(
    `/admin/component-center/kanban/boards/${id}`
  )

// ── Cards ───────────────────────────────────────────────
export const createKanbanCard = (data: ApiBody<'/api/admin/component-center/kanban/cards', 'post'>) =>
  request.post<unknown, KanbanCard>('/admin/component-center/kanban/cards', data)

export const updateKanbanCard = (id: number, data: ApiBody<'/api/admin/component-center/kanban/cards/{card_id}', 'put'>) =>
  request.put<unknown, ApiResponse<'/api/admin/component-center/kanban/cards/{card_id}', 'put'>>(
    `/admin/component-center/kanban/cards/${id}`,
    data
  )

export const deleteKanbanCard = (id: number) =>
  request.delete<unknown, ApiResponse<'/api/admin/component-center/kanban/cards/{card_id}', 'delete'>>(
    `/admin/component-center/kanban/cards/${id}`
  )

export const reorderKanbanCards = (items: ApiBody<'/api/admin/component-center/kanban/cards/reorder', 'put'>) =>
  request.put<unknown, ApiResponse<'/api/admin/component-center/kanban/cards/reorder', 'put'>>(
    '/admin/component-center/kanban/cards/reorder',
    items
  )
