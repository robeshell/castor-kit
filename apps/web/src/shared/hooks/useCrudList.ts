import { useCallback, useRef, useState } from 'react'
import type { ListResponse } from '@/shared/api/types'

/**
 * Generic state machine for CRUD list pages: pagination + search + reset + loading state.
 *
 * Keeps fetchData / search / reset behavior identical across list pages. Usage:
 *   const list = useCrudList((params) => listApi(params), { defaultPerPage: 20 })
 *   // list = { data, total, page, perPage, loading, filters,
 *   //          fetchData, handleSearch, handleReset, handlePageChange }
 *
 * The fetcher receives { page, per_page, ...filters } and returns { items, total, ... }.
 * Relies on request.ts for unified 401/CSRF handling, so pages don't need to reimplement it.
 *
 * Page clamping: when the result is an empty page but total > 0 (typically after deleting the last row on the last page),
 * automatically step back one page and refetch, instead of staying on an out-of-range empty page.
 */
/** Search filters merged into every request */
export type CrudListFilters = Record<string, unknown>

/** What the fetcher is called with: the page plus the current filters */
export type CrudListParams = CrudListFilters & { page: number; per_page: number }

/** What the fetcher resolves to: a list response, or at least `{ items, total }` (e.g. an error fallback) */
export type CrudListResponse<Row> = Pick<ListResponse<Row>, 'items' | 'total'> & Partial<ListResponse<Row>>

export type CrudListFetcher<Row> = (params: CrudListParams) => Promise<CrudListResponse<Row> | null | undefined>

export interface UseCrudListOptions {
  defaultPerPage?: number
}

export interface CrudList<Row> {
  data: Row[]
  total: number
  page: number
  perPage: number
  loading: boolean
  filters: CrudListFilters
  fetchData: (nextPage?: number, nextFilters?: CrudListFilters) => Promise<CrudListResponse<Row> | null | undefined>
  handleSearch: (nextFilters?: CrudListFilters) => Promise<CrudListResponse<Row> | null | undefined>
  handleReset: () => Promise<CrudListResponse<Row> | null | undefined>
  handlePageChange: (nextPage: number) => Promise<CrudListResponse<Row> | null | undefined>
}

export function useCrudList<Row>(fetcher: CrudListFetcher<Row>, { defaultPerPage = 20 }: UseCrudListOptions = {}): CrudList<Row> {
  const [data, setData] = useState<Row[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [perPage] = useState(defaultPerPage)
  // Starts true: pages fetch on mount, and the table should show skeleton rows (not "no data") until the first response
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<CrudListFilters>({})
  // Step-back-in-progress flag: prevents the step-back fetch from triggering another step-back recursively
  const recoveringRef = useRef(false)

  const fetchData = useCallback(async (nextPage = page, nextFilters = filters) => {
    setLoading(true)
    try {
      const res = await fetcher({ page: nextPage, per_page: perPage, ...nextFilters })

      // Page out of range after deleting the last row on the last page: items empty, total > 0 and not on the first page → step back one page
      const emptyOvershoot =
        !(res?.items && res.items.length > 0) &&
        (res?.total || 0) > 0 &&
        nextPage > 1 &&
        !recoveringRef.current

      if (emptyOvershoot) {
        recoveringRef.current = true
        try {
          const fallback = await fetcher({ page: nextPage - 1, per_page: perPage, ...nextFilters })
          setData(fallback?.items || [])
          setTotal(fallback?.total || 0)
          setPage(nextPage - 1)
          return fallback
        } finally {
          recoveringRef.current = false
        }
      }

      setData(res?.items || [])
      setTotal(res?.total || 0)
      setPage(nextPage)
      return res
    } finally {
      setLoading(false)
    }
  }, [fetcher, page, perPage, filters])

  const handleSearch = useCallback((nextFilters: CrudListFilters = {}) => {
    const merged = { ...filters, ...nextFilters }
    setFilters(merged)
    return fetchData(1, merged)
  }, [filters, fetchData])

  const handleReset = useCallback(() => {
    setFilters({})
    return fetchData(1, {})
  }, [fetchData])

  const handlePageChange = useCallback((nextPage: number) => fetchData(nextPage, filters), [filters, fetchData])

  return {
    data,
    total,
    page,
    perPage,
    loading,
    filters,
    fetchData,
    handleSearch,
    handleReset,
    handlePageChange,
  }
}
