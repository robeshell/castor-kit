/**
 * System settings (系统设置): feature switches and parameters an admin can change at runtime.
 *
 * - The registry below is the only place keys are defined: type, default, bounds, and whether the browser may read it
 * - Values live in `system_settings` (jsonb); keys that were never saved use their default
 * - Reads go through an in-process cache refreshed every few seconds (the rate limiter reads it on every request);
 *   a write refreshes the local cache at once, other processes pick it up within CACHE_TTL_MS
 * - Secrets and infrastructure (SMTP, S3, database ...) stay in environment variables and are never stored here
 */

import type { AppConfig } from '@/config'
import type { Executor } from '@/db/client'
import { system_settings } from '@/db/schema'

type SettingType = 'boolean' | 'integer' | 'string_list'

export interface SettingDefinition {
  key: string
  group: 'security'
  type: SettingType
  default: (config: AppConfig) => SettingValue
  min?: number
  max?: number
  /** Readable without signing in (through /api/admin/app-info) */
  public?: boolean
  /** Why the switch can't be turned on in this deployment (e.g. SMTP isn't configured); null when it can */
  unavailable?: (config: AppConfig) => string | null
}

export type SettingValue = boolean | number | string[]

/** Upper bound of security.session_ttl_hours (the session cookie's own expiry is set to this) */
export const MAX_SESSION_TTL_HOURS = 720

export const SETTING_DEFINITIONS: SettingDefinition[] = [
  {
    key: 'security.totp_enabled',
    group: 'security',
    type: 'boolean',
    default: () => false,
    public: true,
    // The demo account is shared: a 2FA binding on it would lock everyone else out
    unavailable: (config) => (config.demoMode ? '演示环境不能开启此功能' : null),
  },
  { key: 'security.totp_required_roles', group: 'security', type: 'string_list', default: () => [] },
  {
    key: 'security.password_reset_enabled',
    group: 'security',
    type: 'boolean',
    default: () => false,
    public: true,
    unavailable: (config) =>
      config.demoMode
        ? '演示环境不能开启此功能'
        : config.mail.driver === 'none'
        ? '需要先配置邮件服务（SMTP_HOST 等环境变量）'
        : !config.appBaseUrl
          ? '需要先设置 APP_BASE_URL（重置链接里的网站地址）'
          : null,
  },
  { key: 'security.password_min_length', group: 'security', type: 'integer', default: () => 6, min: 6, max: 64, public: true },
  { key: 'security.password_require_letters_digits', group: 'security', type: 'boolean', default: () => false, public: true },
  { key: 'security.password_require_symbol', group: 'security', type: 'boolean', default: () => false, public: true },
  {
    key: 'security.session_ttl_hours',
    group: 'security',
    type: 'integer',
    default: (config) => config.sessionTtlHours,
    min: 1,
    max: MAX_SESSION_TTL_HOURS,
  },
  { key: 'security.rate_limit_per_minute', group: 'security', type: 'integer', default: () => 600, min: 60, max: 100_000 },
  { key: 'security.auth_rate_limit_per_minute', group: 'security', type: 'integer', default: () => 20, min: 3, max: 1000 },
]

const DEFINITIONS = new Map(SETTING_DEFINITIONS.map((d) => [d.key, d]))

export interface Settings {
  totpEnabled: boolean
  totpRequiredRoles: string[]
  passwordResetEnabled: boolean
  passwordMinLength: number
  passwordRequireLettersDigits: boolean
  passwordRequireSymbol: boolean
  sessionTtlHours: number
  rateLimitPerMinute: number
  authRateLimitPerMinute: number
}

function toSettings(values: Map<string, SettingValue>): Settings {
  const get = <T extends SettingValue>(key: string) => values.get(key) as T
  return {
    totpEnabled: get<boolean>('security.totp_enabled'),
    totpRequiredRoles: get<string[]>('security.totp_required_roles'),
    passwordResetEnabled: get<boolean>('security.password_reset_enabled'),
    passwordMinLength: get<number>('security.password_min_length'),
    passwordRequireLettersDigits: get<boolean>('security.password_require_letters_digits'),
    passwordRequireSymbol: get<boolean>('security.password_require_symbol'),
    sessionTtlHours: get<number>('security.session_ttl_hours'),
    rateLimitPerMinute: get<number>('security.rate_limit_per_minute'),
    authRateLimitPerMinute: get<number>('security.auth_rate_limit_per_minute'),
  }
}

export class SettingValidationError extends Error {}

/**
 * Validate one value against its definition; returns the normalized value.
 * `checkAvailable` rejects turning on a switch whose prerequisites are missing (off when re-reading stored values:
 * a prerequisite removed later just makes the feature unavailable at use time, see isAvailable).
 */
export function validateSetting(key: string, raw: unknown, config: AppConfig, checkAvailable = true): SettingValue {
  const def = DEFINITIONS.get(key)
  if (!def) throw new SettingValidationError(`未知的设置项：${key}`)
  switch (def.type) {
    case 'boolean':
      if (typeof raw !== 'boolean') throw new SettingValidationError(`设置项取值不合法：${key}`)
      if (raw && checkAvailable && def.unavailable) {
        const reason = def.unavailable(config)
        if (reason) throw new SettingValidationError(reason)
      }
      return raw
    case 'integer':
      if (typeof raw !== 'number' || !Number.isSafeInteger(raw) || raw < (def.min ?? -Infinity) || raw > (def.max ?? Infinity)) {
        throw new SettingValidationError(`设置项取值不合法：${key}`)
      }
      return raw
    case 'string_list':
      if (!Array.isArray(raw) || !raw.every((v) => typeof v === 'string' && v.trim() && v.length <= 100)) {
        throw new SettingValidationError(`设置项取值不合法：${key}`)
      }
      return [...new Set(raw.map((v) => (v as string).trim()))]
  }
}

export const CACHE_TTL_MS = 5000

/** Settings with defaults applied, cached per process */
export class SettingsStore {
  private cache: { settings: Settings; values: Map<string, SettingValue>; loadedAt: number } | null = null
  private loading: Promise<Settings> | null = null

  constructor(
    private readonly db: Executor,
    private readonly config: AppConfig,
  ) {}

  private defaults(): Map<string, SettingValue> {
    return new Map(SETTING_DEFINITIONS.map((d) => [d.key, d.default(this.config)]))
  }

  /** Stored values with defaults for the rest; a stored value that no longer validates falls back to the default */
  async values(): Promise<Map<string, SettingValue>> {
    await this.get()
    return this.cache!.values
  }

  async get(): Promise<Settings> {
    if (this.cache && Date.now() - this.cache.loadedAt < CACHE_TTL_MS) return this.cache.settings
    this.loading ??= this.load().finally(() => {
      this.loading = null
    })
    return this.loading
  }

  /**
   * Last loaded settings without waiting (defaults before the first load). Starts a refresh when stale; for hot paths
   * like the rate limiter.
   */
  peek(): Settings {
    if (!this.cache || Date.now() - this.cache.loadedAt >= CACHE_TTL_MS) void this.get().catch(() => {})
    return this.cache?.settings ?? toSettings(this.defaults())
  }

  private async load(): Promise<Settings> {
    const values = this.defaults()
    const rows = await this.db.select().from(system_settings)
    for (const row of rows) {
      const def = DEFINITIONS.get(row.key)
      if (!def) continue
      try {
        values.set(row.key, validateSetting(row.key, row.value, this.config, false))
      } catch {
        // keep the default
      }
    }
    const settings = toSettings(values)
    this.cache = { settings, values, loadedAt: Date.now() }
    return settings
  }

  /** Save several settings at once (validated first; nothing is written if any value is invalid) */
  async update(changes: Record<string, unknown>, userId: number | null): Promise<void> {
    const normalized = Object.entries(changes).map(([key, raw]) => [key, validateSetting(key, raw, this.config)] as const)
    await this.db.transaction(async (tx) => {
      for (const [key, value] of normalized) {
        await tx
          .insert(system_settings)
          .values({ key, value, updated_by: userId })
          .onConflictDoUpdate({ target: system_settings.key, set: { value, updated_by: userId } })
      }
    })
    this.cache = null
    await this.get()
  }

  /** Whether a switch-type feature can actually be used right now (on, and its prerequisites still configured) */
  isAvailable(key: string, settings: Settings): boolean {
    const def = DEFINITIONS.get(key)
    if (!def) return false
    const on = key === 'security.totp_enabled' ? settings.totpEnabled : key === 'security.password_reset_enabled' ? settings.passwordResetEnabled : false
    return on && !def.unavailable?.(this.config)
  }

  /** Definitions plus current values, for the settings page */
  async describe() {
    const values = await this.values()
    return SETTING_DEFINITIONS.map((d) => ({
      key: d.key,
      group: d.group,
      type: d.type,
      value: values.get(d.key),
      default: d.default(this.config),
      min: d.min ?? null,
      max: d.max ?? null,
      unavailable_reason: d.unavailable?.(this.config) ?? null,
    }))
  }

  /** Clear the cache (tests, or after writing settings from another process) */
  reset(): void {
    this.cache = null
  }

  /** Public subset (app-info): what the sign-in pages and password forms need */
  async publicInfo() {
    const s = await this.get()
    return {
      totp_enabled: this.isAvailable('security.totp_enabled', s),
      password_reset_enabled: this.isAvailable('security.password_reset_enabled', s),
      password_policy: {
        min_length: s.passwordMinLength,
        require_letters_digits: s.passwordRequireLettersDigits,
        require_symbol: s.passwordRequireSymbol,
      },
    }
  }
}

