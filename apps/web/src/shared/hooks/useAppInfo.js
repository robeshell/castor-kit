import { useEffect, useState } from 'react'
import { getAppInfo } from '@/modules/admin/api/auth'

// Fetched once per page load and shared by every caller (login page, demo banner)
let cached = null
let pending = null

function load() {
  pending ??= getAppInfo()
    .then((info) => (cached = info))
    .catch(() => (cached = { demo_mode: false }))
  return pending
}

/**
 * Public app info: `{ demo_mode, demo_reset_hours?, demo_account? }`.
 * Returns null until loaded; failures count as "not a demo".
 */
export function useAppInfo() {
  const [info, setInfo] = useState(cached)
  useEffect(() => {
    if (cached) return undefined
    let alive = true
    load().then((value) => {
      if (alive) setInfo(value)
    })
    return () => {
      alive = false
    }
  }, [])
  return info
}
