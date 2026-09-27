import request from '@/shared/api/request'
import type { ApiBody, ApiQuery, ApiResponse } from '@/shared/api/types'

/** A menu / button record (times are ISO 8601 UTC) */
export type Menu = ApiResponse<'/api/admin/menus', 'post'>

/**
 * A menu as listed: `format=tree` (the default) nests `children`, `format=flat` returns plain rows. Local type: the
 * OpenAPI doc can't express the recursive `children` (it has `{ [key: string]: unknown }[]`).
 */
export interface MenuTreeNode extends Menu {
  children?: MenuTreeNode[]
}

/**
 * Create / edit bodies.
 * TODO(openapi): the backend reads sort_order with field.int('排序', 0) (apps/api/src/modules/admin/menu/schema.ts), so
 * null (a cleared number input) is accepted and saved as 0; the doc has `sort_order?: number`.
 */
export type MenuBody = Omit<ApiBody<'/api/admin/menus', 'post'>, 'sort_order'> & { sort_order?: number | null }
export type MenuUpdateBody = Omit<ApiBody<'/api/admin/menus/{menu_id}', 'put'>, 'sort_order'> & { sort_order?: number | null }

export const getMenus = (params?: ApiQuery<'/api/admin/menus'>) => request.get<unknown, MenuTreeNode[]>('/admin/menus', { params })
export const createMenu = (data: MenuBody) => request.post<unknown, Menu>('/admin/menus', data)
export const updateMenu = (id: number, data: MenuUpdateBody) =>
  request.put<unknown, ApiResponse<'/api/admin/menus/{menu_id}', 'put'>>(`/admin/menus/${id}`, data)
export const deleteMenu = (id: number) =>
  request.delete<unknown, ApiResponse<'/api/admin/menus/{menu_id}', 'delete'>>(`/admin/menus/${id}`)
export const sortMenu = (id: number, direction: ApiBody<'/api/admin/menus/{menu_id}/sort', 'post'>['direction']) =>
  request.post<unknown, ApiResponse<'/api/admin/menus/{menu_id}/sort', 'post'>>(`/admin/menus/${id}/sort`, { direction })
export const exportMenus = (data: ApiBody<'/api/admin/menus/export', 'post'>) =>
  request.post<unknown, Blob>('/admin/menus/export', data, { responseType: 'blob' })
export const downloadMenusTemplate = (fileType: ApiQuery<'/api/admin/menus/template'>['file_type'] = 'csv') =>
  request.get<unknown, Blob>('/admin/menus/template', {
    params: { file_type: fileType },
    responseType: 'blob',
  })
export const importMenus = (file: Blob) => {
  const formData = new FormData()
  formData.append('file', file)
  return request.post<unknown, ApiResponse<'/api/admin/menus/import', 'post'>>('/admin/menus/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}
