import { describe, expect, it } from 'vitest'
import { pyJsonDumps, safePayload } from '@/common/request-meta'

describe('safePayload', () => {
  it('None → null', () => {
    expect(safePayload(null)).toBeNull()
    expect(safePayload(undefined)).toBeNull()
  })

  it('敏感键脱敏（大小写不敏感、递归到嵌套对象与数组）', () => {
    const text = safePayload({
      username: 'admin',
      Password: 'secret-value',
      nested: { api_key: 'k', ok: 1 },
      list: [{ token: 't' }, 'plain'],
    })!
    expect(text).not.toContain('secret-value')
    expect(JSON.parse(text)).toEqual({
      username: 'admin',
      Password: '***',
      nested: { api_key: '***', ok: 1 },
      list: [{ token: '***' }, 'plain'],
    })
  })

  it('输出格式同 json.dumps(ensure_ascii=False)', () => {
    expect(safePayload({ a: 1, b: [true, null], c: '中文' })).toBe('{"a": 1, "b": [true, null], "c": "中文"}')
    expect(pyJsonDumps({})).toBe('{}')
    expect(pyJsonDumps([])).toBe('[]')
    expect(pyJsonDumps('a"b\n')).toBe('"a\\"b\\n"')
  })

  it('超过 2000 字符截断', () => {
    const text = safePayload({ data: 'x'.repeat(5000) })!
    expect(text.endsWith('...(truncated)')).toBe(true)
    expect(text.length).toBe(2000 + '...(truncated)'.length)
  })
})
