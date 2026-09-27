import request from '@/shared/api/request'
import type { ApiItem, ApiQuery, ApiResponse } from '@/shared/api/types'

/** A signed-in session (times are ISO 8601 UTC) */
export type Session = ApiItem<'/api/admin/sessions'>

/** Online users (signed-in sessions within the caller's data scope) */
export const getSessions = (params?: ApiQuery<'/api/admin/sessions'>) =>
  request.get<unknown, ApiResponse<'/api/admin/sessions'>>('/admin/sessions', { params })
export const revokeSession = (key: string) => request.delete<unknown, void>(`/admin/sessions/${key}`)
