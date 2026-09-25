/**
 * Converts PostgreSQL text values returned by read-only queries into the API's JSON output values, by OID.
 *
 * Column values are first parsed into a Python-style value model (int / float / Decimal / date / datetime / time / timedelta / Range / list / dict …),
 * then serialized with these rules (toResponseValue):
 *   null → null; date/datetime/time → ISO format; int/float/bool → as-is; everything else → Python `str()` text
 * So numeric → Decimal text (e.g. `1.2E-7`), json object/array → Python repr (`{'a': 1}`),
 * array → Python list repr (`[Decimal('1.5'), None]`), interval → timedelta text (`1 day, 2:00:00`).
 *
 * Special cases:
 * - bytea: output as PG hex text
 * - float NaN/±Infinity: output null (`NaN`/`Infinity` are not valid JSON literals and the frontend can't parse them)
 */

export class PyConvertError extends Error {}

// ---- Value model (Python style, used to produce repr / str text) ----

interface PyInt {
  t: 'int'
  v: bigint
}
interface PyFloat {
  t: 'float'
  v: number
}
interface PyStr {
  t: 'str'
  v: string
}
interface PyDecimal {
  t: 'decimal'
  v: string
}
interface PyDate {
  t: 'date'
  y: number
  m: number
  d: number
}
interface PyTime {
  t: 'time'
  H: number
  M: number
  S: number
  us: number
  /** UTC offset in seconds; null = naive */
  tz: number | null
}
interface PyDateTime {
  t: 'datetime'
  y: number
  m: number
  d: number
  H: number
  M: number
  S: number
  us: number
  tz: number | null
}
interface PyTimedelta {
  t: 'timedelta'
  days: bigint
  seconds: number
  us: number
}
interface PyUuid {
  t: 'uuid'
  v: string
}
interface PyMemory {
  t: 'memory'
  v: string
}
interface PyDict {
  t: 'dict'
  entries: [string, PyValue][]
}
/** Range types: NumericRange / DateRange / DateTimeRange / DateTimeTZRange */
interface PyRange {
  t: 'range'
  cls: string
  /** null = empty range */
  bounds: string | null
  lower: PyValue
  upper: PyValue
}

export type PyValue =
  | null
  | boolean
  | PyInt
  | PyFloat
  | PyStr
  | PyDecimal
  | PyDate
  | PyTime
  | PyDateTime
  | PyTimedelta
  | PyUuid
  | PyMemory
  | PyDict
  | PyRange
  | PyValue[]

// ---- repr / str ----

const NON_PRINTABLE = /[\p{Cc}\p{Cf}\p{Cs}\p{Co}\p{Cn}\p{Zl}\p{Zp}\p{Zs}]/u

/** Python `repr(str)` */
export function pyStrRepr(s: string): string {
  const quote = s.includes("'") && !s.includes('"') ? '"' : "'"
  let out = quote
  for (const ch of s) {
    const code = ch.codePointAt(0)!
    if (ch === quote || ch === '\\') out += `\\${ch}`
    else if (ch === '\t') out += '\\t'
    else if (ch === '\n') out += '\\n'
    else if (ch === '\r') out += '\\r'
    else if (code < 0x20 || code === 0x7f) out += `\\x${code.toString(16).padStart(2, '0')}`
    else if (code < 0x7f) out += ch
    else if (ch !== ' ' && NON_PRINTABLE.test(ch)) {
      if (code <= 0xff) out += `\\x${code.toString(16).padStart(2, '0')}`
      else if (code <= 0xffff) out += `\\u${code.toString(16).padStart(4, '0')}`
      else out += `\\U${code.toString(16).padStart(8, '0')}`
    } else out += ch
  }
  return out + quote
}

/** Python `repr(float)`: shortest round-trip representation; scientific notation when exponent < -4 or >= 16 (`1e-05`, `1e+16`) */
export function pyFloatRepr(n: number): string {
  if (Number.isNaN(n)) return 'nan'
  if (!Number.isFinite(n)) return n > 0 ? 'inf' : '-inf'
  if (n === 0) return Object.is(n, -0) ? '-0.0' : '0.0'
  const [mantissa, expText] = n.toExponential().split('e') as [string, string]
  const exp = Number(expText)
  const negative = mantissa.startsWith('-')
  const digits = mantissa.replace('-', '').replace('.', '')
  const sign = negative ? '-' : ''
  if (exp < -4 || exp >= 16) {
    const mant = digits.length > 1 ? `${digits[0]}.${digits.slice(1)}` : digits
    const e = Math.abs(exp).toString().padStart(2, '0')
    return `${sign}${mant}e${exp < 0 ? '-' : '+'}${e}`
  }
  let text: string
  if (exp < 0) text = `0.${'0'.repeat(-exp - 1)}${digits}`
  else if (digits.length <= exp + 1) text = `${digits}${'0'.repeat(exp + 1 - digits.length)}.0`
  else text = `${digits.slice(0, exp + 1)}.${digits.slice(exp + 1)}`
  return sign + text
}

/** Python `str(Decimal(text))`, where text is PostgreSQL numeric text output (no exponent) */
export function decimalStr(text: string): string {
  if (text === 'NaN' || text === 'Infinity' || text === '-Infinity') return text
  const m = /^([+-]?)(\d*)(?:\.(\d*))?$/.exec(text)
  if (!m) return text
  const sign = m[1] === '-' ? '-' : ''
  const intDigits = m[2] ?? ''
  const frac = m[3] ?? ''
  const exp = -frac.length
  const coefficient = (intDigits + frac).replace(/^0+/, '') || '0'
  const leftdigits = exp + coefficient.length
  const dotplace = exp <= 0 && leftdigits > -6 ? leftdigits : 1
  let intpart: string
  let fracpart: string
  if (dotplace <= 0) {
    intpart = '0'
    fracpart = `.${'0'.repeat(-dotplace)}${coefficient}`
  } else if (dotplace >= coefficient.length) {
    intpart = coefficient + '0'.repeat(dotplace - coefficient.length)
    fracpart = ''
  } else {
    intpart = coefficient.slice(0, dotplace)
    fracpart = `.${coefficient.slice(dotplace)}`
  }
  const e = leftdigits === dotplace ? '' : `E${leftdigits - dotplace >= 0 ? '+' : '-'}${Math.abs(leftdigits - dotplace)}`
  return sign + intpart + fracpart + e
}

const p2 = (n: number) => String(n).padStart(2, '0')

function tzIso(offset: number): string {
  const sign = offset < 0 ? '-' : '+'
  const abs = Math.abs(offset)
  const hh = Math.floor(abs / 3600)
  const mm = Math.floor((abs % 3600) / 60)
  const ss = abs % 60
  return `${sign}${p2(hh)}:${p2(mm)}${ss ? `:${p2(ss)}` : ''}`
}

function timeIso(H: number, M: number, S: number, us: number, tz: number | null): string {
  const base = `${p2(H)}:${p2(M)}:${p2(S)}${us ? `.${String(us).padStart(6, '0')}` : ''}`
  return tz === null ? base : base + tzIso(tz)
}

function dateIso(y: number, m: number, d: number): string {
  return `${String(y).padStart(4, '0')}-${p2(m)}-${p2(d)}`
}

/** timedelta normalization (days of any sign, 0 <= seconds < 86400, 0 <= us < 1e6) */
function makeTimedelta(totalMicros: bigint): PyTimedelta {
  const DAY = 86_400_000_000n
  let days = totalMicros / DAY
  let rem = totalMicros % DAY
  if (rem < 0n) {
    rem += DAY
    days -= 1n
  }
  if (days > 999_999_999n || days < -999_999_999n) throw new PyConvertError('timedelta out of range')
  return { t: 'timedelta', days, seconds: Number(rem / 1_000_000n), us: Number(rem % 1_000_000n) }
}

function timedeltaRepr(td: PyTimedelta): string {
  const parts: string[] = []
  if (td.days) parts.push(`days=${td.days}`)
  if (td.seconds) parts.push(`seconds=${td.seconds}`)
  if (td.us) parts.push(`microseconds=${td.us}`)
  return `datetime.timedelta(${parts.length ? parts.join(', ') : '0'})`
}

function timedeltaStr(td: PyTimedelta): string {
  const hh = Math.floor(td.seconds / 3600)
  const mm = Math.floor((td.seconds % 3600) / 60)
  const ss = td.seconds % 60
  let s = `${hh}:${p2(mm)}:${p2(ss)}`
  if (td.days) {
    const abs = td.days < 0n ? -td.days : td.days
    s = `${td.days} day${abs !== 1n ? 's' : ''}, ${s}`
  }
  if (td.us) s += `.${String(td.us).padStart(6, '0')}`
  return s
}

function tzRepr(offset: number): string {
  if (offset === 0) return 'datetime.timezone.utc'
  return `datetime.timezone(${timedeltaRepr(makeTimedelta(BigInt(offset) * 1_000_000n))})`
}

function trimTimeFields(fields: number[]): number[] {
  const out = [...fields]
  if (out[out.length - 1] === 0) out.pop()
  if (out[out.length - 1] === 0) out.pop()
  return out
}

/** Python `repr(value)` */
export function pyRepr(value: PyValue): string {
  if (value === null) return 'None'
  if (value === true) return 'True'
  if (value === false) return 'False'
  if (Array.isArray(value)) return `[${value.map(pyRepr).join(', ')}]`
  switch (value.t) {
    case 'int':
      return value.v.toString()
    case 'float':
      return pyFloatRepr(value.v)
    case 'str':
      return pyStrRepr(value.v)
    case 'decimal':
      return `Decimal('${decimalStr(value.v)}')`
    case 'date':
      return `datetime.date(${value.y}, ${value.m}, ${value.d})`
    case 'time': {
      const f = trimTimeFields([value.H, value.M, value.S, value.us])
      return `datetime.time(${f.join(', ')}${value.tz === null ? '' : `, tzinfo=${tzRepr(value.tz)}`})`
    }
    case 'datetime': {
      const f = [value.y, value.m, value.d, ...trimTimeFields([value.H, value.M, value.S, value.us])]
      return `datetime.datetime(${f.join(', ')}${value.tz === null ? '' : `, tzinfo=${tzRepr(value.tz)}`})`
    }
    case 'timedelta':
      return timedeltaRepr(value)
    case 'uuid':
      return `UUID('${value.v}')`
    case 'memory':
      return value.v
    case 'dict':
      return `{${value.entries.map(([k, v]) => `${pyStrRepr(k)}: ${pyRepr(v)}`).join(', ')}}`
    case 'range':
      return value.bounds === null
        ? `${value.cls}(empty=True)`
        : `${value.cls}(${pyRepr(value.lower)}, ${pyRepr(value.upper)}, ${pyStrRepr(value.bounds)})`
  }
}

/** Python `str(value)` for Range bounds (datetime's str is the space-separated isoformat) */
function pyScalarStr(value: PyValue): string {
  if (value === null) return 'None'
  if (typeof value === 'boolean' || Array.isArray(value)) return pyRepr(value)
  switch (value.t) {
    case 'date':
      return dateIso(value.y, value.m, value.d)
    case 'datetime':
      return `${dateIso(value.y, value.m, value.d)} ${timeIso(value.H, value.M, value.S, value.us, value.tz)}`
    case 'time':
      return timeIso(value.H, value.M, value.S, value.us, value.tz)
    default:
      return pyStrOf(value)
  }
}

/** Python `str(value)` text form (only used by the "everything else" branch of toResponseValue) */
function pyStrOf(value: Exclude<PyValue, null | boolean>): string {
  if (Array.isArray(value)) return pyRepr(value)
  switch (value.t) {
    case 'str':
    case 'uuid':
    case 'memory':
      return value.v
    case 'decimal':
      return decimalStr(value.v)
    case 'timedelta':
      return timedeltaStr(value)
    case 'range':
      return value.bounds === null
        ? 'empty'
        : `${value.bounds[0]}${pyScalarStr(value.lower)}, ${pyScalarStr(value.upper)}${value.bounds[1]}`
    default:
      return pyRepr(value)
  }
}

type JsonRaw = { rawJSON: (text: string) => unknown }

/** int → JSON number; values beyond JS safe integers use JSON.rawJSON to keep exact digits (no precision loss) */
function intJson(v: bigint): unknown {
  const n = Number(v)
  return Number.isSafeInteger(n) ? n : (JSON as unknown as JsonRaw).rawJSON(v.toString())
}

/** Per-value serialization rules for read-only query results */
export function toResponseValue(value: PyValue): unknown {
  if (value === null || typeof value === 'boolean') return value
  if (Array.isArray(value)) return pyRepr(value)
  switch (value.t) {
    case 'int':
      return intJson(value.v)
    case 'float':
      return Number.isFinite(value.v) ? value.v : null
    case 'date':
      return dateIso(value.y, value.m, value.d)
    case 'time':
      return timeIso(value.H, value.M, value.S, value.us, value.tz)
    case 'datetime':
      return `${dateIso(value.y, value.m, value.d)}T${timeIso(value.H, value.M, value.S, value.us, value.tz)}`
    default:
      return pyStrOf(value)
  }
}

// ---- PostgreSQL text → value model ----

function parseFraction(frac: string | undefined): number {
  if (!frac) return 0
  return Number(frac.padEnd(6, '0').slice(0, 6))
}

function parseOffset(text: string | undefined): number | null {
  if (!text) return null
  const m = /^([+-])(\d{1,2})(?::?(\d{2}))?(?::?(\d{2}))?$/.exec(text)
  if (!m) throw new PyConvertError(`bad tz offset: ${text}`)
  const secs = Number(m[2]) * 3600 + Number(m[3] ?? 0) * 60 + Number(m[4] ?? 0)
  return m[1] === '-' ? -secs : secs
}

function checkYear(y: number): void {
  if (y < 1 || y > 9999) throw new PyConvertError(`year ${y} is out of range`)
}

function parseDate(text: string): PyDate {
  if (text === 'infinity') return { t: 'date', y: 9999, m: 12, d: 31 }
  if (text === '-infinity') return { t: 'date', y: 1, m: 1, d: 1 }
  const m = /^(\d{4,})-(\d{2})-(\d{2})$/.exec(text)
  if (!m) throw new PyConvertError(`bad date: ${text}`)
  const y = Number(m[1])
  checkYear(y)
  return { t: 'date', y, m: Number(m[2]), d: Number(m[3]) }
}

function parseTime(text: string, withTz: boolean): PyTime {
  const m = /^(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?([+-][\d:]+)?$/.exec(text)
  if (!m) throw new PyConvertError(`bad time: ${text}`)
  // 24:00:00 wraps back to 00:00:00
  const H = Number(m[1]) % 24
  return { t: 'time', H, M: Number(m[2]), S: Number(m[3]), us: parseFraction(m[4]), tz: withTz ? parseOffset(m[5]) : null }
}

function parseTimestamp(text: string, withTz: boolean): PyDateTime {
  const tz = withTz ? 0 : null
  if (text === 'infinity') return { t: 'datetime', y: 9999, m: 12, d: 31, H: 23, M: 59, S: 59, us: 999999, tz }
  if (text === '-infinity') return { t: 'datetime', y: 1, m: 1, d: 1, H: 0, M: 0, S: 0, us: 0, tz }
  const m = /^(\d{4,})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?([+-][\d:]+)?$/.exec(text)
  if (!m) throw new PyConvertError(`bad timestamp: ${text}`)
  const y = Number(m[1])
  checkYear(y)
  return {
    t: 'datetime',
    y,
    m: Number(m[2]),
    d: Number(m[3]),
    H: Number(m[4]),
    M: Number(m[5]),
    S: Number(m[6]),
    us: parseFraction(m[7]),
    tz: withTz ? parseOffset(m[8]) : null,
  }
}

/** State machine for parsing interval text (IntervalStyle=postgres; year = 365 days, month = 30 days) */
function parseInterval(text: string): PyTimedelta {
  const INT_MAX = 2_147_483_647
  let v = 0
  let years = 0
  let months = 0
  let days = 0
  let hours = 0
  let minutes = 0
  let seconds = 0
  let micros = 0
  let sign = 1
  let denom = 1
  let part = 0
  const skipUntilSpace = (i: number) => {
    while (i < text.length && text[i] !== ' ') i++
    return i
  }
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!
    if (ch === '-') sign = -1
    else if (ch >= '0' && ch <= '9') {
      v = v * 10 + Number(ch)
      if (v > INT_MAX) throw new PyConvertError('interval component too big')
      if (part === 6) denom *= 10
    } else if (ch === 'y') {
      if (part === 0) {
        years = v * sign
        v = 0
        sign = 1
        part = 1
        i = skipUntilSpace(i)
      }
    } else if (ch === 'm') {
      if (part <= 1) {
        months = v * sign
        v = 0
        sign = 1
        part = 2
        i = skipUntilSpace(i)
      }
    } else if (ch === 'd') {
      if (part <= 2) {
        days = v * sign
        v = 0
        sign = 1
        part = 3
        i = skipUntilSpace(i)
      }
    } else if (ch === ':') {
      if (part <= 3) {
        hours = v
        v = 0
        part = 4
      } else if (part === 4) {
        minutes = v
        v = 0
        part = 5
      }
    } else if (ch === '.') {
      if (part === 5) {
        seconds = v
        v = 0
        part = 6
      }
    } else if (ch === 'P') {
      throw new PyConvertError('iso_8601 intervalstyle currently not supported')
    }
  }
  if (part === 4) minutes = v
  else if (part === 5) seconds = v
  else if (part === 6) {
    micros = v
    if (denom < 1_000_000) {
      while (denom < 1_000_000) {
        micros *= 10
        denom *= 10
      }
    } else if (denom > 1_000_000) {
      micros = Math.round((micros / denom) * 1_000_000)
    }
  }
  let totalSeconds = BigInt(seconds) + 60n * BigInt(minutes) + 3600n * BigInt(hours)
  let totalMicrosPart = BigInt(micros)
  if (sign < 0) {
    totalSeconds = -totalSeconds
    totalMicrosPart = -totalMicrosPart
  }
  const totalDays = BigInt(days) + 30n * BigInt(months) + 365n * BigInt(years)
  return makeTimedelta(totalDays * 86_400_000_000n + totalSeconds * 1_000_000n + totalMicrosPart)
}

/** Order-preserving JSON parse (integers keep precision, object keys keep document order, duplicate keys take the last value) */
export function parseJsonPy(text: string): PyValue {
  let i = 0
  const ws = () => {
    while (i < text.length && ' \t\n\r'.includes(text[i]!)) i++
  }
  const fail = (): never => {
    throw new PyConvertError('bad json')
  }
  const parseString = (): string => {
    const start = i
    i++
    while (i < text.length && text[i] !== '"') i += text[i] === '\\' ? 2 : 1
    if (i >= text.length) fail()
    i++
    return JSON.parse(text.slice(start, i)) as string
  }
  const parseValue = (): PyValue => {
    ws()
    const ch = text[i]
    if (ch === '{') {
      i++
      const entries: [string, PyValue][] = []
      const index = new Map<string, number>()
      ws()
      if (text[i] === '}') {
        i++
        return { t: 'dict', entries }
      }
      for (;;) {
        ws()
        if (text[i] !== '"') fail()
        const key = parseString()
        ws()
        if (text[i] !== ':') fail()
        i++
        const val = parseValue()
        const at = index.get(key)
        if (at === undefined) {
          index.set(key, entries.length)
          entries.push([key, val])
        } else entries[at]![1] = val
        ws()
        if (text[i] === ',') {
          i++
          continue
        }
        if (text[i] === '}') {
          i++
          return { t: 'dict', entries }
        }
        fail()
      }
    }
    if (ch === '[') {
      i++
      const items: PyValue[] = []
      ws()
      if (text[i] === ']') {
        i++
        return items
      }
      for (;;) {
        items.push(parseValue())
        ws()
        if (text[i] === ',') {
          i++
          continue
        }
        if (text[i] === ']') {
          i++
          return items
        }
        fail()
      }
    }
    if (ch === '"') return { t: 'str', v: parseString() }
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
    const m = /^-?(?:0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?/.exec(text.slice(i))
    if (!m) return fail()
    i += m[0].length
    if (m[1] === undefined && m[2] === undefined) return { t: 'int', v: BigInt(m[0]) }
    return { t: 'float', v: Number(m[0]) }
  }
  const value = parseValue()
  ws()
  if (i !== text.length) fail()
  return value
}

/** PostgreSQL array text (`{1,2}`, `{{1,2},{3,4}}`, `{"a,b",NULL}`) → nested array whose elements are raw text or null */
type RawArray = (string | null | RawArray)[]
export function parsePgArray(text: string): RawArray {
  let i = 0
  // Output with explicit bounds `[0:1]={...}`
  if (text.startsWith('[')) {
    const eq = text.indexOf('=')
    if (eq >= 0) i = eq + 1
  }
  const parse = (): RawArray => {
    if (text[i] !== '{') throw new PyConvertError('bad array')
    i++
    const out: RawArray = []
    if (text[i] === '}') {
      i++
      return out
    }
    for (;;) {
      if (text[i] === '{') out.push(parse())
      else if (text[i] === '"') {
        i++
        let s = ''
        while (i < text.length && text[i] !== '"') {
          if (text[i] === '\\') i++
          s += text[i] ?? ''
          i++
        }
        i++
        out.push(s)
      } else {
        const start = i
        while (i < text.length && text[i] !== ',' && text[i] !== '}') i++
        const raw = text.slice(start, i)
        out.push(raw === 'NULL' ? null : raw)
      }
      if (text[i] === ',') {
        i++
        continue
      }
      if (text[i] === '}') {
        i++
        return out
      }
      throw new PyConvertError('bad array')
    }
  }
  return parse()
}

type Scalar = (text: string) => PyValue

/** PostgreSQL range text (`[1,5)`, `empty`, `(,5]`, `["2024-01-01 00:00:00","2024-01-02 00:00:00")`) */
function parseRange(text: string, cls: string, element: Scalar): PyRange {
  if (text === 'empty') return { t: 'range', cls, bounds: null, lower: null, upper: null }
  let i = 1
  const token = (terminators: string): string | null => {
    if (text[i] === '"') {
      i++
      let s = ''
      while (i < text.length) {
        const ch = text[i]!
        if (ch === '\\') {
          s += text[i + 1] ?? ''
          i += 2
        } else if (ch === '"') {
          if (text[i + 1] === '"') {
            s += '"'
            i += 2
          } else {
            i++
            break
          }
        } else {
          s += ch
          i++
        }
      }
      return s
    }
    const start = i
    while (i < text.length && !terminators.includes(text[i]!)) i++
    return i === start ? null : text.slice(start, i)
  }
  const lower = token(',')
  i++ // ','
  const upper = token(')]')
  const bounds = `${text[0]}${text[text.length - 1]}`
  return {
    t: 'range',
    cls,
    bounds,
    lower: lower === null ? null : element(lower),
    upper: upper === null ? null : element(upper),
  }
}

const intOf: Scalar = (s) => ({ t: 'int', v: BigInt(s) })
const floatOf: Scalar = (s) => ({ t: 'float', v: s === 'NaN' ? Number.NaN : Number(s) })
const strOf: Scalar = (s) => ({ t: 'str', v: s })

/** Scalar type OID → converter (unlisted types are returned as the raw string) */
const SCALARS: Record<number, Scalar> = {
  16: (s) => s === 't',
  20: intOf,
  21: intOf,
  23: intOf,
  26: intOf,
  700: floatOf,
  701: floatOf,
  1700: (s) => ({ t: 'decimal', v: s }),
  25: strOf,
  1043: strOf,
  1042: strOf,
  19: strOf,
  18: strOf,
  1082: parseDate,
  1083: (s) => parseTime(s, false),
  1266: (s) => parseTime(s, true),
  1114: (s) => parseTimestamp(s, false),
  1184: (s) => parseTimestamp(s, true),
  1186: parseInterval,
  114: parseJsonPy,
  3802: parseJsonPy,
  2950: (s) => ({ t: 'uuid', v: s }),
  17: (s) => ({ t: 'memory', v: s }),
  3904: (s) => parseRange(s, 'NumericRange', intOf),
  3926: (s) => parseRange(s, 'NumericRange', intOf),
  3906: (s) => parseRange(s, 'NumericRange', (v) => ({ t: 'decimal', v })),
  3912: (s) => parseRange(s, 'DateRange', parseDate),
  3908: (s) => parseRange(s, 'DateTimeRange', (v) => parseTimestamp(v, false)),
  3910: (s) => parseRange(s, 'DateTimeTZRange', (v) => parseTimestamp(v, true)),
}

/** Array type OID → element type OID (unlisted array types are returned as the raw string) */
const ARRAYS: Record<number, number> = {
  1000: 16,
  1005: 21,
  1007: 23,
  1016: 20,
  1028: 26,
  1021: 700,
  1022: 701,
  1231: 1700,
  1009: 25,
  1015: 1043,
  1014: 1042,
  1003: 19,
  1002: 18,
  1182: 1082,
  1183: 1083,
  1270: 1266,
  1115: 1114,
  1185: 1184,
  1187: 1186,
  199: 114,
  3807: 3802,
  2951: 2950,
  1001: 17,
  // These array types are parsed as string arrays (the element type itself has no converter)
  1041: 25,
  651: 25,
  1040: 25,
  1006: 21,
  1013: 26,
  3905: 3904,
  3927: 3926,
  3907: 3906,
  3913: 3912,
  3909: 3908,
  3911: 3910,
}

function convertArray(raw: RawArray, element: Scalar): PyValue[] {
  return raw.map((item) => (item === null ? null : Array.isArray(item) ? convertArray(item, element) : element(item)))
}

/** One column's raw text → value model */
export function pgToPy(text: string | null, oid: number): PyValue {
  if (text === null) return null
  const scalar = SCALARS[oid]
  if (scalar) return scalar(text)
  const elementOid = ARRAYS[oid]
  if (elementOid !== undefined) return convertArray(parsePgArray(text), SCALARS[elementOid]!)
  return { t: 'str', v: text }
}
