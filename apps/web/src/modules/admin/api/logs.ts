import request from '@/shared/api/request'
import type { ApiBody, ApiItem, ApiQuery, ApiResponse } from '@/shared/api/types'

/** A sign-in attempt (times are ISO 8601 UTC) */
export type LoginLog = ApiItem<'/api/admin/logs/login'>
/** A logged write operation */
export type OperationLog = ApiItem<'/api/admin/logs/operation'>
/**
 * Export requests: ids (selected rows) or filters (the current query), fields, file_type.
 * TODO(openapi): the backend reads the filters with field.text, fields with field.textList and file_type with
 * field.text (loginLogExportBody / operationLogExportBody in apps/api/src/modules/admin/logs/schema.ts, built by
 * exportBody): status takes any text ('' = every status), unknown fields are dropped and a file type other than
 * csv / xlsx falls back to csv; the doc types status, fields and file_type as enums.
 */
export type LoginLogExportBody = Omit<ApiBody<'/api/admin/logs/login/export', 'post'>, 'filters' | 'fields' | 'file_type'> & {
  filters?: { username?: string; status?: string }
  fields?: string[]
  file_type?: string
}
export type OperationLogExportBody = Omit<ApiBody<'/api/admin/logs/operation/export', 'post'>, 'fields' | 'file_type'> & {
  fields?: string[]
  file_type?: string
}

export const getLoginLogs = (params?: ApiQuery<'/api/admin/logs/login'>) =>
  request.get<unknown, ApiResponse<'/api/admin/logs/login'>>('/admin/logs/login', { params })
export const getOperationLogs = (params?: ApiQuery<'/api/admin/logs/operation'>) =>
  request.get<unknown, ApiResponse<'/api/admin/logs/operation'>>('/admin/logs/operation', { params })
export const exportLoginLogs = (data: LoginLogExportBody) =>
  request.post<unknown, Blob>('/admin/logs/login/export', data, { responseType: 'blob' })
export const exportOperationLogs = (data: OperationLogExportBody) =>
  request.post<unknown, Blob>('/admin/logs/operation/export', data, { responseType: 'blob' })
