/**
 * API file template (what `pnpm scaffold` generates: apps/web/src/modules/<module>/api/<resource>.ts)
 *
 * Replacement notes:
 *   - <Resource> → PascalCase resource name (e.g. CustomerOrder)
 *   - <resources> → the URL segment, kebab-case plural (e.g. customer-orders)
 *
 * Types come from the OpenAPI doc (docs/apifox-full.openapi.json → src/shared/api/openapi.d.ts, `pnpm openapi:generate`):
 * paths are the documented ones, with the /api prefix and {param} placeholders. Document the endpoints first
 * (AGENTS.md "OpenAPI writing rules"; scaffold writes them for you), otherwise ApiItem / ApiBody resolve to never.
 * Reference: apps/web/src/modules/admin/api/users.ts
 */
import request from '@/shared/api/request'
import type { ApiBody, ApiItem, ApiQuery, ApiResponse } from '@/shared/api/types'

/** A record as the API returns it (times are ISO 8601 UTC, decimals are strings) */
export type <Resource> = ApiItem<'/api/admin/<resources>'>
/** Create body (edit takes any subset of the same fields) */
export type <Resource>Body = ApiBody<'/api/admin/<resources>', 'post'>
/** Export request: ids (none = every row), fields (none = every column), file_type */
export type <Resource>ExportBody = ApiBody<'/api/admin/<resources>/export', 'post'>
/** File type of exports and the import template */
export type <Resource>FileType = NonNullable<ApiQuery<'/api/admin/<resources>/template'>['file_type']>

const BASE = '/admin/<resources>'

// ── Basic CRUD ───────────────────────────────────────────────────────────────
// The response interceptor already unwraps the body: the second type argument of request.get<unknown, T> is the body type
export const getItems = (params?: ApiQuery<'/api/admin/<resources>'>) =>
  request.get<unknown, ApiResponse<'/api/admin/<resources>'>>(BASE, { params })
export const createItem = (data: <Resource>Body) => request.post<unknown, ApiResponse<'/api/admin/<resources>', 'post'>>(BASE, data)
export const updateItem = (id: number, data: ApiBody<'/api/admin/<resources>/{item_id}', 'put'>) =>
  request.put<unknown, ApiResponse<'/api/admin/<resources>/{item_id}', 'put'>>(`${BASE}/${id}`, data)
export const deleteItem = (id: number) =>
  request.delete<unknown, ApiResponse<'/api/admin/<resources>/{item_id}', 'delete'>>(`${BASE}/${id}`)

// ── Export ───────────────────────────────────────────────────────────────────
export const exportItems = (data: <Resource>ExportBody) =>
  request.post<unknown, Blob>(`${BASE}/export`, data, { responseType: 'blob' })

// ── Download import template ─────────────────────────────────────────────────
export const downloadTemplate = (fileType: <Resource>FileType = 'xlsx') =>
  request.get<unknown, Blob>(`${BASE}/template`, { params: { file_type: fileType }, responseType: 'blob' })

// ── Import ───────────────────────────────────────────────────────────────────
export const importItems = (file: Blob) => {
  const formData = new FormData()
  formData.append('file', file)
  return request.post<unknown, ApiResponse<'/api/admin/<resources>/import', 'post'>>(`${BASE}/import`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}
