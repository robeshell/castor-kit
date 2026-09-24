import { useCallback, useRef, useState } from 'react'

/**
 * CRUD 列表页通用状态机：分页 + 搜索 + 重置 + 加载态。
 *
 * 各列表页过去各自复制一套 fetchData/search/reset 状态机，行为容易漂移。
 * 新页面应优先复用本 hook：
 *   const list = useCrudList((params) => listApi(params), { defaultPerPage: 20 })
 *   // list = { data, total, page, perPage, loading, filters,
 *   //          fetchData, handleSearch, handleReset, handlePageChange }
 *
 * fetcher 接收 { page, per_page, ...filters } 并返回 { items, total, ... }。
 * 依赖 request.js 的统一 401/CSRF 处理，无需在页面内重复实现。
 *
 * 页码收敛：当请求结果为空页但 total > 0（典型场景是删除末页最后一条），
 * 自动回退到上一页重新拉取，避免停留在越界空页。
 */
export function useCrudList(fetcher, { defaultPerPage = 20 } = {}) {
  const [data, setData] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [perPage] = useState(defaultPerPage)
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState({})
  // 回退中标记：防止回退拉取再次触发回退形成递归
  const recoveringRef = useRef(false)

  const fetchData = useCallback(async (nextPage = page, nextFilters = filters) => {
    setLoading(true)
    try {
      const res = await fetcher({ page: nextPage, per_page: perPage, ...nextFilters })

      // 删除末页最后一条后页码越界：items 为空、total > 0 且不在首页 → 回退一页
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
