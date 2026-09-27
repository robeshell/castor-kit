import request from '@/shared/api/request'
import type { ApiBody, ApiItem, ApiQuery, ApiResponse } from '@/shared/api/types'

/** A dictionary type (times are ISO 8601 UTC) */
export type DictType = ApiItem<'/api/admin/dicts'>
/** A dictionary type with its items (`include_items`) */
export type DictTypeDetail = ApiResponse<'/api/admin/dicts/{dict_id}'>
/** A dictionary item (with its type's code and name) */
export type DictItem = ApiItem<'/api/admin/dicts/{dict_id}/items'>
/** Options of several dictionaries, keyed by dictionary code */
export type DictOptions = ApiResponse<'/api/admin/dicts/options'>

/**
 * Create / edit bodies of dictionary types and items.
 * TODO(openapi): the backend reads sort_order with field.int('排序', 0) (apps/api/src/modules/admin/dicts/schema.ts), so
 * null (a cleared number input) is accepted and saved as 0; the doc has `sort_order?: number`.
 */
export type DictTypeBody = Omit<ApiBody<'/api/admin/dicts', 'post'>, 'sort_order'> & { sort_order?: number | null }
export type DictTypeUpdateBody = Omit<ApiBody<'/api/admin/dicts/{dict_id}', 'put'>, 'sort_order'> & { sort_order?: number | null }
export type DictItemBody = Omit<ApiBody<'/api/admin/dicts/{dict_id}/items', 'post'>, 'sort_order'> & { sort_order?: number | null }
export type DictItemUpdateBody = Omit<ApiBody<'/api/admin/dicts/items/{item_id}', 'put'>, 'sort_order'> & { sort_order?: number | null }

export const getDictTypes = (params?: ApiQuery<'/api/admin/dicts'>) =>
  request.get<unknown, ApiResponse<'/api/admin/dicts'>>('/admin/dicts', { params })
export const getDictTypeDetail = (id: number, params?: ApiQuery<'/api/admin/dicts/{dict_id}'>) =>
  request.get<unknown, DictTypeDetail>(`/admin/dicts/${id}`, { params })
export const getDictOptions = (codes: string | string[]) => request.get<unknown, DictOptions>('/admin/dicts/options', {
  params: { codes: Array.isArray(codes) ? codes.join(',') : codes },
})
export const createDictType = (data: DictTypeBody) =>
  request.post<unknown, ApiResponse<'/api/admin/dicts', 'post'>>('/admin/dicts', data)
export const updateDictType = (id: number, data: DictTypeUpdateBody) =>
  request.put<unknown, ApiResponse<'/api/admin/dicts/{dict_id}', 'put'>>(`/admin/dicts/${id}`, data)
export const deleteDictType = (id: number) =>
  request.delete<unknown, ApiResponse<'/api/admin/dicts/{dict_id}', 'delete'>>(`/admin/dicts/${id}`)

export const getDictItems = (dictId: number, params?: ApiQuery<'/api/admin/dicts/{dict_id}/items'>) =>
  request.get<unknown, ApiResponse<'/api/admin/dicts/{dict_id}/items'>>(`/admin/dicts/${dictId}/items`, { params })
export const exportDictItems = (dictId: number, fileType: ApiQuery<'/api/admin/dicts/{dict_id}/items/export'>['file_type'] = 'csv') =>
  request.get<unknown, Blob>(`/admin/dicts/${dictId}/items/export`, {
    params: { file_type: fileType },
    responseType: 'blob',
  })
export const downloadDictItemsTemplate = (
  dictId: number,
  fileType: ApiQuery<'/api/admin/dicts/{dict_id}/items/template'>['file_type'] = 'csv'
) =>
  request.get<unknown, Blob>(`/admin/dicts/${dictId}/items/template`, {
    params: { file_type: fileType },
    responseType: 'blob',
  })
export const importDictItems = (dictId: number, file: Blob) => {
  const formData = new FormData()
  formData.append('file', file)
  return request.post<unknown, ApiResponse<'/api/admin/dicts/{dict_id}/items/import', 'post'>>(`/admin/dicts/${dictId}/items/import`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}
export const createDictItem = (dictId: number, data: DictItemBody) =>
  request.post<unknown, ApiResponse<'/api/admin/dicts/{dict_id}/items', 'post'>>(`/admin/dicts/${dictId}/items`, data)
export const updateDictItem = (id: number, data: DictItemUpdateBody) =>
  request.put<unknown, ApiResponse<'/api/admin/dicts/items/{item_id}', 'put'>>(`/admin/dicts/items/${id}`, data)
export const deleteDictItem = (id: number) =>
  request.delete<unknown, ApiResponse<'/api/admin/dicts/items/{item_id}', 'delete'>>(`/admin/dicts/items/${id}`)
