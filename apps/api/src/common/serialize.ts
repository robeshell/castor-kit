/**
 * Timestamp output format: `YYYY-MM-DDTHH:mm:ss[.ffffff]`, no `Z`, UTC value,
 * with no fractional part when microseconds are 0 (variable-length format).
 *
 * DB timestamps come back from the driver as raw text (see the type parsers in db/client.ts and mode:'string' in the schema);
 * `toIso()` does only two things, without JS `Date` (time zone and microsecond precision issues):
 * - replaces the space between date and time with `T`
 * - right-pads fractional seconds to 6 digits: PostgreSQL text output drops trailing zeros (`.68794`), the API always emits 6 (`.687940`)
 * Never use `Date#toISOString()` in responses.
 */

export function toIso(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null
  return value.replace(' ', 'T').replace(/\.(\d{1,5})$/, (_, frac: string) => `.${frac.padEnd(6, '0')}`)
}

function pad(n: number, width = 2): string {
  return String(n).padStart(width, '0')
}

/**
 * Current UTC time generated app-side, same format as toIso().
 * JS only has millisecond precision, so microseconds are padded with 000; the fraction is omitted when milliseconds are 0.
 */
export function utcNowIso(now: Date = new Date()): string {
  const base =
    `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())}` +
    `T${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(now.getUTCSeconds())}`
  const ms = now.getUTCMilliseconds()
  return ms === 0 ? base : `${base}.${pad(ms, 3)}000`
}

/** Format as `YYYY-MM-DD HH:mm:ss` (input is raw timestamp text from the DB); empty values return '' */
export function formatDateTime(value: string | null | undefined): string {
  return value ? value.replace('T', ' ').slice(0, 19) : ''
}

/** Format as `YYYY-MM-DD`; empty values return '' */
export function formatDate(value: string | null | undefined): string {
  return value ? value.slice(0, 10) : ''
}
