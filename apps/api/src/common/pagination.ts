/**
 * 分页参数解析
 */

/** 单页最多返回行数，防止 ?per_page=1000000 整表拉取 */
export const MAX_PER_PAGE = 200
export const DEFAULT_PER_PAGE = 20

/** 查询参数按 int 解析：缺省或无法解析时回落默认值 */
export function queryInt(value: unknown, fallback: number): number {
  const raw = Array.isArray(value) ? value[0] : value
  if (typeof raw !== 'string') return fallback
  const text = raw.trim().replace(/_/g, '')
  if (!/^[+-]?\d+$/.test(text)) return fallback
  return Number.parseInt(text, 10)
}

/** 从 query 解析并钳制 page / per_page */
export function parsePagination(query: Record<string, unknown> = {}): { page: number; per_page: number } {
  const page = Math.max(queryInt(query.page, 1), 1)
  const perPage = Math.min(Math.max(queryInt(query.per_page, DEFAULT_PER_PAGE), 1), MAX_PER_PAGE)
  return { page, per_page: perPage }
}
