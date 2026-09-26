import request from '@/shared/api/request'

/** The signed-in user's own tokens ({ enabled, items }) */
export const getMyApiTokens = () => request.get('/admin/profile/api-tokens')
/** Permissions the user can put on a token (flat, with parent directories for the tree) */
export const getApiTokenScopes = () => request.get('/admin/profile/api-tokens/scopes')
/** Returns { token, item }: the plaintext token is only in this response */
export const createApiToken = (data) => request.post('/admin/profile/api-tokens', data)
export const revokeMyApiToken = (id) => request.delete(`/admin/profile/api-tokens/${id}`)

/** Every token in the admin's data scope */
export const getApiTokens = (params) => request.get('/admin/api-tokens', { params })
export const revokeApiToken = (id) => request.delete(`/admin/api-tokens/${id}`)
