/**
 * 保序 JSON + Python json.dumps 输出格式（generate-openapi / import-apifox 共用）
 *
 * JS 对象会把 "200"/"201" 这类整数形键提到最前，而 Python dict 保持插入顺序；
 * 需要与 Python 输出逐字节一致的地方，用 Map 表示对象、数字保留原文。
 */

export type OrderedJson = null | boolean | string | { raw: string } | OrderedJson[] | Map<string, OrderedJson>

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v) && !(v instanceof Map)

export function parseOrderedJson(text: string): OrderedJson {
  let i = 0
  const ws = () => {
    while (i < text.length && ' \t\n\r'.includes(text[i]!)) i += 1
  }
  const fail = (): never => {
    throw new SyntaxError(`JSON 解析失败：位置 ${i}`)
  }
  const parseString = (): string => {
    const start = i
    i += 1
    while (i < text.length && text[i] !== '"') i += text[i] === '\\' ? 2 : 1
    if (i >= text.length) fail()
    i += 1
    return JSON.parse(text.slice(start, i)) as string
  }
  const parseValue = (): OrderedJson => {
    ws()
    const ch = text[i]
    if (ch === '{') {
      i += 1
      const map = new Map<string, OrderedJson>()
      ws()
      if (text[i] === '}') {
        i += 1
        return map
      }
      for (;;) {
        ws()
        if (text[i] !== '"') fail()
        const key = parseString()
        ws()
        if (text[i] !== ':') fail()
        i += 1
        map.set(key, parseValue())
        ws()
        if (text[i] === ',') {
          i += 1
          continue
        }
        if (text[i] === '}') {
          i += 1
          return map
        }
        fail()
      }
    }
    if (ch === '[') {
      i += 1
      const arr: OrderedJson[] = []
      ws()
      if (text[i] === ']') {
        i += 1
        return arr
      }
      for (;;) {
        arr.push(parseValue())
        ws()
        if (text[i] === ',') {
          i += 1
          continue
        }
        if (text[i] === ']') {
          i += 1
          return arr
        }
        fail()
      }
    }
    if (ch === '"') return parseString()
    if (text.startsWith('true', i)) {
      i += 4
      return true
    }
    if (text.startsWith('false', i)) {
      i += 5
      return false
    }
    if (text.startsWith('null', i)) {
      i += 4
      return null
    }
    const m = /^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(text.slice(i))
    if (!m) return fail()
    i += m[0].length
    return { raw: m[0] }
  }
  const value = parseValue()
  ws()
  if (i !== text.length) fail()
  return value
}

/** 普通 JS 值 → 保序结构（键顺序即插入顺序；整数形键会按 JS 规则先行，调用方需自行保证） */
export function toOrdered(value: unknown): OrderedJson {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return value
  if (typeof value === 'number') return { raw: String(value) }
  if (Array.isArray(value)) return value.map(toOrdered)
  if (value instanceof Map) return new Map([...value].map(([k, v]) => [String(k), toOrdered(v)]))
  if (isPlainObject(value)) return new Map(Object.entries(value).map(([k, v]) => [k, toOrdered(v)]))
  throw new TypeError(`无法序列化的值: ${String(value)}`)
}

/** Python ensure_ascii=True：0x7F 及以上字符一律 \uXXXX（小写十六进制，码点 > 0xFFFF 拆成代理对） */
function escapeNonAscii(json: string): string {
  return json.replace(/[\u007f-￿]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`)
}

function dumpString(s: string, ensureAscii: boolean): string {
  const json = JSON.stringify(s)
  return ensureAscii ? escapeNonAscii(json) : json
}

/** 对齐 Python `json.dumps(obj, ensure_ascii=False, indent=2)` */
export function dumpIndented(value: OrderedJson, level = 0): string {
  if (value === null) return 'null'
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'string') return dumpString(value, false)
  const pad = '  '.repeat(level + 1)
  const end = '  '.repeat(level)
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]'
    return `[\n${value.map((v) => pad + dumpIndented(v, level + 1)).join(',\n')}\n${end}]`
  }
  if (value instanceof Map) {
    if (value.size === 0) return '{}'
    const items = [...value].map(([k, v]) => `${pad}${dumpString(k, false)}: ${dumpIndented(v, level + 1)}`)
    return `{\n${items.join(',\n')}\n${end}}`
  }
  return value.raw
}

/** 对齐 Python `json.dumps(obj)` 默认参数（ensure_ascii=True，分隔符 ', ' 与 ': '）——requests 的 json= 就是这样编码请求体 */
export function dumpPythonDefault(value: OrderedJson): string {
  if (value === null) return 'null'
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'string') return dumpString(value, true)
  if (Array.isArray(value)) return `[${value.map(dumpPythonDefault).join(', ')}]`
  if (value instanceof Map) {
    return `{${[...value].map(([k, v]) => `${dumpString(k, true)}: ${dumpPythonDefault(v)}`).join(', ')}}`
  }
  return value.raw
}
