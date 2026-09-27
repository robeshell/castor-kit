import request from '@/shared/api/request'
import type { ApiBody, ApiItem, ApiQuery, ApiResponse } from '@/shared/api/types'

/** A row of the advanced table demo (times are ISO 8601 UTC) */
export type AdvancedTableRow = ApiItem<'/api/admin/component-center/advanced-table/rows'>
/** Summary cards above the table */
export type AdvancedTableStats = ApiResponse<'/api/admin/component-center/advanced-table/stats'>

export const getAdvancedTableStats = () =>
  request.get<unknown, AdvancedTableStats>('/admin/component-center/advanced-table/stats')

export const getAdvancedTableRows = (params?: ApiQuery<'/api/admin/component-center/advanced-table/rows'>) =>
  request.get<unknown, ApiResponse<'/api/admin/component-center/advanced-table/rows'>>('/admin/component-center/advanced-table/rows', { params })

export const createAdvancedTableRow = (data: ApiBody<'/api/admin/component-center/advanced-table/rows', 'post'>) =>
  request.post<unknown, ApiResponse<'/api/admin/component-center/advanced-table/rows', 'post'>>('/admin/component-center/advanced-table/rows', data)

export const updateAdvancedTableRow = (id: number, data: ApiBody<'/api/admin/component-center/advanced-table/rows/{item_id}', 'put'>) =>
  request.put<unknown, ApiResponse<'/api/admin/component-center/advanced-table/rows/{item_id}', 'put'>>(
    `/admin/component-center/advanced-table/rows/${id}`,
    data
  )

export const deleteAdvancedTableRow = (id: number) =>
  request.delete<unknown, ApiResponse<'/api/admin/component-center/advanced-table/rows/{item_id}', 'delete'>>(
    `/admin/component-center/advanced-table/rows/${id}`
  )

export const reorderAdvancedTableRows = (items: ApiBody<'/api/admin/component-center/advanced-table/rows/reorder', 'put'>) =>
  request.put<unknown, ApiResponse<'/api/admin/component-center/advanced-table/rows/reorder', 'put'>>(
    '/admin/component-center/advanced-table/rows/reorder',
    items
  )

export const batchUpdateAdvancedTableRows = (data: ApiBody<'/api/admin/component-center/advanced-table/rows/batch-update', 'post'>) =>
  request.post<unknown, ApiResponse<'/api/admin/component-center/advanced-table/rows/batch-update', 'post'>>(
    '/admin/component-center/advanced-table/rows/batch-update',
    data
  )

export const batchDeleteAdvancedTableRows = (data: ApiBody<'/api/admin/component-center/advanced-table/rows/batch-delete', 'post'>) =>
  request.post<unknown, ApiResponse<'/api/admin/component-center/advanced-table/rows/batch-delete', 'post'>>(
    '/admin/component-center/advanced-table/rows/batch-delete',
    data
  )
