/**
 * Pagination parameter parsing
 */

/** Max rows per page; prevents pulling a whole table via ?per_page=1000000 */
export const MAX_PER_PAGE = 200
export const DEFAULT_PER_PAGE = 20

/** Parse a query param as int; falls back to the default when missing or unparsable */
export function queryInt(value: unknown, fallback: number): number {
  const raw = Array.isArray(value) ? value[0] : value
  if (typeof raw !== 'string') return fallback
  const text = raw.trim().replace(/_/g, '')
  if (!/^[+-]?\d+$/.test(text)) return fallback
  return Number.parseInt(text, 10)
}

/** Parse and clamp page / per_page from the query */
export function parsePagination(query: Record<string, unknown> = {}): { page: number; per_page: number } {
  const page = Math.max(queryInt(query.page, 1), 1)
  const perPage = Math.min(Math.max(queryInt(query.per_page, DEFAULT_PER_PAGE), 1), MAX_PER_PAGE)
  return { page, per_page: perPage }
}
