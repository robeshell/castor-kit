/**
 * System settings: everything an admin can change at runtime — feature switches, security parameters, mail, file
 * storage, upload limits and the AI model.
 *
 * - The registry below is the only place keys are defined: type, default, bounds, environment variable, whether the
 *   browser may read it, and why it may be unavailable
 * - Effective value = environment variable (set and non-empty; the page shows it read-only) > value saved in
 *   `system_settings` (jsonb) > default
 * - Secrets (SMTP password, S3 secret key, AI API key) are stored sealed with a key derived from SECRET_KEY
 *   (common/secret-box.ts) and never returned to the browser
 * - Reads go through an in-process cache refreshed every few seconds (the rate limiter reads it on every request);
 *   a write refreshes the local cache at once, other processes pick it up within CACHE_TTL_MS
 * - Only what the process needs before it can reach the database stays environment-only (DATABASE_URL, SECRET_KEY,
 *   ports, …; see config.ts)
 */

import { eq } from 'drizzle-orm'
import { DEFAULT_UPLOAD_TYPES, isTruthy, type AppConfig } from '@/config'
import type { Executor } from '@/db/client'
import { system_settings } from '@/db/schema'
import { openSecret, sealSecret } from '@/common/secret-box'
import type { SettingEnvName } from '@/common/settings-env'

export type SettingGroup = 'general' | 'security' | 'mail' | 'storage' | 'upload' | 'ai'
type SettingType = 'boolean' | 'integer' | 'string' | 'secret' | 'enum' | 'string_list'
export type SettingValue = boolean | number | string | string[]

export interface SettingDefinition {
  key: string
  /** Name used in notifications and logs (the settings page has its own, translated labels) */
  label: string
  group: SettingGroup
  type: SettingType
  default: (config: AppConfig) => SettingValue
  min?: number
  max?: number
  /** Allowed values of an enum */
  options?: string[]
  /** Longest string accepted (default 500) */
  maxLength?: number
  /** Extra check / normalization of a string value; return null to reject it */
  normalize?: (value: string) => string | null
  /** Environment variable that pins the value */
  env?: SettingEnvName
  /** Environment text → setting value (default: by type) */
  fromEnv?: (raw: string) => unknown
  /** Readable without signing in (through /api/admin/app-info) */
  public?: boolean
  /** Why the switch can't be turned on in this deployment; null when it can */
  unavailable?: (config: AppConfig, settings: Settings) => string | null
}

/** Upper bound of security.session_ttl_hours (the session cookie's own expiry is set to this) */
export const MAX_SESSION_TTL_HOURS = 720

const MB = 1024 * 1024

const httpUrl = (value: string) => {
  const trimmed = value.trim().replace(/\/+$/, '')
  return trimmed === '' || /^https?:\/\/[^\s/]+/i.test(trimmed) ? trimmed : null
}

/** Whether mail can be sent: MAIL_DRIVER=log (development) or an SMTP host */
export function mailReady(config: AppConfig, settings: Settings): boolean {
  if (config.mailDriver === 'none') return false
  return config.mailDriver === 'log' || Boolean(settings.mail.host)
}

export const SETTING_DEFINITIONS: SettingDefinition[] = [
  // ---- general ----
  {
    key: 'general.app_base_url',
    label: '网站地址',
    group: 'general',
    type: 'string',
    default: () => '',
    maxLength: 200,
    normalize: httpUrl,
    env: 'APP_BASE_URL',
  },

  // ---- security ----
  {
    key: 'security.totp_enabled',
    label: '两步验证开关',
    group: 'security',
    type: 'boolean',
    default: () => false,
    public: true,
    // The demo account is shared: a 2FA binding on it would lock everyone else out
    unavailable: (config) => (config.demoMode ? '演示环境不能开启此功能' : null),
  },
  { key: 'security.totp_required_roles', label: '必须开启两步验证的角色', group: 'security', type: 'string_list', default: () => [] },
  {
    key: 'security.password_reset_enabled',
    label: '邮件找回密码开关',
    group: 'security',
    type: 'boolean',
    default: () => false,
    public: true,
    unavailable: (config, settings) =>
      config.demoMode
        ? '演示环境不能开启此功能'
        : !mailReady(config, settings)
          ? '需要先在「邮件」中配置 SMTP 服务器'
          : !settings.appBaseUrl
            ? '需要先在「邮件」中填写网站地址（重置链接要用）'
            : null,
  },
  {
    key: 'security.api_tokens_enabled',
    label: '允许使用 API Token',
    group: 'security',
    type: 'boolean',
    default: () => false,
    // The demo account is shared: nobody should mint long-lived credentials for it
    unavailable: (config) => (config.demoMode ? '演示环境不能开启此功能' : null),
  },
  { key: 'security.password_min_length', label: '密码最短长度', group: 'security', type: 'integer', default: () => 6, min: 6, max: 64, public: true },
  { key: 'security.password_require_letters_digits', label: '密码须含字母和数字', group: 'security', type: 'boolean', default: () => false, public: true },
  { key: 'security.password_require_symbol', label: '密码须含符号', group: 'security', type: 'boolean', default: () => false, public: true },
  {
    key: 'security.session_ttl_hours',
    label: '登录有效期',
    group: 'security',
    type: 'integer',
    // SESSION_TTL_HOURS only sets the default here; it doesn't pin the value
    default: (config) => config.sessionTtlHours,
    min: 1,
    max: MAX_SESSION_TTL_HOURS,
  },
  { key: 'security.login_max_failures', label: '登录失败锁定次数', group: 'security', type: 'integer', default: () => 10, min: 3, max: 1000, env: 'LOGIN_MAX_FAILURES' },
  { key: 'security.login_lockout_minutes', label: '锁定时长', group: 'security', type: 'integer', default: () => 15, min: 1, max: 1440, env: 'LOGIN_LOCKOUT_MINUTES' },
  { key: 'security.rate_limit_per_minute', label: '每分钟请求上限', group: 'security', type: 'integer', default: () => 600, min: 60, max: 100_000 },
  { key: 'security.auth_rate_limit_per_minute', label: '每分钟登录类请求上限', group: 'security', type: 'integer', default: () => 20, min: 3, max: 1000 },

  // ---- mail ----
  { key: 'mail.smtp_host', label: 'SMTP 服务器', group: 'mail', type: 'string', default: () => '', maxLength: 200, env: 'SMTP_HOST' },
  { key: 'mail.smtp_port', label: 'SMTP 端口', group: 'mail', type: 'integer', default: () => 587, min: 1, max: 65535, env: 'SMTP_PORT' },
  {
    key: 'mail.smtp_security',
    label: 'SMTP 加密方式',
    group: 'mail',
    type: 'enum',
    // auto: TLS from the first byte on port 465, STARTTLS (when offered) otherwise
    options: ['auto', 'tls', 'starttls'],
    default: () => 'auto',
    env: 'SMTP_SECURE',
    fromEnv: (raw) => (isTruthy(raw) ? 'tls' : 'starttls'),
  },
  { key: 'mail.smtp_user', label: 'SMTP 账号', group: 'mail', type: 'string', default: () => '', maxLength: 200, env: 'SMTP_USER' },
  { key: 'mail.smtp_password', label: 'SMTP 密码', group: 'mail', type: 'secret', default: () => '', env: 'SMTP_PASSWORD' },
  { key: 'mail.from', label: '发件人', group: 'mail', type: 'string', default: () => '', maxLength: 200, env: 'MAIL_FROM' },

  // ---- file storage ----
  {
    key: 'storage.driver',
    label: '文件存储位置',
    group: 'storage',
    type: 'enum',
    options: ['local', 's3'],
    default: () => 'local',
    env: 'STORAGE_DRIVER',
    fromEnv: (raw) => raw.trim().toLowerCase(),
  },
  { key: 'storage.s3_endpoint', label: 'S3 接口地址', group: 'storage', type: 'string', default: () => '', maxLength: 300, normalize: httpUrl, env: 'S3_ENDPOINT' },
  { key: 'storage.s3_region', label: 'S3 区域', group: 'storage', type: 'string', default: () => '', maxLength: 100, env: 'S3_REGION' },
  { key: 'storage.s3_bucket', label: 'S3 Bucket', group: 'storage', type: 'string', default: () => '', maxLength: 200, env: 'S3_BUCKET' },
  { key: 'storage.s3_access_key', label: 'S3 Access Key', group: 'storage', type: 'string', default: () => '', maxLength: 300, env: 'S3_ACCESS_KEY' },
  { key: 'storage.s3_secret_key', label: 'S3 Secret Key', group: 'storage', type: 'secret', default: () => '', env: 'S3_SECRET_KEY' },
  { key: 'storage.s3_public_url', label: 'S3 公开访问地址', group: 'storage', type: 'string', default: () => '', maxLength: 300, normalize: httpUrl, env: 'S3_PUBLIC_URL' },
  {
    key: 'storage.s3_path_style',
    label: 'S3 访问方式',
    group: 'storage',
    type: 'enum',
    // auto: path-style when an endpoint is set (MinIO and most self-hosted services), virtual-hosted otherwise
    options: ['auto', 'path', 'virtual'],
    default: () => 'auto',
    env: 'S3_FORCE_PATH_STYLE',
    fromEnv: (raw) => (isTruthy(raw) ? 'path' : 'virtual'),
  },

  // ---- uploads ----
  { key: 'upload.max_size', label: '单个文件上限', group: 'upload', type: 'integer', default: () => 10 * MB, min: 1024, max: 1024 * MB, env: 'UPLOAD_MAX_SIZE' },
  {
    key: 'upload.allowed_types',
    label: '允许的文件类型',
    group: 'upload',
    type: 'string_list',
    default: () => DEFAULT_UPLOAD_TYPES.split(','),
    env: 'UPLOAD_ALLOWED_TYPES',
  },

  // ---- AI model (OpenAI-compatible API) ----
  { key: 'ai.api_base', label: 'AI 接口地址', group: 'ai', type: 'string', default: () => '', maxLength: 300, normalize: httpUrl, env: 'AI_API_BASE' },
  { key: 'ai.api_key', label: 'AI API Key', group: 'ai', type: 'secret', default: () => '', env: 'AI_API_KEY' },
  { key: 'ai.model', label: 'AI 模型', group: 'ai', type: 'string', default: () => '', maxLength: 200, env: 'AI_MODEL' },
]

const DEFINITIONS = new Map(SETTING_DEFINITIONS.map((d) => [d.key, d]))

export interface Settings {
  appBaseUrl: string
  totpEnabled: boolean
  totpRequiredRoles: string[]
  passwordResetEnabled: boolean
  apiTokensEnabled: boolean
  passwordMinLength: number
  passwordRequireLettersDigits: boolean
  passwordRequireSymbol: boolean
  sessionTtlHours: number
  loginMaxFailures: number
  loginLockoutMinutes: number
  rateLimitPerMinute: number
  authRateLimitPerMinute: number
  mail: { host: string; port: number; secure: boolean; user: string; password: string; from: string }
  storage: {
    driver: 'local' | 's3'
    s3: {
      endpoint: string
      region: string
      bucket: string
      accessKey: string
      secretKey: string
      publicUrl: string
      forcePathStyle: boolean
    }
  }
  /** Effective upload limit: the setting capped by MAX_CONTENT_LENGTH */
  upload: { maxSize: number; allowedTypes: string[] }
  ai: { apiBase: string; apiKey: string; model: string }
}

function toSettings(values: Map<string, SettingValue>, config: AppConfig): Settings {
  const get = <T extends SettingValue>(key: string) => values.get(key) as T
  const port = get<number>('mail.smtp_port')
  const security = get<string>('mail.smtp_security')
  const user = get<string>('mail.smtp_user')
  const endpoint = get<string>('storage.s3_endpoint')
  const pathStyle = get<string>('storage.s3_path_style')
  return {
    appBaseUrl: get<string>('general.app_base_url'),
    totpEnabled: get<boolean>('security.totp_enabled'),
    totpRequiredRoles: get<string[]>('security.totp_required_roles'),
    passwordResetEnabled: get<boolean>('security.password_reset_enabled'),
    apiTokensEnabled: get<boolean>('security.api_tokens_enabled'),
    passwordMinLength: get<number>('security.password_min_length'),
    passwordRequireLettersDigits: get<boolean>('security.password_require_letters_digits'),
    passwordRequireSymbol: get<boolean>('security.password_require_symbol'),
    sessionTtlHours: get<number>('security.session_ttl_hours'),
    loginMaxFailures: get<number>('security.login_max_failures'),
    loginLockoutMinutes: get<number>('security.login_lockout_minutes'),
    rateLimitPerMinute: get<number>('security.rate_limit_per_minute'),
    authRateLimitPerMinute: get<number>('security.auth_rate_limit_per_minute'),
    mail: {
      host: get<string>('mail.smtp_host'),
      port,
      secure: security === 'auto' ? port === 465 : security === 'tls',
      user,
      password: get<string>('mail.smtp_password'),
      from: get<string>('mail.from') || user || 'castor-kit <noreply@localhost>',
    },
    storage: {
      driver: get<string>('storage.driver') === 's3' ? 's3' : 'local',
      s3: {
        endpoint,
        region: get<string>('storage.s3_region') || 'us-east-1',
        bucket: get<string>('storage.s3_bucket'),
        accessKey: get<string>('storage.s3_access_key'),
        secretKey: get<string>('storage.s3_secret_key'),
        publicUrl: get<string>('storage.s3_public_url'),
        forcePathStyle: pathStyle === 'auto' ? Boolean(endpoint) : pathStyle === 'path',
      },
    },
    upload: {
      maxSize: Math.max(1, Math.min(get<number>('upload.max_size'), config.maxContentLength)),
      allowedTypes: get<string[]>('upload.allowed_types'),
    },
    ai: { apiBase: get<string>('ai.api_base'), apiKey: get<string>('ai.api_key'), model: get<string>('ai.model') },
  }
}

export class SettingValidationError extends Error {}

/** Validate one value against its definition; returns the normalized value */
export function validateSetting(key: string, raw: unknown): SettingValue {
  const def = DEFINITIONS.get(key)
  if (!def) throw new SettingValidationError(`未知的设置项：${key}`)
  const invalid = () => new SettingValidationError(`设置项取值不合法：${key}`)
  switch (def.type) {
    case 'boolean':
      if (typeof raw !== 'boolean') throw invalid()
      return raw
    case 'integer':
      if (typeof raw !== 'number' || !Number.isSafeInteger(raw) || raw < (def.min ?? -Infinity) || raw > (def.max ?? Infinity)) {
        throw invalid()
      }
      return raw
    case 'string':
    case 'secret': {
      if (typeof raw !== 'string') throw invalid()
      const text = raw.trim()
      if (text.length > (def.maxLength ?? (def.type === 'secret' ? 1000 : 500))) throw invalid()
      const normalized = def.normalize ? def.normalize(text) : text
      if (normalized === null) throw invalid()
      return normalized
    }
    case 'enum':
      if (typeof raw !== 'string' || !def.options?.includes(raw)) throw invalid()
      return raw
    case 'string_list': {
      if (!Array.isArray(raw) || !raw.every((v) => typeof v === 'string' && v.trim() && v.length <= 100)) throw invalid()
      let list = raw.map((v) => (v as string).trim())
      if (key === 'upload.allowed_types') {
        list = list.map((v) => v.toLowerCase().replace(/^\./, ''))
        if (!list.every((v) => /^[a-z0-9]{1,10}$/.test(v))) throw invalid()
      }
      return [...new Set(list)]
    }
  }
}

/** Environment text → typed value (then validated like any other value) */
function parseEnv(def: SettingDefinition, raw: string): unknown {
  if (def.fromEnv) return def.fromEnv(raw)
  switch (def.type) {
    case 'boolean':
      return isTruthy(raw)
    case 'integer':
      return /^\s*-?\d+\s*$/.test(raw) ? Number(raw) : raw
    case 'string_list':
      return raw.split(',').map((v) => v.trim()).filter(Boolean)
    default:
      return raw
  }
}

export type SettingSource = 'env' | 'db' | 'default'

/**
 * Pending changes for update() / preview(): a value sets it, null clears it (back to the default; for a secret:
 * removes it). Keys that aren't present are left as they are.
 */
export type SettingChanges = Record<string, unknown>

export const CACHE_TTL_MS = 5000

interface Snapshot {
  settings: Settings
  values: Map<string, SettingValue>
  stored: Map<string, SettingValue>
  loadedAt: number
}

/** Settings with the environment and defaults applied, cached per process */
export class SettingsStore {
  private cache: Snapshot | null = null
  private loading: Promise<Settings> | null = null
  private readonly env = new Map<string, SettingValue>()

  constructor(
    private readonly db: Executor,
    private readonly config: AppConfig,
  ) {
    // An invalid pinning variable is a configuration error: fail at startup, like other environment variables
    for (const def of SETTING_DEFINITIONS) {
      const raw = def.env ? config.settingsEnv[def.env] : undefined
      if (raw === undefined) continue
      try {
        this.env.set(def.key, validateSetting(def.key, parseEnv(def, raw)))
      } catch {
        throw new Error(`环境变量 ${def.env} 的值不合法`)
      }
    }
  }

  private defaults(): Map<string, SettingValue> {
    return new Map(SETTING_DEFINITIONS.map((d) => [d.key, d.default(this.config)]))
  }

  /** defaults ← stored ← environment */
  private merge(stored: Map<string, SettingValue>): Map<string, SettingValue> {
    const values = this.defaults()
    for (const [key, value] of stored) values.set(key, value)
    for (const [key, value] of this.env) values.set(key, value)
    return values
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
    return this.cache?.settings ?? toSettings(this.merge(new Map()), this.config)
  }

  private async load(): Promise<Settings> {
    const rows = await this.db.select().from(system_settings)
    const stored = new Map<string, SettingValue>()
    for (const row of rows) {
      const def = DEFINITIONS.get(row.key)
      if (!def) continue
      try {
        if (def.type === 'secret') {
          // A secret sealed with another SECRET_KEY can't be read: treat it as not set
          const plain = typeof row.value === 'string' ? openSecret(row.value, this.config.secretKey) : null
          if (plain !== null) stored.set(row.key, plain)
        } else {
          stored.set(row.key, validateSetting(row.key, row.value))
        }
      } catch {
        // a stored value that no longer validates falls back to the default
      }
    }
    const values = this.merge(stored)
    const settings = toSettings(values, this.config)
    this.cache = { settings, values, stored, loadedAt: Date.now() }
    return settings
  }

  private async snapshot(): Promise<Snapshot> {
    await this.get()
    return this.cache!
  }

  /**
   * Apply changes on top of the stored values without saving (validated). Also used by the "test" buttons, so a
   * draft can be tried before it is saved. Returns the normalized changes and the resulting settings.
   */
  async preview(changes: SettingChanges) {
    const snap = await this.snapshot()
    const stored = new Map(snap.stored)
    const normalized = new Map<string, SettingValue | null>()
    for (const [key, raw] of Object.entries(changes)) {
      const def = DEFINITIONS.get(key)
      if (!def) throw new SettingValidationError(`未知的设置项：${key}`)
      if (this.env.has(key)) throw new SettingValidationError(`该设置由环境变量 ${def.env} 指定，不能在页面上修改`)
      if (raw === null || (def.type === 'secret' && raw === '')) {
        normalized.set(key, null)
        stored.delete(key)
      } else {
        const value = validateSetting(key, raw)
        normalized.set(key, value)
        stored.set(key, value)
      }
    }
    const values = this.merge(stored)
    const settings = toSettings(values, this.config)
    if (settings.storage.driver === 's3') {
      const { bucket, accessKey, secretKey } = settings.storage.s3
      if (!bucket || !accessKey || !secretKey) throw new SettingValidationError('S3 存储需要填写 Bucket、Access Key 和 Secret Key')
    }
    return { normalized, settings, values }
  }

  /** Save several settings at once (validated first; nothing is written if any value is invalid) */
  async update(changes: SettingChanges, userId: number | null): Promise<void> {
    const { normalized, settings } = await this.preview(changes)
    // Turning a switch on needs its prerequisites — judged with the other changes of the same save applied
    for (const [key, value] of normalized) {
      const reason = value === true ? DEFINITIONS.get(key)!.unavailable?.(this.config, settings) : null
      if (reason) throw new SettingValidationError(reason)
    }
    await this.db.transaction(async (tx) => {
      for (const [key, value] of normalized) {
        if (value === null) {
          await tx.delete(system_settings).where(eq(system_settings.key, key))
          continue
        }
        const stored = DEFINITIONS.get(key)!.type === 'secret' ? sealSecret(value as string, this.config.secretKey) : value
        await tx
          .insert(system_settings)
          .values({ key, value: stored, updated_by: userId })
          .onConflictDoUpdate({ target: system_settings.key, set: { value: stored, updated_by: userId } })
      }
    })
    this.cache = null
    await this.get()
  }

  /** Whether an environment variable pins this setting (the operator's choice: not editable, not SSRF-checked) */
  isPinned(key: string): boolean {
    return this.env.has(key)
  }

  /** Whether a switch-type feature can actually be used right now (on, and its prerequisites still met) */
  isAvailable(
    key: 'security.totp_enabled' | 'security.password_reset_enabled' | 'security.api_tokens_enabled',
    settings: Settings,
  ): boolean {
    const on =
      key === 'security.totp_enabled'
        ? settings.totpEnabled
        : key === 'security.password_reset_enabled'
          ? settings.passwordResetEnabled
          : settings.apiTokensEnabled
    return on && !DEFINITIONS.get(key)!.unavailable?.(this.config, settings)
  }

  /** Definitions, current values and where they come from, for the settings page (secrets: only whether set) */
  async describe() {
    const snap = await this.snapshot()
    return SETTING_DEFINITIONS.map((d) => {
      const source: SettingSource = this.env.has(d.key) ? 'env' : snap.stored.has(d.key) ? 'db' : 'default'
      const value = snap.values.get(d.key)
      const secret = d.type === 'secret'
      return {
        key: d.key,
        group: d.group,
        type: d.type,
        value: secret ? null : value,
        has_value: secret ? Boolean(value) : undefined,
        default: secret ? null : d.default(this.config),
        min: d.min ?? null,
        max: d.max ?? null,
        options: d.options ?? null,
        source,
        env: d.env ?? null,
        unavailable_reason: d.unavailable?.(this.config, snap.settings) ?? null,
      }
    })
  }

  /** Clear the cache (tests, or after writing settings from another process) */
  reset(): void {
    this.cache = null
  }

  /** Public subset (app-info): what the sign-in pages, password forms and upload controls need */
  async publicInfo() {
    const s = await this.get()
    return {
      security: {
        totp_enabled: this.isAvailable('security.totp_enabled', s),
        password_reset_enabled: this.isAvailable('security.password_reset_enabled', s),
        password_policy: {
          min_length: s.passwordMinLength,
          require_letters_digits: s.passwordRequireLettersDigits,
          require_symbol: s.passwordRequireSymbol,
        },
      },
      upload: { max_size: s.upload.maxSize, allowed_types: s.upload.allowedTypes },
    }
  }
}
