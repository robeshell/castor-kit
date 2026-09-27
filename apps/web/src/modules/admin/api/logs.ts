import request from '@/shared/api/request'
import type { ApiBody, ApiItem, ApiQuery, ApiResponse } from '@/shared/api/types'

/** A sign-in attempt (times are ISO 8601 UTC) */
export type LoginLog = ApiItem<'/api/admin/logs/login'>
/** A logged write operation */
export type OperationLog = ApiItem<'/api/admin/logs/operation'>
/** Export requests: ids (selected rows) or filters (the current query; status '' = every status), fields, file_type */
export type LoginLogExportBody = ApiBody<'/api/admin/logs/login/export', 'post'>
export type OperationLogExportBody = ApiBody<'/api/admin/logs/operation/export', 'post'>

export const getLoginLogs = (params?: ApiQuery<'/api/admin/logs/login'>) =>
  request.get<unknown, ApiResponse<'/api/admin/logs/login'>>('/admin/logs/login', { params })
export const getOperationLogs = (params?: ApiQuery<'/api/admin/logs/operation'>) =>
  request.get<unknown, ApiResponse<'/api/admin/logs/operation'>>('/admin/logs/operation', { params })
export const exportLoginLogs = (data: LoginLogExportBody) =>
  request.post<unknown, Blob>('/admin/logs/login/export', data, { responseType: 'blob' })
export const exportOperationLogs = (data: OperationLogExportBody) =>
  request.post<unknown, Blob>('/admin/logs/operation/export', data, { responseType: 'blob' })
