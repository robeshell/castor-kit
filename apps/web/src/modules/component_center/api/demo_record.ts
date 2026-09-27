import request from '@/shared/api/request'
import type { ApiBody, ApiItem, ApiQuery, ApiResponse } from '@/shared/api/types'

/** A record as the API returns it (times are ISO 8601 UTC, decimals are strings) */
export type DemoRecord = ApiItem<'/api/admin/component-center/demo-records'>
/** Create body (edit takes any subset of the same fields) */
export type DemoRecordBody = ApiBody<'/api/admin/component-center/demo-records', 'post'>
/** Export request: ids (none = every row), fields (none = every column), file_type */
export type DemoRecordExportBody = ApiBody<'/api/admin/component-center/demo-records/export', 'post'>
/** File type of exports and the import template */
export type DemoRecordFileType = NonNullable<ApiQuery<'/api/admin/component-center/demo-records/template'>['file_type']>

const BASE = '/admin/component-center/demo-records'

export const getItems = (params?: ApiQuery<'/api/admin/component-center/demo-records'>) => request.get<unknown, ApiResponse<'/api/admin/component-center/demo-records'>>(BASE, { params })
export const createItem = (data: DemoRecordBody) => request.post<unknown, ApiResponse<'/api/admin/component-center/demo-records', 'post'>>(BASE, data)
export const updateItem = (id: number, data: ApiBody<'/api/admin/component-center/demo-records/{item_id}', 'put'>) =>
  request.put<unknown, ApiResponse<'/api/admin/component-center/demo-records/{item_id}', 'put'>>(`${BASE}/${id}`, data)
export const deleteItem = (id: number) => request.delete<unknown, ApiResponse<'/api/admin/component-center/demo-records/{item_id}', 'delete'>>(`${BASE}/${id}`)

export const exportItems = (data: DemoRecordExportBody) =>
  request.post<unknown, Blob>(`${BASE}/export`, data, { responseType: 'blob' })

export const downloadTemplate = (fileType: DemoRecordFileType = 'xlsx') =>
  request.get<unknown, Blob>(`${BASE}/template`, { params: { file_type: fileType }, responseType: 'blob' })

export const importItems = (file: Blob) => {
  const formData = new FormData()
  formData.append('file', file)
  return request.post<unknown, ApiResponse<'/api/admin/component-center/demo-records/import', 'post'>>(`${BASE}/import`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}
