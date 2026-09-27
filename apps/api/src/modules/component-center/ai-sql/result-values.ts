/**
 * Read-only query results → JSON values, by column type OID (the read-only engine returns every value as text).
 *
 * - boolean → true / false; int2 / int4 / oid → number; int8 → number, or its digits as a string beyond ±2^53
 * - float4 / float8 → number (NaN / ±Infinity → null: JSON has no literal for them)
 * - numeric → the PostgreSQL text (e.g. '12.50'), exact, like numeric columns elsewhere in the API
 * - json / jsonb → the parsed JSON value
 * - timestamp → `YYYY-MM-DDTHH:mm:ss[.ffffff]`; timestamptz with a `±HH:MM` offset
 * - arrays of these types → JSON arrays, element by element
 * - everything else (text, date, time, interval, uuid, bytea, ranges …) → the PostgreSQL text as it is
 */

type Convert = (text: string) => unknown

const intValue: Convert = (s) => {
  const n = Number(s)
  return Number.isSafeInteger(n) ? n : s
}
const floatValue: Convert = (s) => {
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}
const jsonValue: Convert = (s) => JSON.parse(s)
/** `2024-06-01 01:02:03.5+08` → `2024-06-01T01:02:03.5+08:00` */
const timestampValue: Convert = (s) => s.replace(' ', 'T').replace(/([+-]\d{2})$/, '$1:00')

const SCALARS: Record<number, Convert> = {
  16: (s) => s === 't',
  20: intValue,
  21: intValue,
  23: intValue,
  26: intValue,
  700: floatValue,
  701: floatValue,
  114: jsonValue,
  3802: jsonValue,
  1114: timestampValue,
  1184: timestampValue,
}

const asText: Convert = (s) => s

/** Array type OID → element type OID */
const ARRAYS: Record<number, number> = {
  1000: 16, 1005: 21, 1007: 23, 1016: 20, 1028: 26, 1021: 700, 1022: 701, 199: 114, 3807: 3802, 1115: 1114, 1185: 1184,
  // Arrays whose elements stay text
  1231: 25, 1009: 25, 1015: 25, 1014: 25, 1003: 25, 1002: 25, 1182: 25, 1183: 25, 1270: 25, 1187: 25, 2951: 25, 1001: 25,
  1041: 25, 651: 25, 1040: 25, 1006: 25, 1013: 25, 3905: 25, 3927: 25, 3907: 25, 3913: 25, 3909: 25, 3911: 25,
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
    if (text[i] !== '{') throw new Error('bad array')
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
      throw new Error('bad array')
    }
  }
  return parse()
}

function convertArray(raw: RawArray, element: Convert): unknown[] {
  return raw.map((item) => (item === null ? null : Array.isArray(item) ? convertArray(item, element) : element(item)))
}

/** One column's text → its JSON value */
export function columnValue(text: string | null, oid: number): unknown {
  if (text === null) return null
  const scalar = SCALARS[oid]
  if (scalar) return scalar(text)
  const elementOid = ARRAYS[oid]
  if (elementOid !== undefined) return convertArray(parsePgArray(text), SCALARS[elementOid] ?? asText)
  return text
}
