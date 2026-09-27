import request from '@/shared/api/request'
import type { ApiBody, ApiQuery, ApiResponse } from '@/shared/api/types'

/** A role with its data scope and granted menus (times are ISO 8601 UTC) */
export type Role = ApiResponse<'/api/admin/roles'>[number]

export const getRoles = () => request.get<unknown, ApiResponse<'/api/admin/roles'>>('/admin/roles')
export const createRole = (data: ApiBody<'/api/admin/roles', 'post'>) =>
  request.post<unknown, ApiResponse<'/api/admin/roles', 'post'>>('/admin/roles', data)
export const updateRole = (id: number, data: ApiBody<'/api/admin/roles/{role_id}', 'put'>) =>
  request.put<unknown, ApiResponse<'/api/admin/roles/{role_id}', 'put'>>(`/admin/roles/${id}`, data)
export const deleteRole = (id: number) =>
  request.delete<unknown, ApiResponse<'/api/admin/roles/{role_id}', 'delete'>>(`/admin/roles/${id}`)
export const exportRoles = (data: ApiBody<'/api/admin/roles/export', 'post'>) =>
  request.post<unknown, Blob>('/admin/roles/export', data, { responseType: 'blob' })
export const downloadRolesTemplate = (fileType: ApiQuery<'/api/admin/roles/template'>['file_type'] = 'csv') =>
  request.get<unknown, Blob>('/admin/roles/template', {
    params: { file_type: fileType },
    responseType: 'blob',
  })
export const importRoles = (file: Blob) => {
  const formData = new FormData()
  formData.append('file', file)
  return request.post<unknown, ApiResponse<'/api/admin/roles/import', 'post'>>('/admin/roles/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}
