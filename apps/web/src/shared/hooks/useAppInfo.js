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

/** Drop the cached app info, so pages mounted later load it again (after system settings are saved) */
export function invalidateAppInfo() {
  cached = null
  pending = null
}

/**
 * Public app info: `{ demo_mode, demo_reset_hours?, demo_account?, upload: { max_size, allowed_types },
 * security: { totp_enabled, password_reset_enabled, password_policy } }`.
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

const IMAGE_TYPES = ['jpg', 'jpeg', 'png', 'gif', 'webp']

/**
 * Server-side upload limits, for checking a file before sending it: `{ maxSizeMB, accept, imageAccept }`.
 * `accept` / `imageAccept` are '.ext,.ext' lists; until app-info loads they are undefined (no client-side check).
 */
export function useUploadLimits() {
  const upload = useAppInfo()?.upload
  if (!upload) return { maxSizeMB: undefined, accept: undefined, imageAccept: undefined }
  const types = upload.allowed_types || []
  const images = IMAGE_TYPES.filter((t) => types.includes(t))
  return {
    maxSizeMB: Math.round((upload.max_size / 1024 / 1024) * 10) / 10,
    accept: types.map((t) => `.${t}`).join(','),
    imageAccept: images.map((t) => `.${t}`).join(','),
  }
}
