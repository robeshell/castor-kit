/**
 * common/validation.ts: the field builders and parsers every module declares its request bodies with
 */

import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { ServiceError } from '@/common/errors'
import { exportColumns, field, isDate, parseArrayBody, parseBody, parseIntText, parseNumberText, parsePatch, parseYesNo } from '@/common/validation'

const body = z.object({
  name: field.requiredText('名称', '名称不能为空'),
  note: field.text('备注'),
  count: field.int('数量', 0),
  price: field.number('价格', 0),
  on: field.bool('启用', true),
  kind: field.choice('类型', ['a', 'b'], 'a'),
  day: field.date('日期'),
  at: field.dateTime('时间'),
  ids: field.ids('记录'),
  tags: field.textList('标签'),
})

const errorOf = (fn: () => unknown) => {
  try {
    fn()
  } catch (err) {
    return err instanceof ServiceError ? [err.statusCode, err.message] : err
  }
  return null
}

describe('common/validation', () => {
  it('create: defaults for missing fields, text trimmed, blanks → null / default', () => {
    expect(parseBody(body, { name: ' x ', note: ' ', kind: '', tags: [' a ', ''] })).toEqual({
      name: 'x', note: null, count: 0, price: 0, on: true, kind: 'a', day: null, at: null, ids: [], tags: ['a'],
    })
  })

  it('update: only the fields present', () => {
    expect(parsePatch(body, { count: 3, unknown: 1 })).toEqual({ count: 3 })
    expect(parsePatch(body, { note: null })).toEqual({ note: null })
  })

  it('a wrong type is 400「<label>的值无效」; a missing required text uses its own message', () => {
    for (const [data, message] of [
      [{ name: 'x', count: '3' }, '数量的值无效'],
      [{ name: 'x', count: 1.5 }, '数量的值无效'],
      [{ name: 'x', price: 'NaN' }, '价格的值无效'],
      [{ name: 'x', on: 1 }, '启用的值无效'],
      [{ name: 'x', kind: 'c' }, '类型的值无效'],
      [{ name: 'x', ids: [1, '2'] }, '记录的值无效'],
      [{ name: 'x', ids: [99999999999] }, '记录的值无效'],
      [{ name: 5 }, '名称的值无效'],
      [{}, '名称不能为空'],
    ] as const) {
      expect(errorOf(() => parseBody(body, data)), JSON.stringify(data)).toEqual([400, message])
    }
    expect(errorOf(() => parseBody(body, [1]))).toEqual([400, '请求参数格式不正确'])
  })

  it('dates: YYYY-MM-DD naming a real day; date-times with an optional offset', () => {
    expect(isDate('2024-02-29')).toBe(true)
    for (const text of ['2023-02-29', '2024-13-01', '2024-1-01', '20240101', '2024-W01', '2024-01-01T00:00', '0000-01-01']) {
      expect(isDate(text), text).toBe(false)
    }
    expect(parseBody(body, { name: 'x', day: '2024-03-05', at: '2024-03-05T08:30:00Z' })).toMatchObject({
      day: '2024-03-05',
      at: '2024-03-05 08:30:00+00:00',
    })
    expect(parseBody(body, { name: 'x', day: '', at: '' })).toMatchObject({ day: null, at: null })
    expect(errorOf(() => parseBody(body, { name: 'x', day: '2024-03-05xx' }))).toEqual([400, '日期的值无效'])
    expect(errorOf(() => parseBody(body, { name: 'x', at: '2024-02-30 10:00' }))).toEqual([400, '时间的值无效'])
  })

  it('array bodies, export columns, text parsers', () => {
    const item = z.object({ id: field.id('卡片') })
    expect(parseArrayBody(item, [{ id: 1 }, {}])).toEqual([{ id: 1 }, { id: null }])
    expect(parseArrayBody(item, null)).toEqual([])
    expect(errorOf(() => parseArrayBody(item, { a: 1 }, '需要数组'))).toEqual([400, '需要数组'])
    expect(exportColumns(['b', 'x'], { a: 1, b: 2 })).toEqual(['b'])
    expect(exportColumns([], { a: 1, b: 2 })).toEqual(['a', 'b'])
    expect([parseYesNo('启用'), parseYesNo('OFF'), parseYesNo('maybe'), parseYesNo('', true)]).toEqual([true, false, null, true])
    expect([parseIntText(' 7 ', 0), parseIntText('7.5', 0), parseNumberText('7.5', 0), parseNumberText('1e3', 0)]).toEqual([7, 0, 7.5, 0])
  })
})
