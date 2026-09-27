/**
 * The caller's time zone (IANA name, e.g. `Asia/Shanghai`), for what is written for people rather than programs:
 * times in exported CSV / XLSX files, times read from import files, and the dashboard's days.
 *
 * The web app sends it in the `X-Time-Zone` header on every request; a missing or unknown zone is UTC. API responses
 * are not affected: they always carry UTC times with a `Z` (common/serialize.ts).
 *
 * The zone is kept in an AsyncLocalStorage for the whole request (registerTimeZone), so code deep in an export
 * (a column's value function) reads it with currentTimeZone() instead of having it passed down.
 */

import { AsyncLocalStorage } from 'node:async_hooks'
import type { FastifyInstance, FastifyRequest } from 'fastify'

export const TIME_ZONE_HEADER = 'x-time-zone'

const store = new AsyncLocalStorage<string>()

/** Whether the runtime knows this IANA time zone name */
export function isTimeZone(value: unknown): value is string {
  if (typeof value !== 'string' || value === '' || value.length > 64) return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value })
    return true
  } catch {
    return false
  }
}

/** The request's X-Time-Zone header when it names a known zone, else UTC */
export function requestTimeZone(request: FastifyRequest): string {
  const raw = request.headers[TIME_ZONE_HEADER]
  const value = Array.isArray(raw) ? raw[0] : raw
  return isTimeZone(value) ? value : 'UTC'
}

/** The current request's time zone (UTC outside a request) */
export function currentTimeZone(): string {
  return store.getStore() ?? 'UTC'
}

/** Run fn with a time zone as the current one (scripts and tests) */
export function withTimeZone<T>(timeZone: string, fn: () => T): T {
  return store.run(timeZone, fn)
}

export function registerTimeZone(app: FastifyInstance): void {
  app.addHook('onRequest', (request, _reply, done) => store.run(requestTimeZone(request), done))
}

const pad = (n: number) => String(n).padStart(2, '0')
const formatters = new Map<string, Intl.DateTimeFormat>()

function wallParts(ms: number, timeZone: string): [y: number, mo: number, d: number, h: number, mi: number, s: number] {
  let formatter = formatters.get(timeZone)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    formatters.set(timeZone, formatter)
  }
  const part = (type: string, parts: Intl.DateTimeFormatPart[]) => Number(parts.find((p) => p.type === type)!.value)
  const parts = formatter.formatToParts(new Date(ms))
  return [part('year', parts), part('month', parts), part('day', parts), part('hour', parts), part('minute', parts), part('second', parts)]
}

/** An instant as wall time in a zone: `YYYY-MM-DD HH:mm:ss` */
export function formatInZone(ms: number, timeZone: string): string {
  const [y, mo, d, h, mi, s] = wallParts(ms, timeZone)
  return `${String(y).padStart(4, '0')}-${pad(mo)}-${pad(d)} ${pad(h)}:${pad(mi)}:${pad(s)}`
}

/** The zone's offset from UTC at an instant, in minutes (Asia/Shanghai → 480) */
export function zoneOffsetMinutes(ms: number, timeZone: string): number {
  const [y, mo, d, h, mi, s] = wallParts(ms, timeZone)
  return Math.round((Date.UTC(y, mo - 1, d, h, mi, s) - Math.floor(ms / 1000) * 1000) / 60_000)
}

const LOCAL_TEXT_RE = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,6})?)?$/

/**
 * Wall time written without an offset (an import cell) → the same text with the zone's offset appended
 * (`2026-01-15 08:30` in Asia/Shanghai → `2026-01-15 08:30+08:00`), for field.dateTime to convert to UTC.
 * Text that already has an offset, or isn't a date-time, is returned as it is.
 */
export function withZoneOffset(text: string, timeZone: string = currentTimeZone()): string {
  const m = LOCAL_TEXT_RE.exec(text.trim())
  if (!m) return text
  const asUtc = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6] ?? 0))
  // The offset at the wall time itself: take it at the UTC guess, then again at the corrected instant (DST edges)
  let offset = zoneOffsetMinutes(asUtc, timeZone)
  offset = zoneOffsetMinutes(asUtc - offset * 60_000, timeZone)
  const sign = offset < 0 ? '-' : '+'
  return `${text.trim()}${sign}${pad(Math.floor(Math.abs(offset) / 60))}:${pad(Math.abs(offset) % 60)}`
}
