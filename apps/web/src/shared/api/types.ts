import type { paths } from '@/shared/api/openapi'

/** Shapes shared by every backend endpoint (see AGENTS.md "API route rules") */

/** A list endpoint's response: `{ items, total, page, per_page }` */
export interface ListResponse<T> {
  items: T[]
  total: number
  page: number
  per_page: number
}

/** Query parameters every list endpoint accepts; modules add their own filters */
export interface ListParams {
  page?: number
  per_page?: number
  search?: string
  [key: string]: unknown
}

// ─── Types generated from the OpenAPI doc (src/shared/api/openapi.d.ts, `pnpm openapi:generate`) ───────────────────
// Paths are the documented ones, with the /api prefix and {param} placeholders: '/api/admin/users/{id}'.

export type ApiPath = keyof paths
export type ApiMethod = 'get' | 'post' | 'put' | 'patch' | 'delete'
type Operation<P extends ApiPath, M extends ApiMethod> = NonNullable<paths[P][M]>
type Json<T> = T extends { content: { 'application/json': infer R } } ? R : never

/** The JSON body of an endpoint's success response (200, else 201) */
export type ApiResponse<P extends ApiPath, M extends ApiMethod = 'get'> =
  Operation<P, M> extends { responses: infer R }
    ? R extends { 200: infer Ok }
      ? Json<Ok>
      : R extends { 201: infer Created }
        ? Json<Created>
        : never
    : never

/** An endpoint's query parameters */
export type ApiQuery<P extends ApiPath, M extends ApiMethod = 'get'> =
  Operation<P, M> extends { parameters: { query?: infer Q } } ? NonNullable<Q> : never

/** An endpoint's JSON request body */
export type ApiBody<P extends ApiPath, M extends ApiMethod> =
  Operation<P, M> extends { requestBody?: infer B } ? Json<NonNullable<B>> : never

/** One row of a list endpoint (`{ items: Row[] }`) */
export type ApiItem<P extends ApiPath> = ApiResponse<P> extends { items?: (infer Row)[] } ? Row : never
