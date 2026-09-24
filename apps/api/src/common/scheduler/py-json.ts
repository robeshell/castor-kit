/**
 * Python `json.loads` / `json.dumps` / `str()` 的最小复刻，只服务定时任务的请求头与请求体：
 *
 * - 保留 Python 的数字语义：`1.0` 是 float（dumps 仍输出 `1.0`），超过 2^53 的整数不丢精度，
 *   接受 `NaN` / `Infinity` / `-Infinity`
 * - 对象用 Map 保序（JS 对象会把 "1" 这类整数键提到前面，Python dict 保持插入顺序）
 * - dumps 默认分隔符 `, ` / `: `；ensure_ascii 控制非 ASCII 是否转义
 *
 * 请求体里已经被 Fastify JSON.parse 过的值（普通 JS 对象 / number）同样可以 dumps，但 1.0 与 1 已无法区分。
 */

export class PyFloat {
  constructor(readonly value: number) {}
}

export type PyJson = null | boolean | string | number | bigint | PyFloat | PyJson[] | Map<string, PyJson>

export class PyJsonDecodeError extends Error {}

const WS = new Set([' ', '\t', '\n', '\r'])

/** Python `json.loads(text)`（C scanner 语义：只认 ASCII 数字，strict 模式禁止字符串里的控制字符） */
export function pyJsonLoads(text: string): PyJson {
  let i = 0

  const fail = (msg: string): never => {
    throw new PyJsonDecodeError(`${msg}: char ${i}`)
  }
  const skipWs = () => {
    while (i < text.length && WS.has(text[i]!)) i += 1
  }

  const parseString = (): string => {
    // text[i] === '"'
    i += 1
    let out = ''
    while (true) {
      if (i >= text.length) fail('Unterminated string starting at')
      const ch = text[i]!
      if (ch === '"') {
        i += 1
        return out
      }
      if (ch === '\\') {
        const esc = text[i + 1]
        if (esc === undefined) fail('Unterminated string starting at')
        const simple: Record<string, string> = { '"': '"', '\\': '\\', '/': '/', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t' }
        if (esc! in simple) {
          out += simple[esc!]
          i += 2
          continue
        }
        if (esc === 'u') {
          const hex = text.slice(i + 2, i + 6)
          if (!/^[0-9a-fA-F]{4}$/.test(hex)) fail('Invalid \\uXXXX escape')
          out += String.fromCharCode(Number.parseInt(hex, 16))
          i += 6
          continue
        }
        fail('Invalid \\escape')
      }
      if (ch.charCodeAt(0) < 0x20) fail('Invalid control character at')
      out += ch
      i += 1
    }
  }

  const NUMBER_RE = /-?(?:0|[1-9][0-9]*)(\.[0-9]+)?([eE][-+]?[0-9]+)?/y

  const parseValue = (): PyJson => {
    skipWs()
    const ch = text[i]
    if (ch === undefined) return fail('Expecting value')
    if (ch === '"') return parseString()
    if (ch === '{') {
      i += 1
      const obj = new Map<string, PyJson>()
      skipWs()
      if (text[i] === '}') {
        i += 1
        return obj
      }
      while (true) {
        skipWs()
        if (text[i] !== '"') fail('Expecting property name enclosed in double quotes')
        const key = parseString()
        skipWs()
        if (text[i] !== ':') fail("Expecting ':' delimiter")
        i += 1
        obj.set(key, parseValue())
        skipWs()
        if (text[i] === ',') {
          i += 1
          continue
        }
        if (text[i] === '}') {
          i += 1
          return obj
        }
        fail("Expecting ',' delimiter")
      }
    }
    if (ch === '[') {
      i += 1
      const arr: PyJson[] = []
      skipWs()
      if (text[i] === ']') {
        i += 1
        return arr
      }
      while (true) {
        arr.push(parseValue())
        skipWs()
        if (text[i] === ',') {
          i += 1
          continue
        }
        if (text[i] === ']') {
          i += 1
          return arr
        }
        fail("Expecting ',' delimiter")
      }
    }
    for (const [literal, value] of [
      ['null', null],
      ['true', true],
      ['false', false],
      ['NaN', new PyFloat(Number.NaN)],
      ['Infinity', new PyFloat(Infinity)],
      ['-Infinity', new PyFloat(-Infinity)],
    ] as const) {
      if (text.startsWith(literal, i)) {
        i += literal.length
        return value
      }
    }
    NUMBER_RE.lastIndex = i
    const m = NUMBER_RE.exec(text)
    if (m) {
      i += m[0].length
      if (m[1] || m[2]) return new PyFloat(Number(m[0]))
      const n = Number(m[0])
      return Number.isSafeInteger(n) ? n : BigInt(m[0])
    }
    return fail('Expecting value')
  }

  const value = parseValue()
  skipWs()
  if (i !== text.length) fail('Extra data')
  return value
}

export function isPyDict(value: unknown): value is Map<string, PyJson> | Record<string, unknown> {
  return value instanceof Map || (value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof PyFloat))
}

function entriesOf(value: Map<string, unknown> | Record<string, unknown>): Array<[string, unknown]> {
  return value instanceof Map ? [...value.entries()] : Object.entries(value)
}

/** Python `repr(float)` */
export function pyFloatRepr(x: number): string {
  if (Number.isNaN(x)) return 'nan'
  if (!Number.isFinite(x)) return x > 0 ? 'inf' : '-inf'
  if (x === 0) return Object.is(x, -0) ? '-0.0' : '0.0'
  // toExponential() 不带参数给出最短往返位数，与 Python repr 的有效数字一致
  const [mantissa, expText] = x.toExponential().split('e') as [string, string]
  const exp = Number(expText)
  const negative = mantissa.startsWith('-')
  const digits = mantissa.replace('-', '').replace('.', '')
  let body: string
  if (exp >= -4 && exp < 16) {
    if (exp >= 0) {
      const intPart = digits.slice(0, exp + 1).padEnd(exp + 1, '0')
      const frac = digits.slice(exp + 1)
      body = `${intPart}.${frac || '0'}`
    } else {
      body = `0.${'0'.repeat(-exp - 1)}${digits}`
    }
  } else {
    const m = digits.length > 1 ? `${digits[0]}.${digits.slice(1)}` : digits
    body = `${m}e${exp < 0 ? '-' : '+'}${String(Math.abs(exp)).padStart(2, '0')}`
  }
  return negative ? `-${body}` : body
}

function numberText(value: number | bigint | PyFloat): string {
  if (value instanceof PyFloat) return pyFloatRepr(value.value)
  if (typeof value === 'bigint') return value.toString()
  // 来自 JSON.parse 的 number：整数按 int 输出，其余按 float
  return Number.isInteger(value) ? String(value) : pyFloatRepr(value)
}

function encodeString(text: string, ensureAscii: boolean): string {
  let out = '"'
  for (let k = 0; k < text.length; k += 1) {
    const ch = text[k]!
    const code = text.charCodeAt(k)
    if (ch === '"') out += '\\"'
    else if (ch === '\\') out += '\\\\'
    else if (ch === '\n') out += '\\n'
    else if (ch === '\r') out += '\\r'
    else if (ch === '\t') out += '\\t'
    else if (ch === '\b') out += '\\b'
    else if (ch === '\f') out += '\\f'
    else if (code < 0x20 || (ensureAscii && code > 0x7f)) out += `\\u${code.toString(16).padStart(4, '0')}`
    else out += ch
  }
  return `${out}"`
}

export class PyJsonEncodeError extends Error {}

/**
 * Python `json.dumps(value, ensure_ascii=..., allow_nan=...)`（默认分隔符）。
 * allow_nan=False 时遇到 nan/inf 抛错（requests 的 `json=` 就是这样调用的）。
 */
export function pyJsonDumps(value: unknown, { ensureAscii = true, allowNan = true } = {}): string {
  const enc = (v: unknown): string => {
    if (v === null || v === undefined) return 'null'
    if (v === true) return 'true'
    if (v === false) return 'false'
    if (typeof v === 'string') return encodeString(v, ensureAscii)
    if (typeof v === 'number' || typeof v === 'bigint' || v instanceof PyFloat) {
      const n = v instanceof PyFloat ? v.value : typeof v === 'number' ? v : 0
      if (!Number.isFinite(n) && typeof v !== 'bigint') {
        const repr = pyFloatRepr(n)
        if (!allowNan) throw new PyJsonEncodeError(`Out of range float values are not JSON compliant: ${repr}`)
        return Number.isNaN(n) ? 'NaN' : n > 0 ? 'Infinity' : '-Infinity'
      }
      return numberText(v)
    }
    if (Array.isArray(v)) return `[${v.map(enc).join(', ')}]`
    if (isPyDict(v)) return `{${entriesOf(v).map(([k, item]) => `${encodeString(k, ensureAscii)}: ${enc(item)}`).join(', ')}}`
    return encodeString(String(v), ensureAscii)
  }
  return enc(value)
}

/** Python str.isprintable() 为假的字符类别（空格除外） */
const NON_PRINTABLE = /^[\p{Cc}\p{Cf}\p{Cs}\p{Co}\p{Cn}\p{Zl}\p{Zp}\p{Zs}]$/u

function pyRepr(value: unknown): string {
  if (typeof value === 'string') {
    // Python repr：优先单引号；字符串里有单引号且没有双引号时用双引号
    const useDouble = value.includes("'") && !value.includes('"')
    const quote = useDouble ? '"' : "'"
    let out = ''
    for (const ch of value) {
      const code = ch.codePointAt(0)!
      if (ch === '\\') out += '\\\\'
      else if (ch === quote) out += `\\${quote}`
      else if (ch === '\n') out += '\\n'
      else if (ch === '\r') out += '\\r'
      else if (ch === '\t') out += '\\t'
      else if (ch !== ' ' && NON_PRINTABLE.test(ch)) {
        const hex = code.toString(16)
        out += code <= 0xff ? `\\x${hex.padStart(2, '0')}` : code <= 0xffff ? `\\u${hex.padStart(4, '0')}` : `\\U${hex.padStart(8, '0')}`
      } else out += ch
    }
    return `${quote}${out}${quote}`
  }
  return pyValueStr(value)
}

/** Python `str(value)`（value 是 json.loads 的结果或 JS JSON 值） */
export function pyValueStr(value: unknown): string {
  if (value === null || value === undefined) return 'None'
  if (value === true) return 'True'
  if (value === false) return 'False'
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'bigint' || value instanceof PyFloat) return numberText(value)
  if (Array.isArray(value)) return `[${value.map(pyRepr).join(', ')}]`
  if (isPyDict(value)) return `{${entriesOf(value).map(([k, v]) => `${pyRepr(k)}: ${pyRepr(v)}`).join(', ')}}`
  return String(value)
}
