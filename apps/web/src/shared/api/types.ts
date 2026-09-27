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
