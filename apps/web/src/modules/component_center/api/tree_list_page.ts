import request from '@/shared/api/request'
import type { ApiBody, ApiItem, ApiQuery, ApiResponse } from '@/shared/api/types'

/** A node of the tree list demo as listed (times are ISO 8601 UTC) */
export type TreeListPageItem = ApiItem<'/api/admin/component-center/tree-list-page'>

/**
 * A node of the full tree. Local type: the OpenAPI doc can't express the recursive `children` (it has
 * `{ [key: string]: unknown }[]`).
 */
export interface TreeListPageNode extends TreeListPageItem {
  children_count: number
  children?: TreeListPageNode[]
}

/** Create / update bodies (sort_order: null, e.g. a cleared number input, is saved as 0) */
export type TreeListPageCreateInput = ApiBody<'/api/admin/component-center/tree-list-page', 'post'>
export type TreeListPageUpdateInput = ApiBody<'/api/admin/component-center/tree-list-page/{item_id}', 'put'>
/** Export body: selected ids, or the list filters (export_mode; status '' = every status) */
export type TreeListPageExportBody = ApiBody<'/api/admin/component-center/tree-list-page/export', 'post'>

export const getTreeListPageTree = (params?: ApiQuery<'/api/admin/component-center/tree-list-page/tree'>) =>
  request.get<unknown, TreeListPageNode[]>('/admin/component-center/tree-list-page/tree', { params })

export const getTreeListPageList = (params?: ApiQuery<'/api/admin/component-center/tree-list-page'>) =>
  request.get<unknown, ApiResponse<'/api/admin/component-center/tree-list-page'>>('/admin/component-center/tree-list-page', { params })

export const getTreeListPageDetail = (id: number) =>
  request.get<unknown, ApiResponse<'/api/admin/component-center/tree-list-page/{item_id}'>>(`/admin/component-center/tree-list-page/${id}`)

export const createTreeListPage = (data: TreeListPageCreateInput) =>
  request.post<unknown, ApiResponse<'/api/admin/component-center/tree-list-page', 'post'>>('/admin/component-center/tree-list-page', data)

export const updateTreeListPage = (id: number, data: TreeListPageUpdateInput) =>
  request.put<unknown, ApiResponse<'/api/admin/component-center/tree-list-page/{item_id}', 'put'>>(
    `/admin/component-center/tree-list-page/${id}`,
    data
  )

export const deleteTreeListPage = (id: number) =>
  request.delete<unknown, ApiResponse<'/api/admin/component-center/tree-list-page/{item_id}', 'delete'>>(
    `/admin/component-center/tree-list-page/${id}`
  )

export const exportTreeListPage = (data: TreeListPageExportBody) =>
  request.post<unknown, Blob>('/admin/component-center/tree-list-page/export', data, { responseType: 'blob' })

export const downloadTreeListPageTemplate = (
  fileType: ApiQuery<'/api/admin/component-center/tree-list-page/template'>['file_type'] = 'csv'
) =>
  request.get<unknown, Blob>('/admin/component-center/tree-list-page/template', {
    params: { file_type: fileType },
    responseType: 'blob',
  })

export const importTreeListPage = (file: Blob) => {
  const formData = new FormData()
  formData.append('file', file)
  return request.post<unknown, ApiResponse<'/api/admin/component-center/tree-list-page/import', 'post'>>(
    '/admin/component-center/tree-list-page/import',
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
    }
  )
}
