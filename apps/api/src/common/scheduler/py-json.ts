/**
 * Minimal replica of Python `json.loads` / `json.dumps` / `str()`, only for scheduled-task request headers and bodies:
 *
 * - Keeps Python number semantics: `1.0` is a float (dumps still emits `1.0`), integers beyond 2^53 keep full precision,
 *   and `NaN` / `Infinity` / `-Infinity` are accepted
 * - Objects use Map to preserve order (JS objects hoist integer-like keys such as "1"; Python dicts keep insertion order)
 * - dumps uses default separators `, ` / `: `; ensure_ascii controls whether non-ASCII is escaped
 *
 * Values already JSON.parse'd by Fastify from the request body (plain JS objects / numbers) can also be dumped, but 1.0 and 1 are no longer distinguishable.
 */

export class PyFloat {
  constructor(readonly value: number) {}
}

export type PyJson = null | boolean | string | number | bigint | PyFloat | PyJson[] | Map<string, PyJson>

export class PyJsonDecodeError extends Error {}

const WS = new Set([' ', '\t', '\n', '\r'])

/** Python `json.loads(text)` (C scanner semantics: ASCII digits only; strict mode forbids control characters in strings) */
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
  // toExponential() without arguments gives the shortest round-trip digits, matching Python repr's significant digits
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
  // number from JSON.parse: integers are emitted as int, everything else as float
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
 * Python `json.dumps(value, ensure_ascii=..., allow_nan=...)` (default separators).
 * With allow_nan=False, nan/inf raise (this is how requests' `json=` calls it).
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

/** Character categories for which Python str.isprintable() is false (except space) */
const NON_PRINTABLE = /^[\p{Cc}\p{Cf}\p{Cs}\p{Co}\p{Cn}\p{Zl}\p{Zp}\p{Zs}]$/u

function pyRepr(value: unknown): string {
  if (typeof value === 'string') {
    // Python repr: prefer single quotes; use double quotes when the string contains a single quote but no double quote
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

/** Python `str(value)` (value is a json.loads result or a JS JSON value) */
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
