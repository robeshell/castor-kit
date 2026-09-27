import request from '@/shared/api/request'
import type { ApiBody, ApiQuery, ApiResponse } from '@/shared/api/types'

/** A team member of the detail tabs demo (the list is a plain array; times are ISO 8601 UTC) */
export type DetailMember = ApiResponse<'/api/admin/component-center/detail-tabs/members/{member_id}'>

export const getDetailMembers = (params?: ApiQuery<'/api/admin/component-center/detail-tabs/members'>) =>
  request.get<unknown, ApiResponse<'/api/admin/component-center/detail-tabs/members'>>('/admin/component-center/detail-tabs/members', { params })

export const getDetailMember = (id: number) =>
  request.get<unknown, DetailMember>(`/admin/component-center/detail-tabs/members/${id}`)

export const createDetailMember = (data: ApiBody<'/api/admin/component-center/detail-tabs/members', 'post'>) =>
  request.post<unknown, ApiResponse<'/api/admin/component-center/detail-tabs/members', 'post'>>('/admin/component-center/detail-tabs/members', data)

export const updateDetailMember = (id: number, data: ApiBody<'/api/admin/component-center/detail-tabs/members/{member_id}', 'put'>) =>
  request.put<unknown, ApiResponse<'/api/admin/component-center/detail-tabs/members/{member_id}', 'put'>>(
    `/admin/component-center/detail-tabs/members/${id}`,
    data
  )

export const deleteDetailMember = (id: number) =>
  request.delete<unknown, ApiResponse<'/api/admin/component-center/detail-tabs/members/{member_id}', 'delete'>>(
    `/admin/component-center/detail-tabs/members/${id}`
  )
