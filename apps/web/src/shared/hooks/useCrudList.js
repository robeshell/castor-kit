import { useCallback, useRef, useState } from 'react'

/**
 * Generic state machine for CRUD list pages: pagination + search + reset + loading state.
 *
 * List pages used to each copy their own fetchData/search/reset state machine, and the behavior tended to drift.
 * New pages should reuse this hook first:
 *   const list = useCrudList((params) => listApi(params), { defaultPerPage: 20 })
 *   // list = { data, total, page, perPage, loading, filters,
 *   //          fetchData, handleSearch, handleReset, handlePageChange }
 *
 * The fetcher receives { page, per_page, ...filters } and returns { items, total, ... }.
 * Relies on request.js for unified 401/CSRF handling, so pages don't need to reimplement it.
 *
 * Page clamping: when the result is an empty page but total > 0 (typically after deleting the last row on the last page),
 * automatically step back one page and refetch, instead of staying on an out-of-range empty page.
 */
export function useCrudList(fetcher, { defaultPerPage = 20 } = {}) {
  const [data, setData] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [perPage] = useState(defaultPerPage)
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState({})
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

  const handleSearch = useCallback((nextFilters = {}) => {
    const merged = { ...filters, ...nextFilters }
    setFilters(merged)
    return fetchData(1, merged)
  }, [filters, fetchData])

  const handleReset = useCallback(() => {
    setFilters({})
    return fetchData(1, {})
  }, [fetchData])

  const handlePageChange = useCallback((nextPage) => fetchData(nextPage, filters), [filters, fetchData])

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
