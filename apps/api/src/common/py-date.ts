/**
 * Parses dates by the rules of Python 3.13 `date.fromisoformat()` (C implementation `_datetimemodule.c`),
 * shared by the date parsing (`parseLooseDate`) of four modules: kanban / detail-tabs / gantt / advanced-table.
 * (Consider moving this to common/py.ts later; it lives here for now per file ownership.)
 *
 * Key rules (unlike a "YYYY-MM-DD only" parser):
 * - length is counted in UTF-8 bytes and must be 7 / 8 / 10
 * - supports `YYYY-MM-DD`, `YYYYMMDD`, ISO week `YYYY-Www[-D]` / `YYYYWww[D]`
 * - no check that the input is fully consumed: `20240101ab` → 2024-01-01
 * - year 1..9999, month 1..12, day validated per month; week 1..52 (53 allowed in 53-week years), weekday 1..7
 * Pure calendar arithmetic, no JS `Date` involved.
 */

import { pyStr, pyTruthy } from '@/common/py'

const DAYS_IN_MONTH = [-1, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
const DAYS_BEFORE_MONTH = [-1, 0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334]

function isLeap(y: number): boolean {
  return y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0)
}

function daysBeforeYear(y: number): number {
  const yy = y - 1
  return yy * 365 + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400)
}

function ymdToOrd(y: number, m: number, d: number): number {
  return daysBeforeYear(y) + DAYS_BEFORE_MONTH[m]! + (m > 2 && isLeap(y) ? 1 : 0) + d
}

function divmod(a: number, b: number): [number, number] {
  const q = Math.floor(a / b)
  return [q, a - q * b]
}

/** Python `_ord2ymd` */
function ordToYmd(ordinal: number): [number, number, number] {
  let n = ordinal - 1
  let n400: number, n100: number, n4: number, n1: number
  ;[n400, n] = divmod(n, 146097)
  let year = n400 * 400 + 1
  ;[n100, n] = divmod(n, 36524)
  ;[n4, n] = divmod(n, 1461)
  ;[n1, n] = divmod(n, 365)
  year += n100 * 100 + n4 * 4 + n1
  if (n1 === 4 || n100 === 4) return [year - 1, 12, 31]
  const leap = n1 === 3 && (n4 !== 24 || n100 === 3)
  let month = (n + 50) >> 5
  let preceding = DAYS_BEFORE_MONTH[month]! + (month > 2 && leap ? 1 : 0)
  if (preceding > n) {
    month -= 1
    preceding -= DAYS_IN_MONTH[month]! + (month === 2 && leap ? 1 : 0)
  }
  n -= preceding
  return [year, month, n + 1]
}

function isoWeek1Monday(year: number): number {
  const firstDay = ymdToOrd(year, 1, 1)
  const firstWeekday = (firstDay + 6) % 7
  let week1Monday = firstDay - firstWeekday
  if (firstWeekday > 3) week1Monday += 7
  return week1Monday
}

const CH_0 = 0x30
const CH_DASH = 0x2d
const CH_W = 0x57

/** C `parse_digits`: read n ASCII digits; returns null when out of bounds (incl. reaching the end) */
function parseDigits(buf: Buffer, pos: number, n: number): [number, number] | null {
  let v = 0
  for (let i = 0; i < n; i += 1) {
    const c = buf[pos + i]
    if (c === undefined) return null
    const d = c - CH_0
    if (d < 0 || d > 9) return null
    v = v * 10 + d
  }
  return [v, pos + n]
}

function parseIsoformatDate(buf: Buffer): [number, number, number] | null {
  const len = buf.length
  let r = parseDigits(buf, 0, 4)
  if (!r) return null
  let [year, p] = r
  const usesSep = buf[p] === CH_DASH
  if (usesSep) p += 1

  if (buf[p] === CH_W) {
    p += 1
    r = parseDigits(buf, p, 2)
    if (!r) return null
    const week = r[0]
    p = r[1]
    let isoDay: number
    if (p < len) {
      if (usesSep) {
        if (buf[p] !== CH_DASH) return null
        p += 1
      }
      r = parseDigits(buf, p, 1)
      if (!r) return null
      isoDay = r[0]
    } else {
      isoDay = 1
    }
    // iso_to_ymd
    if (year < 1 || year > 9999) return null
    if (week <= 0 || week >= 53) {
      let outOfRange = true
      if (week === 53) {
        const firstWeekday = (ymdToOrd(year, 1, 1) + 6) % 7
        if (firstWeekday === 3 || (firstWeekday === 2 && isLeap(year))) outOfRange = false
      }
      if (outOfRange) return null
    }
    if (isoDay <= 0 || isoDay >= 8) return null
    return ordToYmd(isoWeek1Monday(year) + (week - 1) * 7 + isoDay - 1)
  }

  r = parseDigits(buf, p, 2)
  if (!r) return null
  const month = r[0]
  p = r[1]
  if (usesSep) {
    if (buf[p] !== CH_DASH) return null
    p += 1
  }
  r = parseDigits(buf, p, 2)
  if (!r) return null
  return [year, month, r[0]]
}

function pad(n: number, width: number): string {
  return String(n).padStart(width, '0')
}

/** Equivalent to Python `date.fromisoformat(text)`; returns null when invalid (Python raises ValueError) */
export function pyDateFromIsoformat(text: string): string | null {
  if (/\p{Cs}/u.test(text)) return null // lone surrogate: PyUnicode_AsUTF8AndSize fails
  const buf = Buffer.from(text, 'utf8')
  if (buf.length !== 7 && buf.length !== 8 && buf.length !== 10) return null
  const ymd = parseIsoformatDate(buf)
  if (!ymd) return null
  const [y, m, d] = ymd
  if (y < 1 || y > 9999 || m < 1 || m > 12) return null
  const dim = m === 2 && isLeap(y) ? 29 : DAYS_IN_MONTH[m]!
  if (d < 1 || d > dim) return null
  return `${pad(y, 4)}-${pad(m, 2)}-${pad(d, 2)}`
}

/**
 * The `_parse_date(value)` shared by the four modules:
 * ```python
 * if not value: return None
 * try: return date.fromisoformat(str(value)[:10])
 * except ValueError: return None
 * ```
 * Returns 'YYYY-MM-DD' text or null.
 */
export function parseLooseDate(value: unknown): string | null {
  if (!pyTruthy(value)) return null
  const text = Array.from(pyStr(value)).slice(0, 10).join('')
  return pyDateFromIsoformat(text)
}
