import request from '@/shared/api/request'
import type { ApiBody, ApiItem, ApiQuery, ApiResponse } from '@/shared/api/types'

/** A card of the card list demo (times are ISO 8601 UTC) */
export type CardListPageItem = ApiItem<'/api/admin/component-center/card-list-page'>
/**
 * Create / edit bodies.
 * TODO(openapi): the backend reads category with field.text and priority with field.int (cardItemBody in
 * apps/api/src/modules/component-center/card-list-page/schema.ts), so both take null (category → general, priority → 0 on
 * create); the doc types them as non-null.
 */
type Nullable<B> = Omit<B, 'category' | 'priority'> & { category?: string | null; priority?: number | null }
export type CardListPageCreateBody = Nullable<ApiBody<'/api/admin/component-center/card-list-page', 'post'>>
export type CardListPageUpdateBody = Nullable<ApiBody<'/api/admin/component-center/card-list-page/{item_id}', 'put'>>
/**
 * Export request.
 * TODO(openapi): the backend reads every filter with field.text (cardExportBody, built by exportBody), so `status` takes
 * any text ('' = every status); the doc types it as the enum.
 */
export type CardListPageExportBody = Omit<ApiBody<'/api/admin/component-center/card-list-page/export', 'post'>, 'filters'> & {
  filters?: { search?: string; category?: string; owner?: string; is_active?: string | null; status?: string }
}
/** Export / template file type */
export type CardListPageFileType = NonNullable<ApiQuery<'/api/admin/component-center/card-list-page/template'>['file_type']>

export const getCardListPageList = (params?: ApiQuery<'/api/admin/component-center/card-list-page'>) =>
  request.get<unknown, ApiResponse<'/api/admin/component-center/card-list-page'>>('/admin/component-center/card-list-page', { params })
export const getCardListPageDetail = (id: number) =>
  request.get<unknown, ApiResponse<'/api/admin/component-center/card-list-page/{item_id}'>>(`/admin/component-center/card-list-page/${id}`)
export const createCardListPage = (data: CardListPageCreateBody) =>
  request.post<unknown, ApiResponse<'/api/admin/component-center/card-list-page', 'post'>>('/admin/component-center/card-list-page', data)
export const updateCardListPage = (id: number, data: CardListPageUpdateBody) =>
  request.put<unknown, ApiResponse<'/api/admin/component-center/card-list-page/{item_id}', 'put'>>(`/admin/component-center/card-list-page/${id}`, data)
export const deleteCardListPage = (id: number) =>
  request.delete<unknown, ApiResponse<'/api/admin/component-center/card-list-page/{item_id}', 'delete'>>(`/admin/component-center/card-list-page/${id}`)

export const exportCardListPage = (data: CardListPageExportBody) =>
  request.post<unknown, Blob>('/admin/component-center/card-list-page/export', data, { responseType: 'blob' })

export const downloadCardListPageTemplate = (
  fileType: ApiQuery<'/api/admin/component-center/card-list-page/template'>['file_type'] = 'csv'
) =>
  request.get<unknown, Blob>('/admin/component-center/card-list-page/template', {
    params: { file_type: fileType },
    responseType: 'blob',
  })

export const importCardListPage = (file: Blob) => {
  const formData = new FormData()
  formData.append('file', file)
  return request.post<unknown, ApiResponse<'/api/admin/component-center/card-list-page/import', 'post'>>(
    '/admin/component-center/card-list-page/import',
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
    }
  )
}
