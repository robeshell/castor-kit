/**
 * Rules for handling "loosely typed request body values" on writes/queries (shared by roles / menu / logs).
 *
 * When raw request body values are used directly as column values or `id IN (...)` params, they behave like "SQL literal + PostgreSQL assignment cast":
 * - text columns: str as-is; int/float → numeric text; bool → 'true'/'false'; list → PG array text (e.g. `{1,2}`); dict → 500
 * - integer columns: int as-is; float → rounded (half away from 0); str → PG int4 parsing (invalid → 500); bool/list/dict → 500
 * - boolean columns: strict, only None/True/False/0/1 accepted, anything else → 500
 * - `id IN (...)`: the param must be a list (dict → its keys); int elements beyond int4 range or non-integer floats simply "don't match",
 *   str goes through int4 parsing (invalid → 500), None doesn't match, bool/list/dict → 500
 * All these errors throw `ServiceError(..., 500)`; the global error handler emits the generic message.
 */

import { ServiceError } from '@/common/errors'
import { isPlainObject, pyStr, pyTruthy } from '@/common/py'
import { normalizeTableFileType, type TableFileType } from '@/common/tabular'

const INT4_MIN = -2_147_483_648
const INT4_MAX = 2_147_483_647
/** Leading/trailing whitespace accepted by PostgreSQL int4in (isspace) */
const PG_INT_RE = /^[ \t\n\r\v\f]*([+-]?\d+)[ \t\n\r\v\f]*$/

/** Input with an invalid type / missing attribute / that makes the DB error → 500 */
export function internalError(detail: string): ServiceError {
  return new ServiceError(detail, 500)
}

/** Whether a DB execution error (incl. the drizzle-wrapped cause chain) mentions a constraint/keyword; equivalent to `'menus_pkey' in str(e)` */
export function dbErrorMentions(err: unknown, needle: string): boolean {
  let cur: unknown = err
  for (let depth = 0; cur && depth < 5; depth += 1) {
    const e = cur as { message?: unknown; constraint?: unknown; cause?: unknown }
    if (e.constraint === needle) return true
    if (typeof e.message === 'string' && e.message.includes(needle)) return true
    cur = e.cause
  }
  return false
}

/** Python `for x in value` (list elements / dict keys / str chars); other types are not iterable → 500 */
export function pyIterate(value: unknown): unknown[] {
  if (Array.isArray(value)) return value
  if (typeof value === 'string') return [...value]
  if (isPlainObject(value)) return Object.keys(value)
  throw internalError(`'${typeof value}' object is not iterable`)
}

/** Python `==` (covers JSON values and DB scalars only): bool and numbers compare numerically, everything else requires same type and strict equality */
export function pyEq(a: unknown, b: unknown): boolean {
  if (a === null || a === undefined || b === null || b === undefined) {
    return (a === null || a === undefined) && (b === null || b === undefined)
  }
  const numLike = (v: unknown) => typeof v === 'number' || typeof v === 'boolean'
  if (numLike(a) && numLike(b)) return Number(a) === Number(b)
  if (typeof a === 'string' && typeof b === 'string') return a === b
  return false
}

function parsePgInt(text: string): number {
  const m = PG_INT_RE.exec(text)
  if (!m) throw internalError(`invalid input syntax for type integer: "${text}"`)
  const n = Number(m[1])
  if (n < INT4_MIN || n > INT4_MAX) throw internalError(`value "${text}" is out of range for type integer`)
  return n
}

/** Decimal output of PG numeric → text (no exponent) */
function numberText(value: number): string {
  if (Number.isInteger(value)) return BigInt(value).toString()
  const text = String(value)
  if (!/e/i.test(text)) return text
  const [mantissa, expRaw] = text.toLowerCase().split('e') as [string, string]
  const exp = Number(expRaw)
  const negative = mantissa.startsWith('-')
  const [intPart, fracPart = ''] = mantissa.replace('-', '').split('.') as [string, string?]
  const digits = intPart + fracPart
  const point = intPart.length + exp
  let out: string
  if (point <= 0) out = `0.${'0'.repeat(-point)}${digits}`
  else if (point >= digits.length) out = digits + '0'.repeat(point - digits.length)
  else out = `${digits.slice(0, point)}.${digits.slice(point)}`
  return (negative ? '-' : '') + out
}

/** Element quoting rules of PG array_out */
function arrayElementText(text: string): string {
  const needsQuote = text === '' || /^null$/i.test(text) || /[{}",\\ \t\n\r\v\f]/.test(text)
  return needsQuote ? `"${text.replace(/(["\\])/g, '\\$1')}"` : text
}

/** A list is treated as `ARRAY[...]`; assigned to a text column it is stored as PG array text */
function pgArrayText(items: unknown[]): string {
  const kinds = new Set(items.filter((v) => v !== null && v !== undefined).map((v) => typeof v))
  if (kinds.size > 1 || [...kinds].some((k) => !['string', 'number', 'boolean'].includes(k))) {
    throw internalError('cannot adapt list value')
  }
  const parts = items.map((v) => {
    if (v === null || v === undefined) return 'NULL'
    if (typeof v === 'boolean') return v ? 't' : 'f'
    if (typeof v === 'number') return numberText(v)
    return arrayElementText(v as string)
  })
  return `{${parts.join(',')}}`
}

/** Value assigned to a varchar/text column */
export function adaptText(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'string') return value
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'number') return numberText(value)
  if (Array.isArray(value)) return pgArrayText(value)
  throw internalError("can't adapt type 'dict'")
}

/** Value assigned to an integer column */
export function adaptInt(value: unknown): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') {
    const n = Number.isInteger(value) ? value : Math.sign(value) * Math.round(Math.abs(value))
    if (n < INT4_MIN || n > INT4_MAX) throw internalError('integer out of range')
    return n
  }
  if (typeof value === 'string') return parsePgInt(value)
  throw internalError(`column is of type integer but expression is of type ${typeof value}`)
}

/** Value assigned to a boolean column (strict: only null/true/false/0/1 accepted) */
export function adaptBool(value: unknown): boolean | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'boolean') return value
  if (value === 0) return false
  if (value === 1) return true
  throw internalError(`Value ${pyStr(value)} is not None, True, or False`)
}

/** Equivalent to `Model.id.in_(values)`: returns integer ids safe for inArray (may be empty = matches no rows) */
export function adaptIdsForIn(values: unknown): number[] {
  let items: unknown[]
  if (Array.isArray(values)) items = values
  else if (isPlainObject(values)) items = Object.keys(values)
  else throw internalError('IN expression list, SELECT construct, or bound parameter object expected')

  const out: number[] = []
  for (const v of items) {
    if (v === null || v === undefined) continue
    if (typeof v === 'number') {
      if (Number.isInteger(v) && v >= INT4_MIN && v <= INT4_MAX) out.push(v)
      continue
    }
    if (typeof v === 'string') {
      out.push(parsePgInt(v))
      continue
    }
    throw internalError('operator does not exist: integer = <non-integer>')
  }
  return [...new Set(out)]
}

/** `filters.get(key)` → 500 when filters is not a dict */
export function dictGet(obj: unknown, key: string): unknown {
  if (!isPlainObject(obj)) throw internalError(`'${typeof obj}' object has no attribute 'get'`)
  return obj[key]
}

export interface ExportArgs {
  ids: unknown
  exportMode: string
  filters: unknown
  fileType: TableFileType
  validFields: string[]
}

/**
 * The shared first half of every module's export_xxx:
 * ```py
 * ids = data.get('ids') or []
 * fields = data.get('fields') or []
 * export_mode = (data.get('export_mode') or 'selected').strip()
 * filters = data.get('filters') or {}
 * file_type = normalize_table_file_type(data.get('file_type'), default='csv')
 * valid_fields = [field for field in fields if field in EXPORT_FIELD_MAP] or list(EXPORT_FIELD_MAP.keys())
 * ```
 */
export function parseExportArgs(data: Record<string, unknown>, fieldMap: Record<string, unknown>): ExportArgs {
  const ids = pyTruthy(data.ids) ? data.ids : []
  const fields = pyTruthy(data.fields) ? data.fields : []
  const modeRaw = pyTruthy(data.export_mode) ? data.export_mode : 'selected'
  if (typeof modeRaw !== 'string') throw internalError("object has no attribute 'strip'")
  const filters = pyTruthy(data.filters) ? data.filters : {}
  const fileType = normalizeTableFileType(pyTruthy(data.file_type) ? pyStr(data.file_type) : '')

  const validFields: string[] = []
  for (const field of pyIterate(fields)) {
    if (field !== null && typeof field === 'object') throw internalError('unhashable type')
    if (typeof field === 'string' && Object.hasOwn(fieldMap, field)) validFields.push(field)
  }
  return {
    ids,
    exportMode: modeRaw.trim(),
    filters,
    fileType,
    validFields: validFields.length > 0 ? validFields : Object.keys(fieldMap),
  }
}

/** Selected-rows export mode: `if not isinstance(ids, list) or not ids` */
export function selectedIdsOrNull(ids: unknown): unknown[] | null {
  return Array.isArray(ids) && ids.length > 0 ? ids : null
}

/**
 * Request body used as a dict (`data.get(...)`):
 * falsy values (null / [] / 0 / '' / false) → {}; any other truthy non-dict → 500.
 * (common/http.jsonBody treats every non-object as {}; this is stricter.)
 */
export function dictBody(raw: unknown): Record<string, unknown> {
  if (isPlainObject(raw)) return raw
  if (!pyTruthy(raw)) return {}
  throw internalError("object has no attribute 'get'")
}

/**
 * For handlers that only access via `'key' in data` (update_role): `in` on a list is always False (same as {});
 * `in` on a str is a substring test, and on a hit `data[key]` raises TypeError; `in` on a number / bool raises TypeError directly.
 */
export function membershipBody(raw: unknown, keys: readonly string[]): Record<string, unknown> {
  if (isPlainObject(raw)) return raw
  if (!pyTruthy(raw) || Array.isArray(raw)) return {}
  if (typeof raw === 'string' && !keys.some((k) => raw.includes(k))) return {}
  throw internalError('argument of type is not iterable')
}
