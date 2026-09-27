import { useEffect, useState } from 'react'
import { getAppInfo } from '@/modules/admin/api/auth'

export interface PasswordPolicy {
  min_length: number
  require_letters_digits: boolean
  require_symbol: boolean
}

/** GET /admin/app-info (public). upload / security / assistant are missing when the request failed */
export interface AppInfo {
  demo_mode: boolean
  demo_reset_hours?: number
  demo_account?: { username: string; password: string }
  upload?: {
    /** Bytes */
    max_size: number
    /** Extensions without the dot, e.g. ['png', 'pdf'] */
    allowed_types: string[]
  }
  security?: {
    totp_enabled: boolean
    password_reset_enabled: boolean
    password_policy: PasswordPolicy
  }
  /** The AI assistant is on */
  assistant?: boolean
}

const fetchAppInfo: () => Promise<AppInfo> = getAppInfo

// Fetched once per page load and shared by every caller (login page, demo banner, AI assistant)
let cached: AppInfo | null = null
let pending: Promise<AppInfo> | null = null
/** Mounted useAppInfo() hooks, told when the info is fetched again */
const listeners = new Set<(info: AppInfo) => void>()

function load(): Promise<AppInfo> {
  pending ??= fetchAppInfo()
    .then((info) => (cached = info))
    .catch(() => (cached = { demo_mode: false }))
  return pending
}

/** Fetch the app info again (after system settings are saved); mounted hooks get the new value */
export function invalidateAppInfo(): void {
  cached = null
  pending = null
  if (listeners.size > 0) load().then((info) => listeners.forEach((notify) => notify(info)))
}

/**
 * Public app info: `{ demo_mode, demo_reset_hours?, demo_account?, upload: { max_size, allowed_types },
 * security: { totp_enabled, password_reset_enabled, password_policy }, assistant }` (assistant: the AI assistant is on).
 * Returns null until loaded; failures count as "not a demo".
 */
export function useAppInfo(): AppInfo | null {
  const [info, setInfo] = useState<AppInfo | null>(cached)
  useEffect(() => {
    listeners.add(setInfo)
    let alive = true
    if (!cached) {
      load().then((value) => {
        if (alive) setInfo(value)
      })
    }
    return () => {
      alive = false
      listeners.delete(setInfo)
    }
  }, [])
  return info
}

const IMAGE_TYPES = ['jpg', 'jpeg', 'png', 'gif', 'webp']

/**
 * Server-side upload limits, for checking a file before sending it: `{ maxSizeMB, accept, imageAccept }`.
 * `accept` / `imageAccept` are '.ext,.ext' lists; until app-info loads they are undefined (no client-side check).
 */
/** '.ext,.ext' lists are undefined until app-info loads */
export interface UploadLimits {
  maxSizeMB: number | undefined
  accept: string | undefined
  imageAccept: string | undefined
}

export function useUploadLimits(): UploadLimits {
  const upload = useAppInfo()?.upload
  if (!upload) return { maxSizeMB: undefined, accept: undefined, imageAccept: undefined }
  const types = upload.allowed_types
  const images = IMAGE_TYPES.filter((t) => types.includes(t))
  return {
    maxSizeMB: Math.round((upload.max_size / 1024 / 1024) * 10) / 10,
    accept: types.map((t) => `.${t}`).join(','),
    imageAccept: images.map((t) => `.${t}`).join(','),
  }
}
