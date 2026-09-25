import request from '@/shared/api/request'

// ── Board columns ──────────────────────────────────────
export const getKanbanBoards = () =>
  request.get('/admin/component-center/kanban/boards')

export const createKanbanBoard = (data) =>
  request.post('/admin/component-center/kanban/boards', data)

export const updateKanbanBoard = (id, data) =>
  request.put(`/admin/component-center/kanban/boards/${id}`, data)

export const deleteKanbanBoard = (id) =>
  request.delete(`/admin/component-center/kanban/boards/${id}`)

// ── Cards ───────────────────────────────────────────────
export const createKanbanCard = (data) =>
  request.post('/admin/component-center/kanban/cards', data)

export const updateKanbanCard = (id, data) =>
  request.put(`/admin/component-center/kanban/cards/${id}`, data)

export const deleteKanbanCard = (id) =>
  request.delete(`/admin/component-center/kanban/cards/${id}`)

export const reorderKanbanCards = (items) =>
  request.put('/admin/component-center/kanban/cards/reorder', items)
