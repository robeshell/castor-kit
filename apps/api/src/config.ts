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
  /** Frontend build output dir (apps/web/dist); if missing, the SPA fallback returns a JSON hint */
  webDistDir: string
  /** Runtime data dir (instance/; uploads live in instance/uploads/...) */
  instanceDir: string

  // ---- Public demo ----
  /** DEMO_MODE: system management becomes read-only, the demo account is shown on the login page, sample data resets periodically */
  demoMode: boolean
  /** DEMO_RESET_HOURS: how often the demo data is restored (checked at startup and hourly) */
  demoResetHours: number

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
  WEB_DIST_DIR: z.string().optional(),
  INSTANCE_DIR: z.string().optional(),
  DEMO_MODE: z.string().optional().default('false'),
  DEMO_RESET_HOURS: intFromEnv(24),
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
    loginLockoutMinutes: parsed.LOGIN_LOCKOUT_MINUTES,
    webDistDir: parsed.WEB_DIST_DIR ? resolve(parsed.WEB_DIST_DIR) : resolve(REPO_ROOT, 'apps/web/dist'),
    instanceDir: parsed.INSTANCE_DIR ? resolve(parsed.INSTANCE_DIR) : resolve(API_ROOT, 'instance'),
    demoMode: isTruthy(parsed.DEMO_MODE),
    demoResetHours: Math.max(1, parsed.DEMO_RESET_HOURS),
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
