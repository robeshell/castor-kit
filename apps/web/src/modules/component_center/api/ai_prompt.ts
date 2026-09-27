import request from '@/shared/api/request'
import type { ApiBody, ApiQuery, ApiResponse } from '@/shared/api/types'

const BASE = '/admin/component-center/ai/prompt'

/** Template list response: `{ data, total }` (not the usual `{ items }`) */
export type PromptTemplateList = ApiResponse<'/api/admin/component-center/ai/prompt/templates'>
/** A prompt template; `variables` are the {{name}} placeholders found in `content` */
export type PromptTemplate = PromptTemplateList['data'][number]

/** List templates (optionally filtered by category) */
export const getPromptTemplates = (params?: ApiQuery<'/api/admin/component-center/ai/prompt/templates'>) =>
  request.get<unknown, PromptTemplateList>(`${BASE}/templates`, { params })

/** Create a template */
export const createPromptTemplate = (data: ApiBody<'/api/admin/component-center/ai/prompt/templates', 'post'>) =>
  request.post<unknown, ApiResponse<'/api/admin/component-center/ai/prompt/templates', 'post'>>(`${BASE}/templates`, data)

/** Update a template */
export const updatePromptTemplate = (id: number, data: ApiBody<'/api/admin/component-center/ai/prompt/templates/{template_id}', 'put'>) =>
  request.put<unknown, ApiResponse<'/api/admin/component-center/ai/prompt/templates/{template_id}', 'put'>>(`${BASE}/templates/${id}`, data)

/** Delete a template */
export const deletePromptTemplate = (id: number) =>
  request.delete<unknown, ApiResponse<'/api/admin/component-center/ai/prompt/templates/{template_id}', 'delete'>>(`${BASE}/templates/${id}`)
