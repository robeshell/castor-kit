import i18n from '@/i18n'

/**
 * Display formatting. Backend times are ISO 8601-style UTC text (YYYY-MM-DDTHH:MM:SS[.ffffff], no Z);
 * they are truncated for display as is (value.slice(0, 19).replace('T', ' ')), with no time zone conversion.
 */
export function formatDateTime(value, fallback = '-') {
  if (!value || typeof value !== 'string') return fallback
  return value.slice(0, 19).replace('T', ' ')
}

export function formatDate(value, fallback = '-') {
  if (!value || typeof value !== 'string') return fallback
  return value.slice(0, 10)
}

export function formatNumber(value, fallback = '-') {
  const n = typeof value === 'string' ? Number(value) : value
  return Number.isFinite(n) ? new Intl.NumberFormat(i18n.language).format(n) : fallback
}

/** Relative time: just now / N minutes ago / N hours ago / N days ago (follows the current language; input is UTC isoformat text) */
export function formatRelative(value, fallback = '-') {
  if (!value || typeof value !== 'string') return fallback
  const ts = Date.parse(`${value.slice(0, 23)}Z`)
  if (!Number.isFinite(ts)) return fallback
  const diff = Math.max(0, Date.now() - ts) / 1000
  if (diff < 60) return i18n.t('刚刚')
  if (diff < 3600) return i18n.t('{{count}} 分钟前', { count: Math.floor(diff / 60) })
  if (diff < 86400) return i18n.t('{{count}} 小时前', { count: Math.floor(diff / 3600) })
  if (diff < 86400 * 30) return i18n.t('{{count}} 天前', { count: Math.floor(diff / 86400) })
  return value.slice(0, 10)
}
