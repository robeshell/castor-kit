import request from '@/shared/api/request'
import type { ApiBody, ApiItem, ApiQuery, ApiResponse } from '@/shared/api/types'

/** A saved query of the list page demo (times are ISO 8601 UTC) */
export type ListPageItem = ApiItem<'/api/admin/component-center/list-page'>

/** Create / update bodies (display_config / permission_config are JSON objects; schema_config a JSON string or object) */
export type ListPageCreateInput = ApiBody<'/api/admin/component-center/list-page', 'post'>
export type ListPageUpdateInput = ApiBody<'/api/admin/component-center/list-page/{item_id}', 'put'>
/** Export body: selected ids, or the list filters (export_mode) */
export type ListPageExportBody = ApiBody<'/api/admin/component-center/list-page/export', 'post'>

export const getListPageList = (params?: ApiQuery<'/api/admin/component-center/list-page'>) =>
  request.get<unknown, ApiResponse<'/api/admin/component-center/list-page'>>('/admin/component-center/list-page', { params })
export const getListPageDetail = (id: number) =>
  request.get<unknown, ApiResponse<'/api/admin/component-center/list-page/{item_id}'>>(`/admin/component-center/list-page/${id}`)
export const createListPage = (data: ListPageCreateInput) =>
  request.post<unknown, ApiResponse<'/api/admin/component-center/list-page', 'post'>>('/admin/component-center/list-page', data)
export const updateListPage = (id: number, data: ListPageUpdateInput) =>
  request.put<unknown, ApiResponse<'/api/admin/component-center/list-page/{item_id}', 'put'>>(`/admin/component-center/list-page/${id}`, data)
export const deleteListPage = (id: number) =>
  request.delete<unknown, ApiResponse<'/api/admin/component-center/list-page/{item_id}', 'delete'>>(`/admin/component-center/list-page/${id}`)

export const exportListPage = (data: ListPageExportBody) =>
  request.post<unknown, Blob>('/admin/component-center/list-page/export', data, { responseType: 'blob' })

export const downloadListPageTemplate = (fileType: ApiQuery<'/api/admin/component-center/list-page/template'>['file_type'] = 'csv') =>
  request.get<unknown, Blob>('/admin/component-center/list-page/template', {
    params: { file_type: fileType },
    responseType: 'blob',
  })

export const importListPage = (file: Blob) => {
  const formData = new FormData()
  formData.append('file', file)
  return request.post<unknown, ApiResponse<'/api/admin/component-center/list-page/import', 'post'>>(
    '/admin/component-center/list-page/import',
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
    }
  )
}
