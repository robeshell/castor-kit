/**
 * Basic helpers with Python semantics: convert values in service/schema following Python `str()` / `int()` / `float()` / truthiness rules,
 * so JS implicit coercion doesn't silently change behavior on edge-case input. Per-module parse_bool/parse_int etc. are
 * implemented in each module's schema.ts (modules accept slightly different values; do not merge them).
 */

/** Python truthiness: None / '' / 0 / False / empty list / empty dict are falsy */
export function pyTruthy(value: unknown): boolean {
  if (value === null || value === undefined || value === false || value === 0 || value === '') return false
  if (typeof value === 'number' && Number.isNaN(value)) return true
  if (Array.isArray(value)) return value.length > 0
  if (typeof value === 'object') return Object.keys(value as object).length > 0
  return true
}

function pyRepr(value: unknown): string {
  if (typeof value === 'string') return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
  return pyStr(value)
}

/** Equivalent to Python `str(value)` (covers JSON-representable types; JSON 1.0 is already 1 in JS and cannot be told apart) */
export function pyStr(value: unknown): string {
  if (value === null || value === undefined) return 'None'
  if (value === true) return 'True'
  if (value === false) return 'False'
  if (typeof value === 'string') return value
  if (typeof value === 'number') {
    if (Number.isNaN(value)) return 'nan'
    if (!Number.isFinite(value)) return value > 0 ? 'inf' : '-inf'
    return String(value)
  }
  if (Array.isArray(value)) return `[${value.map(pyRepr).join(', ')}]`
  if (typeof value === 'object') {
    return `{${Object.entries(value as object)
      .map(([k, v]) => `${pyRepr(k)}: ${pyRepr(v)}`)
      .join(', ')}}`
  }
  return String(value)
}

/** Python `str(x or '').strip()`: falsy → '', otherwise stringified and trimmed */
export function pyStrOrEmpty(value: unknown): string {
  return pyTruthy(value) ? pyStr(value).trim() : ''
}

/** Python `.strip()` (trims leading/trailing whitespace, incl. Unicode whitespace such as the full-width space) */
export function pyStrip(text: string): string {
  return text.trim()
}

export class PyValueError extends Error {}

/**
 * Equivalent to Python `int(value)`:
 * - bool → 0/1; numbers → truncated toward zero
 * - strings → leading/trailing whitespace, sign and underscore grouping allowed; no decimal point
 * - anything else (None, list, dict, invalid string) throws PyValueError (TypeError/ValueError in Python)
 */
export function pyInt(value: unknown): number {
  if (typeof value === 'boolean') return value ? 1 : 0
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new PyValueError(`cannot convert ${value} to integer`)
    return Math.trunc(value)
  }
  if (typeof value === 'string') {
    const text = value.trim()
    if (/^[+-]?\d+(_\d+)*$/.test(text)) return Number.parseInt(text.replace(/_/g, ''), 10)
  }
  throw new PyValueError(`invalid literal for int(): ${pyRepr(value)}`)
}

/** Equivalent to Python `float(value)` */
export function pyFloat(value: unknown): number {
  if (typeof value === 'boolean') return value ? 1 : 0
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const text = value.trim().toLowerCase().replace(/_/g, '')
    if (/^[+-]?(nan)$/.test(text)) return Number.NaN
    if (/^[+-]?(inf|infinity)$/.test(text)) return text.startsWith('-') ? -Infinity : Infinity
    if (/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/.test(text)) return Number.parseFloat(text)
  }
  throw new PyValueError(`could not convert to float: ${pyRepr(value)}`)
}

/** `isinstance(value, dict)` */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
