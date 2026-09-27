import request from '@/shared/api/request'
import type { ListParams, ListResponse } from '@/shared/api/types'

/** A signed-in session (times are ISO 8601 UTC) */
export interface Session {
  key: string
  user_id: number
  username: string | null
  nickname: string | null
  ip: string | null
  user_agent: string | null
  created_at: string
  last_seen_at: string
  expires_at: string
  /** The session making this request */
  current: boolean
}

/** Online users (signed-in sessions within the caller's data scope) */
export const getSessions = (params?: ListParams) => request.get<unknown, ListResponse<Session>>('/admin/sessions', { params })
export const revokeSession = (key: string) => request.delete<unknown, void>(`/admin/sessions/${key}`)
