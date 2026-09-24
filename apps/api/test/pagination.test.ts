import { describe, expect, it } from 'vitest'
import { DEFAULT_PER_PAGE, MAX_PER_PAGE, parsePagination } from '@/common/pagination'

describe('parsePagination（对齐 backend/tests/test_pagination.py）', () => {
  it('默认值', () => {
    expect(parsePagination({})).toEqual({ page: 1, per_page: DEFAULT_PER_PAGE })
  })
  it('per_page 上限钳制', () => {
    expect(parsePagination({ per_page: '1000000' }).per_page).toBe(MAX_PER_PAGE)
  })
  it('下限钳制', () => {
    expect(parsePagination({ page: '0', per_page: '0' })).toEqual({ page: 1, per_page: 1 })
    expect(parsePagination({ page: '-5', per_page: '-3' })).toEqual({ page: 1, per_page: 1 })
  })
  it('非整数回落默认值（等价 request.args.get(type=int)）', () => {
    expect(parsePagination({ page: 'abc', per_page: '1.5' })).toEqual({ page: 1, per_page: DEFAULT_PER_PAGE })
  })
  it('正常值透传', () => {
    expect(parsePagination({ page: '3', per_page: '50' })).toEqual({ page: 3, per_page: 50 })
    expect(parsePagination({ page: ' 2 ' }).page).toBe(2)
  })
})
