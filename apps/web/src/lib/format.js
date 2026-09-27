import i18n from '@/i18n'

/**
 * Display formatting. The API writes times as ISO 8601 in UTC (`2026-08-01T12:35:48.834152Z`); they are shown in the
 * browser's time zone. Date-only values (`YYYY-MM-DD`) have no time zone and are shown as they are.
 */

const TIME_RE = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2})?)(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/

/** An API time → epoch milliseconds (text without a zone is UTC, as the API reads it); NaN when it isn't a date-time */
export function parseApiTime(value) {
  const m = typeof value === 'string' ? TIME_RE.exec(value.trim()) : null
  if (!m) return Number.NaN
  // Date.parse takes at most milliseconds reliably across browsers
  return Date.parse(`${m[1]}T${m[2]}${m[3] ? m[3].slice(0, 4) : ''}${m[4] ?? 'Z'}`)
}

const pad = (n) => String(n).padStart(2, '0')

/** Epoch milliseconds → local `YYYY-MM-DD` and `HH:mm:ss` */
export function localParts(ms) {
  const d = new Date(ms)
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`,
  }
}

/** Local date + time (`YYYY-MM-DD`, `HH:mm:ss`) → ISO 8601 with the browser's offset, e.g. `2026-08-01T20:35:48+08:00` */
export function localToIso(date, time) {
  const [y, mo, d] = date.split('-').map(Number)
  const [h, mi, s = 0] = time.split(':').map(Number)
  const offset = -new Date(y, mo - 1, d, h, mi, s).getTimezoneOffset()
  const sign = offset < 0 ? '-' : '+'
  return `${date}T${time}${sign}${pad(Math.floor(Math.abs(offset) / 60))}:${pad(Math.abs(offset) % 60)}`
}

/** An API time in the browser's time zone: `YYYY-MM-DD HH:mm:ss` */
export function formatDateTime(value, fallback = '-') {
  if (!value || typeof value !== 'string') return fallback
  const ms = parseApiTime(value)
  if (Number.isNaN(ms)) return value.slice(0, 19).replace('T', ' ')
  const { date, time } = localParts(ms)
  return `${date} ${time}`
}

/** A date (`YYYY-MM-DD`, shown as is) or the local date of an API time */
export function formatDate(value, fallback = '-') {
  if (!value || typeof value !== 'string') return fallback
  const ms = parseApiTime(value)
  return Number.isNaN(ms) ? value.slice(0, 10) : localParts(ms).date
}

export function formatNumber(value, fallback = '-') {
  const n = typeof value === 'string' ? Number(value) : value
  return Number.isFinite(n) ? new Intl.NumberFormat(i18n.language).format(n) : fallback
}

/** Relative time: just now / N minutes ago / N hours ago / N days ago (follows the current language; input is an API time) */
export function formatRelative(value, fallback = '-') {
  if (!value || typeof value !== 'string') return fallback
  const ts = parseApiTime(value)
  if (!Number.isFinite(ts)) return fallback
  const diff = Math.max(0, Date.now() - ts) / 1000
  if (diff < 60) return i18n.t('刚刚')
  if (diff < 3600) return i18n.t('{{count}} 分钟前', { count: Math.floor(diff / 60) })
  if (diff < 86400) return i18n.t('{{count}} 小时前', { count: Math.floor(diff / 3600) })
  if (diff < 86400 * 30) return i18n.t('{{count}} 天前', { count: Math.floor(diff / 86400) })
  return formatDate(value)
}

/** File size: 512 B / 1.5 KB / 3.2 MB / 1.1 GB */
export function formatBytes(value, fallback = '-') {
  const n = typeof value === 'string' ? Number(value) : value
  if (!Number.isFinite(n) || n < 0) return fallback
  if (n < 1024) return `${n} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let size = n / 1024
  let unit = 0
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024
    unit += 1
  }
  return `${size >= 100 ? Math.round(size) : Math.round(size * 10) / 10} ${units[unit]}`
}
