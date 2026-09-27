import request from '@/shared/api/request'
import type { ApiBody, ApiItem, ApiQuery, ApiResponse } from '@/shared/api/types'

/** A record of the stats list demo (times are ISO 8601 UTC) */
export type StatsListPageItem = ApiItem<'/api/admin/component-center/stats-list-page'>
/** Summary cards and per-category totals */
export type StatsListPageStats = ApiResponse<'/api/admin/component-center/stats-list-page/stats'>

export const getStatsListPageStats = () => request.get<unknown, StatsListPageStats>('/admin/component-center/stats-list-page/stats')
export const getStatsListPageList = (params?: ApiQuery<'/api/admin/component-center/stats-list-page'>) =>
  request.get<unknown, ApiResponse<'/api/admin/component-center/stats-list-page'>>('/admin/component-center/stats-list-page', { params })
export const getStatsListPageDetail = (id: number) =>
  request.get<unknown, ApiResponse<'/api/admin/component-center/stats-list-page/{item_id}'>>(`/admin/component-center/stats-list-page/${id}`)
export const createStatsListPage = (data: ApiBody<'/api/admin/component-center/stats-list-page', 'post'>) =>
  request.post<unknown, ApiResponse<'/api/admin/component-center/stats-list-page', 'post'>>('/admin/component-center/stats-list-page', data)
export const updateStatsListPage = (id: number, data: ApiBody<'/api/admin/component-center/stats-list-page/{item_id}', 'put'>) =>
  request.put<unknown, ApiResponse<'/api/admin/component-center/stats-list-page/{item_id}', 'put'>>(`/admin/component-center/stats-list-page/${id}`, data)
export const deleteStatsListPage = (id: number) =>
  request.delete<unknown, ApiResponse<'/api/admin/component-center/stats-list-page/{item_id}', 'delete'>>(`/admin/component-center/stats-list-page/${id}`)

export const exportStatsListPage = (data: ApiBody<'/api/admin/component-center/stats-list-page/export', 'post'>) =>
  request.post<unknown, Blob>('/admin/component-center/stats-list-page/export', data, { responseType: 'blob' })

export const downloadStatsListPageTemplate = (
  fileType: ApiQuery<'/api/admin/component-center/stats-list-page/template'>['file_type'] = 'csv'
) =>
  request.get<unknown, Blob>('/admin/component-center/stats-list-page/template', {
    params: { file_type: fileType },
    responseType: 'blob',
  })

export const importStatsListPage = (file: Blob) => {
  const formData = new FormData()
  formData.append('file', file)
  return request.post<unknown, ApiResponse<'/api/admin/component-center/stats-list-page/import', 'post'>>(
    '/admin/component-center/stats-list-page/import',
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
    }
  )
}
