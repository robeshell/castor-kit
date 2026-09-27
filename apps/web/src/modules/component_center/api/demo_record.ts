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

// ── Beyond CRUD: the endpoints the page patterns share ────────────────────────
type P = '/api/admin/component-center/demo-records'

/** Query of the list / tree / stats endpoints (the same filters) */
export type DemoRecordQuery = ApiQuery<P>
/** One node of GET …/tree (records nested by parent_id, ordered by sort_order) */
export type DemoRecordTreeNode = ApiResponse<`${P}/tree`> extends (infer N)[] ? N : never
export type DemoRecordStats = ApiResponse<`${P}/stats`>
export type DemoRecordBatchUpdateBody = ApiBody<`${P}/batch-update`, 'post'>
export type DemoRecordReorderBody = ApiBody<`${P}/reorder`, 'put'>

export const getItem = (id: number) => request.get<unknown, ApiResponse<`${P}/{item_id}`>>(`${BASE}/${id}`)
export const getTree = (params?: ApiQuery<`${P}/tree`>) => request.get<unknown, ApiResponse<`${P}/tree`>>(`${BASE}/tree`, { params })
export const getStats = (params?: ApiQuery<`${P}/stats`>) => request.get<unknown, DemoRecordStats>(`${BASE}/stats`, { params })
export const batchUpdate = (data: DemoRecordBatchUpdateBody) =>
  request.post<unknown, ApiResponse<`${P}/batch-update`, 'post'>>(`${BASE}/batch-update`, data)
export const batchDelete = (data: ApiBody<`${P}/batch-delete`, 'post'>) =>
  request.post<unknown, ApiResponse<`${P}/batch-delete`, 'post'>>(`${BASE}/batch-delete`, data)
/** Kanban moves (status + sort_order) and tree drags (parent_id + sort_order) */
export const reorder = (data: DemoRecordReorderBody) => request.put<unknown, ApiResponse<`${P}/reorder`, 'put'>>(`${BASE}/reorder`, data)

/**
 * A tree node with its children typed. Local type: the OpenAPI doc can't express the recursive `children`
 * (DemoRecordTreeNode has `{ [key: string]: unknown }[]`).
 */
export type DemoRecordNode = Omit<DemoRecordTreeNode, 'children'> & { children: DemoRecordNode[] }
/** GET …/tree with the children typed recursively (same request as getTree) */
export const getNodeTree = (params?: ApiQuery<`${P}/tree`>) => request.get<unknown, DemoRecordNode[]>(`${BASE}/tree`, { params })
