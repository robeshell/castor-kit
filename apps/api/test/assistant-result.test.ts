/** fitResult: large API responses shrink by structure, never beyond the limit, and say what was left out */

import { describe, expect, it } from 'vitest'
import { fitResult } from '@/modules/admin/assistant/result'

const size = (v: unknown) => JSON.stringify(v).length

describe('fitResult', () => {
  it('小结果原样返回，不带 note', () => {
    const value = { items: [{ id: 1 }], total: 1 }
    expect(fitResult(value, 8000)).toEqual({ data: value })
  })

  it('先缩短嵌套列表与长文本，主列表的记录全部保留', () => {
    const roles = Array.from({ length: 3 }, (_, i) => ({ id: i, menus: Array.from({ length: 80 }, (_, m) => ({ id: m, name: `menu ${m}` })) }))
    const { data, note } = fitResult(roles, 2000)
    const kept = data as Array<{ id: number; menus: unknown[] }>
    expect(kept.map((r) => r.id)).toEqual([0, 1, 2])
    expect(kept[0]!.menus).toHaveLength(6)
    expect(kept[0]!.menus.at(-1)).toBe('… 75 more')
    expect(size(data)).toBeLessThanOrEqual(2000)
    expect(note).toContain('nested lists cut')
  })

  it('分页列表放不下时：嵌套数据换成摘要，只保留放得下的记录，total 等字段不变', () => {
    const items = Array.from({ length: 200 }, (_, i) => ({ id: i, name: `user ${i}`, tags: ['a', 'b'], dept: { id: 1, name: 'x' } }))
    const { data, note } = fitResult({ items, total: 200, page: 1 }, 3000)
    const page = data as { items: Array<Record<string, unknown>>; total: number }
    expect(page.total).toBe(200)
    expect(page.items[0]).toEqual({ id: 0, name: 'user 0', tags: '2 items', dept: '{…}' })
    expect(page.items.length).toBeGreaterThan(0)
    expect(page.items.length).toBeLessThan(200)
    expect(size(data)).toBeLessThanOrEqual(3000)
    expect(note).toContain(`of 200 records`)
  })

  it('不是列表的大对象：退回按字符截断', () => {
    const value = Object.fromEntries(Array.from({ length: 500 }, (_, i) => [`key_${i}`, i]))
    const { data, note } = fitResult(value, 1000)
    expect(typeof data).toBe('string')
    expect((data as string).length).toBeLessThanOrEqual(1001)
    expect(note).toContain('cut at 1000 characters')
  })
})
