/**
 * Multi-environment configuration
 *
 * - the runtime environment is determined by `NODE_ENV` (development / test / production)
 * - loads `.env.<NODE_ENV>` at startup (apps/api first, then the repo root; existing env vars are not overridden)
 * - fail-closed: production throws and exits if SECRET_KEY / ADMIN_PASSWORD is missing
 */

import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { config as loadDotenv } from 'dotenv'
import { z } from 'zod'
import { collectSettingsEnv, type SettingEnvName } from './common/settings-env'

export type AppEnv = 'development' | 'production' | 'test'

const API_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const REPO_ROOT = resolve(API_ROOT, '../..')

export const DEFAULT_UPLOAD_TYPES = 'jpg,jpeg,png,gif,webp,pdf,txt,csv,doc,docx,xls,xlsx,ppt,pptx,zip'

export interface AppConfig {
  env: AppEnv
  isProduction: boolean
  port: number
  databaseUrl: string
  secretKey: string
  adminUsername: string
  adminPassword: string
  /** Request body limit (bytes), MAX_CONTENT_LENGTH */
  maxContentLength: number
  sessionTtlHours: number
  /** SESSION_COOKIE_SECURE: true/false forces it; empty = auto (by request protocol, Secure only over TLS) */
  sessionCookieSecure: boolean | 'auto'
  corsOrigins: string[]
  /** RATE_LIMIT_ENABLED (default true): per-IP request limits; the limits themselves are in system settings */
  rateLimitEnabled: boolean
  /** Frontend build output dir (apps/web/dist); if missing, the SPA fallback returns a JSON hint */
  webDistDir: string
  /** Runtime data dir (instance/; uploads live in instance/uploads/...) */
  instanceDir: string

  // ---- System settings pinned by environment variables ----
  /**
   * Raw values of the variables in SETTING_ENV_NAMES that are set and non-empty (mail, file storage, uploads, AI,
   * site URL, login lockout). SettingsStore validates them and lets them override the settings page.
   */
  settingsEnv: Partial<Record<SettingEnvName, string>>
  /** STORAGE_LOCAL_DIR: directory of the `local` file storage driver, default <instanceDir>/uploads/files */
  storageLocalDir: string
  /**
   * MAIL_DRIVER: '' = SMTP when configured in system settings; 'log' = print mails to the server log instead of
   * sending (development); 'none' = never send
   */
  mailDriver: '' | 'log' | 'none'
  /**
   * SETTINGS_ALLOW_PRIVATE_NETWORK: whether SMTP / S3 / AI addresses typed on the settings page may point into
   * internal networks (loopback, 10/8, 192.168/16 …). Default: on in development / test, off in production.
   * Cloud metadata / link-local addresses are always refused (common/outbound.ts)
   */
  settingsAllowPrivateNetwork: boolean
  /**
   * Visual modeler routes (/api/admin/modeler): development only — they write code into the repository and run
   * migrations. Not an environment variable on purpose.
   */
  modelerEnabled: boolean

  // ---- Public demo ----
  /** DEMO_MODE: system management becomes read-only, the demo account is shown on the login page, sample data resets periodically */
  demoMode: boolean
  /** DEMO_RESET_HOURS: how often the demo data is restored (checked at startup and hourly) */
  demoResetHours: number
  /** Demo AI quota (only in DEMO_MODE): calls per IP per hour, calls per day for the whole site, max request size */
  demoAiHourlyPerIp: number
  demoAiDaily: number
  demoAiMaxInputChars: number

  // ---- Scheduled tasks ----
  enableTaskScheduler: boolean
  taskSchedulerIntervalSeconds: number
  taskSchedulerLeaseSeconds: number
  /** When true, run the scheduler loop inside the web process; otherwise use the standalone `node dist/worker.js` process */
  runSchedulerInWeb: boolean

  // ---- AI SQL ----
  /**
   * Read-only connection string for AI SQL. Production: AI_SQL_DATABASE_URL, or derived from DATABASE_URL with the
   * castor_kit_ro role when POSTGRES_RO_PASSWORD is set; otherwise startup fails (fail-closed).
   * Development falls back to the main DB URL (connection params still force read-only).
   */
  aiSqlDatabaseUrl: string
  aiSqlStatementTimeoutMs: number
  /** Used by init-ro-role: read-only role password; skipped if not set */
  postgresRoPassword: string

  // ---- Apifox ----
  apifoxProjectId: string
  apifoxAccessToken: string
  apifoxApiVersion: string
}

const intFromEnv = (fallback: number) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined || v.trim() === '' ? fallback : Number(v)))
    .pipe(z.number().int())

const envSchema = z.object({
  PORT: z.string().optional(),
  DATABASE_URL: z.string().optional(),
  DEV_DATABASE_URL: z.string().optional(),
  TEST_DATABASE_URL: z.string().optional(),
  SECRET_KEY: z.string().optional(),
  ADMIN_PASSWORD: z.string().optional(),
  MAX_CONTENT_LENGTH: intFromEnv(16 * 1024 * 1024),
  SESSION_TTL_HOURS: intFromEnv(8),
  SESSION_COOKIE_SECURE: z.string().optional().default(''),
  CORS_ORIGINS: z.string().optional().default(''),
  RATE_LIMIT_ENABLED: z.string().optional().default('true'),
  WEB_DIST_DIR: z.string().optional(),
  INSTANCE_DIR: z.string().optional(),
  DEMO_MODE: z.string().optional().default('false'),
  DEMO_RESET_HOURS: intFromEnv(24),
  DEMO_AI_HOURLY_PER_IP: intFromEnv(20),
  DEMO_AI_DAILY: intFromEnv(300),
  DEMO_AI_MAX_INPUT_CHARS: intFromEnv(4000),
  ENABLE_TASK_SCHEDULER: z.string().optional().default('true'),
  TASK_SCHEDULER_INTERVAL_SECONDS: intFromEnv(20),
  TASK_SCHEDULER_LEASE_SECONDS: intFromEnv(1800),
  RUN_SCHEDULER_IN_WEB: z.string().optional().default('false'),
  AI_SQL_DATABASE_URL: z.string().optional(),
  AI_SQL_STATEMENT_TIMEOUT_MS: intFromEnv(5000),
  POSTGRES_RO_PASSWORD: z.string().optional().default(''),
  APIFOX_PROJECT_ID: z.string().optional().default(''),
  APIFOX_ACCESS_TOKEN: z.string().optional().default(''),
  APIFOX_API_VERSION: z.string().optional().default('2024-03-28'),
  STORAGE_LOCAL_DIR: z.string().optional(),
  MAIL_DRIVER: z.string().optional().default(''),
  SETTINGS_ALLOW_PRIVATE_NETWORK: z.string().optional().default(''),
})

/** Boolean env var parsing: '1' / 'true' / 'yes' / 'on' are true (case-insensitive, whitespace-trimmed) */
export function isTruthy(value: unknown): boolean {
  return ['1', 'true', 'yes', 'on'].includes(String(value ?? '').trim().toLowerCase())
}

function resolveEnv(raw: string | undefined): AppEnv {
  if (raw === 'production' || raw === 'test') return raw
  return 'development'
}

export function loadEnvFiles(env: AppEnv): void {
  for (const dir of [API_ROOT, REPO_ROOT]) {
    const file = resolve(dir, `.env.${env}`)
    if (existsSync(file)) loadDotenv({ path: file, quiet: true })
  }
}

function required(name: string, value: string | undefined, env: AppEnv, devFallback: string): string {
  const trimmed = (value ?? '').trim()
  if (trimmed) return trimmed
  if (env === 'production') {
    throw new Error(`生产环境必须设置 ${name}，请使用 setup.sh 生成 .env.production`)
  }
  return devFallback
}

/** Read-only role created by scripts/init-ro-role.ts */
export const RO_ROLE_NAME = 'castor_kit_ro'

/** Same host / database / query string as the main URL, but signed in as the read-only role */
export function deriveReadonlyUrl(mainUrl: string, roPassword: string): string {
  const url = new URL(mainUrl)
  url.username = RO_ROLE_NAME
  url.password = roPassword
  return url.toString()
}

function resolveAiSqlUrl(raw: string | undefined, env: AppEnv, mainUrl: string, roPassword: string): string {
  const value = (raw ?? '').trim()
  if (value) return value
  if (env === 'production' && roPassword) return deriveReadonlyUrl(mainUrl, roPassword)
  if (env === 'production') {
    throw new Error('生产环境必须设置 AI_SQL_DATABASE_URL（指向非超级用户只读账号 castor_kit_ro），拒绝回退到主库连接')
  }
  return mainUrl
}

/** MAIL_DRIVER: only the development / kill-switch values; SMTP itself is configured in system settings */
function resolveMailDriver(raw: string): AppConfig['mailDriver'] {
  const value = raw.trim().toLowerCase()
  if (value === '' || value === 'smtp') return ''
  if (value === 'log' || value === 'none') return value
  throw new Error(`MAIL_DRIVER 只能是 log 或 none（当前：${value}）`)
}

export function loadConfig(source: NodeJS.ProcessEnv = process.env): AppConfig {
  const env = resolveEnv(source.NODE_ENV)
  const parsed = envSchema.parse(source)

  const databaseUrl =
    env === 'production'
      ? parsed.DATABASE_URL || 'postgresql://localhost/castor_kit'
      : env === 'test'
        ? parsed.TEST_DATABASE_URL || 'postgresql://localhost/castor_kit_test'
        : parsed.DEV_DATABASE_URL || 'postgresql://localhost/castor_kit_dev'

  const defaultPort = env === 'production' ? 5000 : env === 'test' ? 5002 : 5001
  const instanceDir = parsed.INSTANCE_DIR ? resolve(parsed.INSTANCE_DIR) : resolve(API_ROOT, 'instance')

  return {
    env,
    isProduction: env === 'production',
    port: parsed.PORT ? Number(parsed.PORT) : defaultPort,
    databaseUrl,
    secretKey: required('SECRET_KEY', parsed.SECRET_KEY, env, 'dev-insecure-secret-key'),
    adminUsername: 'admin',
    adminPassword: required('ADMIN_PASSWORD', parsed.ADMIN_PASSWORD, env, 'admin123'),
    maxContentLength: parsed.MAX_CONTENT_LENGTH,
    sessionTtlHours: parsed.SESSION_TTL_HOURS,
    sessionCookieSecure: parsed.SESSION_COOKIE_SECURE.trim() === '' ? 'auto' : isTruthy(parsed.SESSION_COOKIE_SECURE),
    corsOrigins: parsed.CORS_ORIGINS.split(',')
      .map((o) => o.trim())
      .filter(Boolean),
    rateLimitEnabled: isTruthy(parsed.RATE_LIMIT_ENABLED),
    webDistDir: parsed.WEB_DIST_DIR ? resolve(parsed.WEB_DIST_DIR) : resolve(REPO_ROOT, 'apps/web/dist'),
    instanceDir,
    settingsEnv: collectSettingsEnv(source),
    storageLocalDir: parsed.STORAGE_LOCAL_DIR ? resolve(parsed.STORAGE_LOCAL_DIR) : resolve(instanceDir, 'uploads', 'files'),
    mailDriver: resolveMailDriver(parsed.MAIL_DRIVER),
    settingsAllowPrivateNetwork:
      parsed.SETTINGS_ALLOW_PRIVATE_NETWORK.trim() === '' ? env !== 'production' : isTruthy(parsed.SETTINGS_ALLOW_PRIVATE_NETWORK),
    demoMode: isTruthy(parsed.DEMO_MODE),
    demoResetHours: Math.max(1, parsed.DEMO_RESET_HOURS),
    demoAiHourlyPerIp: Math.max(0, parsed.DEMO_AI_HOURLY_PER_IP),
    demoAiDaily: Math.max(0, parsed.DEMO_AI_DAILY),
    demoAiMaxInputChars: Math.max(1, parsed.DEMO_AI_MAX_INPUT_CHARS),
    enableTaskScheduler: isTruthy(parsed.ENABLE_TASK_SCHEDULER),
    taskSchedulerIntervalSeconds: parsed.TASK_SCHEDULER_INTERVAL_SECONDS,
    taskSchedulerLeaseSeconds: parsed.TASK_SCHEDULER_LEASE_SECONDS,
    runSchedulerInWeb: isTruthy(parsed.RUN_SCHEDULER_IN_WEB),
    aiSqlDatabaseUrl: resolveAiSqlUrl(parsed.AI_SQL_DATABASE_URL, env, databaseUrl, parsed.POSTGRES_RO_PASSWORD.trim()),
    aiSqlStatementTimeoutMs: parsed.AI_SQL_STATEMENT_TIMEOUT_MS,
    postgresRoPassword: parsed.POSTGRES_RO_PASSWORD.trim(),
    apifoxProjectId: parsed.APIFOX_PROJECT_ID,
    apifoxAccessToken: parsed.APIFOX_ACCESS_TOKEN,
    apifoxApiVersion: parsed.APIFOX_API_VERSION,
    modelerEnabled: env === 'development',
  }
}
