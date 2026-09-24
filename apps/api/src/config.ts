/**
 * 多环境配置（对齐 AuraStack config.py）
 *
 * - 变量名沿用原名，仅 `FLASK_ENV` → `NODE_ENV`
 * - 启动时加载 `.env.<NODE_ENV>`（apps/api 目录优先，其次仓库根目录；已有环境变量不覆盖）
 * - fail-closed：production 缺 SECRET_KEY / ADMIN_PASSWORD 直接抛错退出
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
  /** 请求体上限（字节），对齐 Flask MAX_CONTENT_LENGTH */
  maxContentLength: number
  sessionTtlHours: number
  /** SESSION_COOKIE_SECURE：true/false 强制；留空 = auto（按请求协议，TLS 才打 Secure） */
  sessionCookieSecure: boolean | 'auto'
  corsOrigins: string[]
  loginMaxFailures: number
  loginLockoutMinutes: number
  /** 前端构建产物目录（apps/web/dist），不存在时 SPA fallback 返回 JSON 提示 */
  webDistDir: string
  /** 运行时数据目录（对应 Flask instance/，上传文件在 instance/uploads/...） */
  instanceDir: string

  // ---- 定时任务 ----
  enableTaskScheduler: boolean
  taskSchedulerIntervalSeconds: number
  taskSchedulerLeaseSeconds: number
  /** true 时 web 进程内启动调度循环；否则用 `node dist/worker.js` 独立进程 */
  runSchedulerInWeb: boolean

  // ---- AI（OpenAI 兼容接口） ----
  aiApiBase: string
  aiApiKey: string
  aiModel: string
  /** AI SQL 只读连接串；生产必填（fail-closed），开发回退主库 URL（连接参数仍强制只读） */
  aiSqlDatabaseUrl: string
  aiSqlStatementTimeoutMs: number
  /** init-ro-role 用：只读角色密码，未配置则跳过 */
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

/** Python `_is_truthy`：'1' / 'true' / 'yes' / 'on'（忽略大小写与首尾空白） */
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

function resolveAiSqlUrl(raw: string | undefined, env: AppEnv, mainUrl: string): string {
  const value = (raw ?? '').trim()
  if (value) return value
  if (env === 'production') {
    throw new Error('生产环境必须设置 AI_SQL_DATABASE_URL（指向非超级用户只读账号 aurastack_ro），拒绝回退到主库连接')
  }
  return mainUrl
}

export function loadConfig(source: NodeJS.ProcessEnv = process.env): AppConfig {
  const env = resolveEnv(source.NODE_ENV)
  const parsed = envSchema.parse(source)

  const databaseUrl =
    env === 'production'
      ? parsed.DATABASE_URL || 'postgresql://localhost/aurastack'
      : env === 'test'
        ? parsed.TEST_DATABASE_URL || 'postgresql://localhost/aurastack_test'
        : parsed.DEV_DATABASE_URL || 'postgresql://localhost/aurastack_dev'

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
    enableTaskScheduler: isTruthy(parsed.ENABLE_TASK_SCHEDULER),
    taskSchedulerIntervalSeconds: parsed.TASK_SCHEDULER_INTERVAL_SECONDS,
    taskSchedulerLeaseSeconds: parsed.TASK_SCHEDULER_LEASE_SECONDS,
    runSchedulerInWeb: isTruthy(parsed.RUN_SCHEDULER_IN_WEB),
    aiApiBase: parsed.AI_API_BASE,
    aiApiKey: parsed.AI_API_KEY,
    aiModel: parsed.AI_MODEL,
    aiSqlDatabaseUrl: resolveAiSqlUrl(parsed.AI_SQL_DATABASE_URL, env, databaseUrl),
    aiSqlStatementTimeoutMs: parsed.AI_SQL_STATEMENT_TIMEOUT_MS,
    postgresRoPassword: parsed.POSTGRES_RO_PASSWORD.trim(),
    apifoxProjectId: parsed.APIFOX_PROJECT_ID,
    apifoxAccessToken: parsed.APIFOX_ACCESS_TOKEN,
    apifoxApiVersion: parsed.APIFOX_API_VERSION,
  }
}
