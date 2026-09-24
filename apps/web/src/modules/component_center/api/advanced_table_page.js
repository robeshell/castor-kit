import request from '@/shared/api/request'

export const getAdvancedTableStats = () =>
  request.get('/admin/component-center/advanced-table/stats')

export const getAdvancedTableRows = (params) =>
  request.get('/admin/component-center/advanced-table/rows', { params })

export const createAdvancedTableRow = (data) =>
  request.post('/admin/component-center/advanced-table/rows', data)

export const updateAdvancedTableRow = (id, data) =>
  request.put(`/admin/component-center/advanced-table/rows/${id}`, data)

export const deleteAdvancedTableRow = (id) =>
  request.delete(`/admin/component-center/advanced-table/rows/${id}`)

export const reorderAdvancedTableRows = (items) =>
  request.put('/admin/component-center/advanced-table/rows/reorder', items)

export const batchUpdateAdvancedTableRows = (data) =>
  request.post('/admin/component-center/advanced-table/rows/batch-update', data)

export const batchDeleteAdvancedTableRows = (data) =>
  request.post('/admin/component-center/advanced-table/rows/batch-delete', data)
