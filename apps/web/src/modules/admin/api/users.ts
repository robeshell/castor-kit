import request from '@/shared/api/request'
import type { ApiBody, ApiItem, ApiQuery, ApiResponse } from '@/shared/api/types'

/** A user with roles, department name and menu codes (times are ISO 8601 UTC) */
export type User = ApiItem<'/api/admin/users'>
/** Result of saving one's own profile: `{ message, user }` with the same user shape as the list */
export type UpdateProfileResult = ApiResponse<'/api/admin/profile', 'put'>
/** Edit body: any subset of the create fields; `password` only when changing it */
export type UserUpdateBody = ApiBody<'/api/admin/users/{user_id}', 'put'>
/** Export request: ids (selected rows) or filters (the current query; status '' = every status), fields, file_type */
export type UserExportBody = ApiBody<'/api/admin/users/export', 'post'>

export const getUsers = (params?: ApiQuery<'/api/admin/users'>) =>
  request.get<unknown, ApiResponse<'/api/admin/users'>>('/admin/users', { params })
export const createUser = (data: ApiBody<'/api/admin/users', 'post'>) =>
  request.post<unknown, ApiResponse<'/api/admin/users', 'post'>>('/admin/users', data)
export const updateUser = (id: number, data: UserUpdateBody) =>
  request.put<unknown, ApiResponse<'/api/admin/users/{user_id}', 'put'>>(`/admin/users/${id}`, data)
export const deleteUser = (id: number) =>
  request.delete<unknown, ApiResponse<'/api/admin/users/{user_id}', 'delete'>>(`/admin/users/${id}`)
export const exportUsers = (data: UserExportBody) =>
  request.post<unknown, Blob>('/admin/users/export', data, { responseType: 'blob' })
export const downloadUsersTemplate = (fileType: ApiQuery<'/api/admin/users/template'>['file_type'] = 'csv') =>
  request.get<unknown, Blob>('/admin/users/template', {
    params: { file_type: fileType },
    responseType: 'blob',
  })
export const importUsers = (file: Blob) => {
  const formData = new FormData()
  formData.append('file', file)
  return request.post<unknown, ApiResponse<'/api/admin/users/import', 'post'>>('/admin/users/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}
export const setUserStatus = (id: number, status: ApiBody<'/api/admin/users/{user_id}/status', 'put'>['status']) =>
  request.put<unknown, ApiResponse<'/api/admin/users/{user_id}/status', 'put'>>(`/admin/users/${id}/status`, { status })
/** The signed-in user's own profile (nickname / email / phone / avatar) */
export const updateProfile = (data: ApiBody<'/api/admin/profile', 'put'>) =>
  request.put<unknown, UpdateProfileResult>('/admin/profile', data)
/** Remove a user's two-step verification binding (lost phone and recovery codes) */
export const resetUserTwoFactor = (id: number) =>
  request.delete<unknown, ApiResponse<'/api/admin/users/{user_id}/two-factor', 'delete'>>(`/admin/users/${id}/two-factor`)
