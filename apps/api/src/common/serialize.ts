/**
 * Timestamps in the API: ISO 8601 / RFC 3339 in UTC, always six fraction digits and a `Z`:
 * `YYYY-MM-DDTHH:mm:ss.ffffffZ`. Clients parse it with any standard date library (`new Date(value)`).
 *
 * Timestamp columns are `timestamp` (without time zone) holding UTC, written with `timezone('utc', now())`, and read
 * back from the driver as raw text (see the type parsers in db/client.ts and mode:'string' in the schema).
 * `toIso()` works on that text without JS `Date`, which only has millisecond precision:
 * - replaces the space between date and time with `T`
 * - right-pads fractional seconds to 6 digits (PostgreSQL text output drops trailing zeros: `.68794` → `.687940`)
 * - appends `Z`
 * Never use `Date#toISOString()` in responses (it keeps milliseconds only).
 */

const DB_TIMESTAMP_RE = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?$/

/** DB timestamp text (UTC) → the API format; null stays null */
export function toIso(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null
  const m = DB_TIMESTAMP_RE.exec(value)
  if (!m) return value
  return `${m[1]}T${m[2]}.${(m[3] ?? '').padEnd(6, '0')}Z`
}

function pad(n: number, width = 2): string {
  return String(n).padStart(width, '0')
}

function utcParts(now: Date): [date: string, time: string, fraction: string] {
  return [
    `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())}`,
    `${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(now.getUTCSeconds())}`,
    `${pad(now.getUTCMilliseconds(), 3)}000`,
  ]
}

/** The current time in the API format (JS has milliseconds only: the last three fraction digits are 0) */
export function utcNowIso(now: Date = new Date()): string {
  const [date, time, fraction] = utcParts(now)
  return `${date}T${time}.${fraction}Z`
}

/** The current time as DB timestamp text (UTC, no zone), for values written to the database or stored as text */
export function utcNowText(now: Date = new Date()): string {
  const [date, time, fraction] = utcParts(now)
  return `${date} ${time}.${fraction}`
}

/** DB timestamp text (UTC, no zone) → epoch milliseconds; NaN when it isn't timestamp text */
export function utcTextToMillis(value: string): number {
  const m = DB_TIMESTAMP_RE.exec(value)
  return m ? Date.parse(`${m[1]}T${m[2]}.${(m[3] ?? '').padEnd(3, '0').slice(0, 3)}Z`) : Number.NaN
}

/** Format as `YYYY-MM-DD HH:mm:ss` (input is raw timestamp text from the DB, UTC: exported files carry UTC time); empty values return '' */
export function formatDateTime(value: string | null | undefined): string {
  return value ? value.replace('T', ' ').slice(0, 19) : ''
}

/** Format as `YYYY-MM-DD`; empty values return '' */
export function formatDate(value: string | null | undefined): string {
  return value ? value.slice(0, 10) : ''
}
