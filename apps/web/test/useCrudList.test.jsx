// -*- coding: utf-8 -*-
/** useCrudList hook behavior tests (focus: page number falling back and converging after deleting the last item on the last page) */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCrudList } from '@/shared/hooks/useCrudList'

function makeFetcher(responses) {
  const calls = []
  const fn = vi.fn(async ({ page }) => {
    calls.push(page)
    return responses[page] ?? { items: [], total: 0 }
  })
  fn.calls = calls
  return fn
}

describe('useCrudList', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('首次加载后返回数据与总条数', async () => {
    const fetcher = makeFetcher({ 1: { items: [{ id: 1 }, { id: 2 }], total: 2 } })
    const { result } = renderHook(() => useCrudList(fetcher))

    await act(async () => {
      await result.current.fetchData(1)
    })
    expect(result.current.data).toHaveLength(2)
    expect(result.current.total).toBe(2)
    expect(result.current.page).toBe(1)
  })

  it('删除末页最后一条后自动回退到上一页（页码收敛）', async () => {
    // Page 2 originally had 1 item (the 21st); after deletion it's empty but total is still > 0 → should fall back to page 1
    const fetcher = makeFetcher({
      1: { items: [{ id: 1 }, { id: 2 }], total: 2 },
      2: { items: [], total: 1 },
    })
    const { result } = renderHook(() => useCrudList(fetcher, { defaultPerPage: 1 }))

    await act(async () => {
      await result.current.fetchData(2)
    })
    // First request for page 2 returns empty + total>0 → should automatically re-request page 1
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(fetcher.calls).toEqual([2, 1])
    expect(result.current.page).toBe(1)
    expect(result.current.data).toHaveLength(2)
  })

  it('首页为空时不回退（不产生递归）', async () => {
    const fetcher = makeFetcher({ 1: { items: [], total: 0 } })
    const { result } = renderHook(() => useCrudList(fetcher))

    await act(async () => {
      await result.current.fetchData(1)
    })
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(result.current.page).toBe(1)
    expect(result.current.data).toEqual([])
  })

  it('搜索后页码重置为 1 并携带过滤条件', async () => {
    const fetcher = makeFetcher({ 1: { items: [{ id: 9 }], total: 1 } })
    const { result } = renderHook(() => useCrudList(fetcher))

    await act(async () => {
      await result.current.handleSearch({ search: 'alice' })
    })
    expect(fetcher).toHaveBeenCalledWith({ page: 1, per_page: 20, search: 'alice' })
    expect(result.current.filters).toEqual({ search: 'alice' })
    expect(result.current.page).toBe(1)
  })

  it('翻页调用正确页码', async () => {
    const fetcher = makeFetcher({
      1: { items: [{ id: 1 }], total: 40 },
      2: { items: [{ id: 21 }], total: 40 },
    })
    const { result } = renderHook(() => useCrudList(fetcher))

    await act(async () => {
      await result.current.fetchData(1)
      await result.current.handlePageChange(2)
    })
    expect(fetcher.calls).toEqual([1, 2])
    expect(result.current.page).toBe(2)
  })
})
