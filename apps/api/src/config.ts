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

export type AppEnv = 'development' | 'production' | 'test'

const API_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const REPO_ROOT = resolve(API_ROOT, '../..')

export interface StorageConfig {
  /** STORAGE_DRIVER: 'local' (default, a directory on a persistent disk) or 's3' (any S3-compatible service) */
  driver: 'local' | 's3'
  /** STORAGE_LOCAL_DIR, default <instanceDir>/uploads/files */
  localDir: string
  s3: {
    endpoint: string
    region: string
    bucket: string
    accessKey: string
    secretKey: string
    /** S3_PUBLIC_URL: public base URL of the bucket; when set, downloads redirect there instead of to a signed URL */
    publicUrl: string
    /** Path-style addressing (MinIO and most self-hosted services); defaults to true when S3_ENDPOINT is set */
    forcePathStyle: boolean
  }
  /** UPLOAD_MAX_SIZE (bytes), capped by MAX_CONTENT_LENGTH */
  uploadMaxSize: number
  /** UPLOAD_ALLOWED_TYPES: allowed file extensions, lowercase without the dot */
  uploadAllowedTypes: string[]
}

export interface MailConfig {
  /** 'smtp' when SMTP_HOST is set, 'log' (MAIL_DRIVER=log: print mails to the server log, for development), else 'none' */
  driver: 'smtp' | 'log' | 'none'
  host: string
  port: number
  /** SMTP_SECURE: TLS from the first byte (port 465); otherwise STARTTLS when the server offers it */
  secure: boolean
  user: string
  password: string
  /** MAIL_FROM, e.g. "castor-kit <noreply@example.com>" */
  from: string
}

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
  loginMaxFailures: number
  loginLockoutMinutes: number
  /** RATE_LIMIT_ENABLED (default true): per-IP request limits; the limits themselves are in 系统设置 */
  rateLimitEnabled: boolean
  /** Frontend build output dir (apps/web/dist); if missing, the SPA fallback returns a JSON hint */
  webDistDir: string
  /** Runtime data dir (instance/; uploads live in instance/uploads/...) */
  instanceDir: string

  // ---- File center ----
  storage: StorageConfig

  // ---- Mail / links in mails ----
  mail: MailConfig
  /** APP_BASE_URL: public URL of the app (links in mails are built from it, never from the request's Host) */
  appBaseUrl: string

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

  // ---- AI (OpenAI-compatible API) ----
  aiApiBase: string
  aiApiKey: string
  aiModel: string
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
  LOGIN_MAX_FAILURES: intFromEnv(10),
  LOGIN_LOCKOUT_MINUTES: intFromEnv(15),
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
  AI_API_BASE: z.string().optional().default(''),
  AI_API_KEY: z.string().optional().default(''),
  AI_MODEL: z.string().optional().default(''),
  AI_SQL_DATABASE_URL: z.string().optional(),
  AI_SQL_STATEMENT_TIMEOUT_MS: intFromEnv(5000),
  POSTGRES_RO_PASSWORD: z.string().optional().default(''),
  APIFOX_PROJECT_ID: z.string().optional().default(''),
  APIFOX_ACCESS_TOKEN: z.string().optional().default(''),
  APIFOX_API_VERSION: z.string().optional().default('2024-03-28'),
  STORAGE_DRIVER: z.string().optional().default('local'),
  STORAGE_LOCAL_DIR: z.string().optional(),
  S3_ENDPOINT: z.string().optional().default(''),
  S3_REGION: z.string().optional().default(''),
  S3_BUCKET: z.string().optional().default(''),
  S3_ACCESS_KEY: z.string().optional().default(''),
  S3_SECRET_KEY: z.string().optional().default(''),
  S3_PUBLIC_URL: z.string().optional().default(''),
  S3_FORCE_PATH_STYLE: z.string().optional().default(''),
  UPLOAD_MAX_SIZE: intFromEnv(10 * 1024 * 1024),
  UPLOAD_ALLOWED_TYPES: z.string().optional().default(DEFAULT_UPLOAD_TYPES),
  MAIL_DRIVER: z.string().optional().default(''),
  SMTP_HOST: z.string().optional().default(''),
  SMTP_PORT: intFromEnv(587),
  SMTP_SECURE: z.string().optional().default(''),
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASSWORD: z.string().optional().default(''),
  MAIL_FROM: z.string().optional().default(''),
  APP_BASE_URL: z.string().optional().default(''),
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

/** Storage settings; an unknown driver, or s3 without bucket / keys, is a configuration error in every environment */
function resolveStorage(parsed: z.infer<typeof envSchema>, instanceDir: string, maxContentLength: number): StorageConfig {
  const driver = parsed.STORAGE_DRIVER.trim().toLowerCase() || 'local'
  if (driver !== 'local' && driver !== 's3') throw new Error(`STORAGE_DRIVER 只能是 local 或 s3（当前：${driver}）`)
  const endpoint = parsed.S3_ENDPOINT.trim()
  const s3 = {
    endpoint,
    region: parsed.S3_REGION.trim() || 'us-east-1',
    bucket: parsed.S3_BUCKET.trim(),
    accessKey: parsed.S3_ACCESS_KEY.trim(),
    secretKey: parsed.S3_SECRET_KEY.trim(),
    publicUrl: parsed.S3_PUBLIC_URL.trim().replace(/\/+$/, ''),
    forcePathStyle: parsed.S3_FORCE_PATH_STYLE.trim() === '' ? Boolean(endpoint) : isTruthy(parsed.S3_FORCE_PATH_STYLE),
  }
  if (driver === 's3') {
    const missing = (['S3_BUCKET', 'S3_ACCESS_KEY', 'S3_SECRET_KEY'] as const).filter((k) => !parsed[k].trim())
    if (missing.length > 0) throw new Error(`STORAGE_DRIVER=s3 需要设置 ${missing.join(' / ')}`)
  }
  return {
    driver,
    localDir: parsed.STORAGE_LOCAL_DIR ? resolve(parsed.STORAGE_LOCAL_DIR) : resolve(instanceDir, 'uploads', 'files'),
    s3,
    uploadMaxSize: Math.max(1, Math.min(parsed.UPLOAD_MAX_SIZE, maxContentLength)),
    uploadAllowedTypes: parsed.UPLOAD_ALLOWED_TYPES.split(',')
      .map((t) => t.trim().toLowerCase().replace(/^\./, ''))
      .filter(Boolean),
  }
}

function resolveMail(parsed: z.infer<typeof envSchema>): MailConfig {
  const host = parsed.SMTP_HOST.trim()
  const explicit = parsed.MAIL_DRIVER.trim().toLowerCase()
  if (explicit && !['smtp', 'log', 'none'].includes(explicit)) throw new Error(`MAIL_DRIVER 只能是 smtp、log 或 none（当前：${explicit}）`)
  const driver = (explicit || (host ? 'smtp' : 'none')) as MailConfig['driver']
  if (driver === 'smtp' && !host) throw new Error('MAIL_DRIVER=smtp 需要设置 SMTP_HOST')
  return {
    driver,
    host,
    port: parsed.SMTP_PORT,
    secure: parsed.SMTP_SECURE.trim() === '' ? parsed.SMTP_PORT === 465 : isTruthy(parsed.SMTP_SECURE),
    user: parsed.SMTP_USER.trim(),
    password: parsed.SMTP_PASSWORD,
    from: parsed.MAIL_FROM.trim() || (parsed.SMTP_USER.trim() ? parsed.SMTP_USER.trim() : 'castor-kit <noreply@localhost>'),
  }
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
    loginMaxFailures: parsed.LOGIN_MAX_FAILURES,
    rateLimitEnabled: isTruthy(parsed.RATE_LIMIT_ENABLED),
    loginLockoutMinutes: parsed.LOGIN_LOCKOUT_MINUTES,
    webDistDir: parsed.WEB_DIST_DIR ? resolve(parsed.WEB_DIST_DIR) : resolve(REPO_ROOT, 'apps/web/dist'),
    instanceDir,
    storage: resolveStorage(parsed, instanceDir, parsed.MAX_CONTENT_LENGTH),
    mail: resolveMail(parsed),
    appBaseUrl: parsed.APP_BASE_URL.trim().replace(/\/+$/, ''),
    demoMode: isTruthy(parsed.DEMO_MODE),
    demoResetHours: Math.max(1, parsed.DEMO_RESET_HOURS),
    demoAiHourlyPerIp: Math.max(0, parsed.DEMO_AI_HOURLY_PER_IP),
    demoAiDaily: Math.max(0, parsed.DEMO_AI_DAILY),
    demoAiMaxInputChars: Math.max(1, parsed.DEMO_AI_MAX_INPUT_CHARS),
    enableTaskScheduler: isTruthy(parsed.ENABLE_TASK_SCHEDULER),
    taskSchedulerIntervalSeconds: parsed.TASK_SCHEDULER_INTERVAL_SECONDS,
    taskSchedulerLeaseSeconds: parsed.TASK_SCHEDULER_LEASE_SECONDS,
    runSchedulerInWeb: isTruthy(parsed.RUN_SCHEDULER_IN_WEB),
    aiApiBase: parsed.AI_API_BASE,
    aiApiKey: parsed.AI_API_KEY,
    aiModel: parsed.AI_MODEL,
    aiSqlDatabaseUrl: resolveAiSqlUrl(parsed.AI_SQL_DATABASE_URL, env, databaseUrl, parsed.POSTGRES_RO_PASSWORD.trim()),
    aiSqlStatementTimeoutMs: parsed.AI_SQL_STATEMENT_TIMEOUT_MS,
    postgresRoPassword: parsed.POSTGRES_RO_PASSWORD.trim(),
    apifoxProjectId: parsed.APIFOX_PROJECT_ID,
    apifoxAccessToken: parsed.APIFOX_ACCESS_TOKEN,
    apifoxApiVersion: parsed.APIFOX_API_VERSION,
  }
}
