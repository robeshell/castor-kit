import request from '@/shared/api/request'
import type { ApiBody, ApiItem, ApiQuery, ApiResponse } from '@/shared/api/types'

/** A record of the dynamic form demo as listed (times are ISO 8601 UTC) */
export type DynamicFormPageItem = ApiItem<'/api/admin/component-center/dynamic-form-page'>
/** A record with its dynamic fields */
export type DynamicFormPageDetail = ApiResponse<'/api/admin/component-center/dynamic-form-page/{item_id}'>
/**
 * Create / edit bodies.
 * TODO(openapi): the backend reads priority with field.int (dynamicFormBody in
 * apps/api/src/modules/component-center/dynamic-form-page/schema.ts), so it takes null (→ 0); the doc types it as non-null.
 */
type NullablePriority<B> = Omit<B, 'priority'> & { priority?: number | null }
export type DynamicFormPageCreateBody = NullablePriority<ApiBody<'/api/admin/component-center/dynamic-form-page', 'post'>>
export type DynamicFormPageUpdateBody = NullablePriority<ApiBody<'/api/admin/component-center/dynamic-form-page/{item_id}', 'put'>>
/**
 * Export request.
 * TODO(openapi): the backend reads every filter with field.text (dynamicFormExportBody, built by exportBody), so `status`
 * takes any text ('' = every status); the doc types it as the enum.
 */
export type DynamicFormPageExportBody = Omit<ApiBody<'/api/admin/component-center/dynamic-form-page/export', 'post'>, 'filters'> & {
  filters?: { search?: string; category?: string; status?: string; owner?: string; is_active?: string | null }
}
/** Export / template file type */
export type DynamicFormPageFileType = NonNullable<ApiQuery<'/api/admin/component-center/dynamic-form-page/template'>['file_type']>

export const getDynamicFormPageList = (params?: ApiQuery<'/api/admin/component-center/dynamic-form-page'>) =>
  request.get<unknown, ApiResponse<'/api/admin/component-center/dynamic-form-page'>>('/admin/component-center/dynamic-form-page', { params })

export const getDynamicFormPageDetail = (id: number) =>
  request.get<unknown, DynamicFormPageDetail>(`/admin/component-center/dynamic-form-page/${id}`)

export const createDynamicFormPage = (data: DynamicFormPageCreateBody) =>
  request.post<unknown, ApiResponse<'/api/admin/component-center/dynamic-form-page', 'post'>>('/admin/component-center/dynamic-form-page', data)

export const updateDynamicFormPage = (id: number, data: DynamicFormPageUpdateBody) =>
  request.put<unknown, ApiResponse<'/api/admin/component-center/dynamic-form-page/{item_id}', 'put'>>(
    `/admin/component-center/dynamic-form-page/${id}`,
    data
  )

export const deleteDynamicFormPage = (id: number) =>
  request.delete<unknown, ApiResponse<'/api/admin/component-center/dynamic-form-page/{item_id}', 'delete'>>(
    `/admin/component-center/dynamic-form-page/${id}`
  )

export const exportDynamicFormPage = (data: DynamicFormPageExportBody) =>
  request.post<unknown, Blob>('/admin/component-center/dynamic-form-page/export', data, { responseType: 'blob' })

export const downloadDynamicFormPageTemplate = (
  fileType: ApiQuery<'/api/admin/component-center/dynamic-form-page/template'>['file_type'] = 'csv'
) =>
  request.get<unknown, Blob>('/admin/component-center/dynamic-form-page/template', {
    params: { file_type: fileType },
    responseType: 'blob',
  })

export const importDynamicFormPage = (file: Blob) => {
  const formData = new FormData()
  formData.append('file', file)
  return request.post<unknown, ApiResponse<'/api/admin/component-center/dynamic-form-page/import', 'post'>>(
    '/admin/component-center/dynamic-form-page/import',
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
    }
  )
}
