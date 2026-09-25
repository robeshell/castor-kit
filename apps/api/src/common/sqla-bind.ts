/**
 * Binding rules for writing raw (unvalidated) JSON request body values into columns.
 *
 * Values are persisted to the DB as if by "SQL literal + PG assignment cast":
 * - `2.5` → rounds to 3 in an integer column, `true` → stored as 'true' in a varchar column, `['a','b']` → stored as '{a,b}' in a varchar column,
 *   objects (dict) cannot be adapted and error out;
 * - boolean columns accept only true/false/null/0/1; anything else errors.
 * node-pg sends every param as text, which behaves differently, so values are converted here first (or a 500 is thrown).
 * Externally these errors all surface as the generic 500 message, so they uniformly throw ServiceError(..., 500).
 *
 * Currently shared by dicts / notification / announcement; consider moving up into common/py.ts.
 */

import { ServiceError } from '@/common/errors'

function bindError(message: string): ServiceError {
  return new ServiceError(message, 500)
}

const PG_INT_MIN = -2_147_483_648
const PG_INT_MAX = 2_147_483_647

function pgArrayElement(value: unknown): string {
  if (value === null || value === undefined) return 'NULL'
  if (typeof value === 'boolean') return value ? 't' : 'f'
  if (typeof value === 'number') return String(value)
  const text = String(value)
  if (text === '' || /[{}",\\\s]/.test(text) || text.toUpperCase() === 'NULL') {
    return `"${text.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
  }
  return text
}

/** A list is treated as ARRAY[...]; assigned to a text column it is stored as PG array text (only 1-D arrays of a single element type) */
function pgArrayText(values: unknown[]): string {
  const kinds = new Set(values.filter((v) => v !== null && v !== undefined).map((v) => typeof v))
  if (kinds.size > 1 || [...kinds].some((k) => k === 'object')) throw bindError('cannot adapt list')
  return `{${values.map(pgArrayElement).join(',')}}`
}

/** Text columns (String / Text) */
export function bindText(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'string') return value
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'number') return String(value)
  if (Array.isArray(value)) return pgArrayText(value)
  throw bindError("can't adapt type 'dict'")
}

/** Integer columns: non-integer numbers follow the PG numeric → integer assignment cast (rounded half away from zero) */
export function bindInt(value: unknown): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') {
    const n = Number.isInteger(value) ? value : Math.sign(value) * Math.round(Math.abs(value))
    if (n < PG_INT_MIN || n > PG_INT_MAX) throw bindError('integer out of range')
    return n
  }
  if (typeof value === 'string') {
    // PG integer input: leading/trailing whitespace and a sign are allowed
    const text = value.trim()
    if (!/^[+-]?\d+$/.test(text)) throw bindError(`invalid input syntax for type integer: "${value}"`)
    const n = Number(text)
    if (n < PG_INT_MIN || n > PG_INT_MAX) throw bindError('integer out of range')
    return n
  }
  throw bindError('column is of type integer')
}

/** Boolean columns: strict, only null/true/false/0/1 accepted */
export function bindBool(value: unknown): boolean | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'boolean') return value
  if (value === 0 || value === 1) return value === 1
  throw bindError(`Not a boolean value: ${String(value)}`)
}

/**
 * Raw value used for primary-key/integer-column lookups (`Model.query.get(raw)` / `filter(col == raw)`):
 * Returns null for "can never match" (None, non-integer numbers); invalid strings/types throw 500.
 */
export function lookupInt(value: unknown): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number' && !Number.isInteger(value)) return null
  return bindInt(value)
}

/**
 * Python `==` used to detect column value changes: numbers and bools compare numerically (`1 == True`),
 * strings compare exactly, other types are never equal. Equal columns are left out of the UPDATE.
 */
export function pyEq(newValue: unknown, current: unknown): boolean {
  const a = newValue === undefined ? null : newValue
  const b = current === undefined ? null : current
  if (a === null || b === null) return a === b
  const numeric = (v: unknown) => typeof v === 'number' || typeof v === 'boolean'
  if (numeric(a) && numeric(b)) return Number(a) === Number(b)
  if (typeof a === 'string' && typeof b === 'string') return a === b
  return false
}

/** Skip null-valued columns on INSERT (so app-side defaults apply): null → undefined */
export function omitNull<T>(value: T | null): T | undefined {
  return value === null ? undefined : value
}
