import request from '@/shared/api/request'

/** Online users (signed-in sessions within the caller's data scope) */
export const getSessions = (params) => request.get('/admin/sessions', { params })
export const revokeSession = (key) => request.delete(`/admin/sessions/${key}`)
