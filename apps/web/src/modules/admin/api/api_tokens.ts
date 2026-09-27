import request from '@/shared/api/request'
import type { ApiBody, ApiItem, ApiQuery, ApiResponse } from '@/shared/api/types'

/** An API token (the plaintext token is never listed, only its prefix; times are ISO 8601 UTC) */
export type ApiToken = ApiItem<'/api/admin/api-tokens'>
/** A permission that can be put on a token (flat list; parent directories are included for the tree) */
export type ApiTokenScope = ApiItem<'/api/admin/profile/api-tokens/scopes'>

/** The signed-in user's own tokens ({ enabled, items }) */
export const getMyApiTokens = () => request.get<unknown, ApiResponse<'/api/admin/profile/api-tokens'>>('/admin/profile/api-tokens')
/** Permissions the user can put on a token (flat, with parent directories for the tree) */
export const getApiTokenScopes = () =>
  request.get<unknown, ApiResponse<'/api/admin/profile/api-tokens/scopes'>>('/admin/profile/api-tokens/scopes')
/** Returns { token, item }: the plaintext token is only in this response */
export const createApiToken = (data: ApiBody<'/api/admin/profile/api-tokens', 'post'>) =>
  request.post<unknown, ApiResponse<'/api/admin/profile/api-tokens', 'post'>>('/admin/profile/api-tokens', data)
export const revokeMyApiToken = (id: number) =>
  request.delete<unknown, ApiResponse<'/api/admin/profile/api-tokens/{token_id}', 'delete'>>(`/admin/profile/api-tokens/${id}`)

/** Every token in the admin's data scope */
export const getApiTokens = (params?: ApiQuery<'/api/admin/api-tokens'>) =>
  request.get<unknown, ApiResponse<'/api/admin/api-tokens'>>('/admin/api-tokens', { params })
export const revokeApiToken = (id: number) =>
  request.delete<unknown, ApiResponse<'/api/admin/api-tokens/{token_id}', 'delete'>>(`/admin/api-tokens/${id}`)
