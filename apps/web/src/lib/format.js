/**
 * 展示格式化。后端时间是 ISO 8601 风格的 UTC 文本（YYYY-MM-DDTHH:MM:SS[.ffffff]，无 Z），
 * 这里按原样截断展示（value.slice(0, 19).replace('T', ' ')），不做时区换算。
 */
export function formatDateTime(value, fallback = '-') {
  if (!value || typeof value !== 'string') return fallback
  return value.slice(0, 19).replace('T', ' ')
}

export function formatDate(value, fallback = '-') {
  if (!value || typeof value !== 'string') return fallback
  return value.slice(0, 10)
}

const numberFormatter = new Intl.NumberFormat('zh-CN')
export function formatNumber(value, fallback = '-') {
  const n = typeof value === 'string' ? Number(value) : value
  return Number.isFinite(n) ? numberFormatter.format(n) : fallback
}

/** 相对时间：刚刚 / N 分钟前 / N 小时前 / N 天前（输入为 UTC isoformat 文本） */
export function formatRelative(value, fallback = '-') {
  if (!value || typeof value !== 'string') return fallback
  const ts = Date.parse(`${value.slice(0, 23)}Z`)
  if (!Number.isFinite(ts)) return fallback
  const diff = Math.max(0, Date.now() - ts) / 1000
  if (diff < 60) return '刚刚'
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400)} 天前`
  return value.slice(0, 10)
}
