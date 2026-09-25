/**
 * AI SQL read-only role initialization
 *
 * Run after migrations create the tables: creates the non-superuser read-only role castor_kit_ro and grants it only SELECT on business tables
 * (excluding sensitive tables such as admin_users / logs / scheduled tasks, reusing the AI SQL module's isVisibleTable),
 * and enforces role-level read-only + timeouts.
 *
 * Usage: `pnpm init-ro-role` (setup-once calls it after migrations and RBAC).
 * Skipped when POSTGRES_RO_PASSWORD is not configured (does not block startup). Fully idempotent; business tables added by new migrations are granted automatically.
 */

import pg from 'pg'
import { loadConfig, loadEnvFiles, type AppEnv } from '../src/config'
import { isVisibleTable } from '../src/modules/component-center/ai-sql/schema'

export const RO_ROLE = 'castor_kit_ro'
const SAFE_TABLE_NAME = /^[a-z0-9_]+$/
const SAFE_ROLE_NAME = /^[a-z_][a-z0-9_]*$/

// The grant scope follows the same rules as AI SQL's schema visibility (isVisibleTable in ai-sql/schema.ts)
export { isVisibleTable }

export interface InitRoRoleOptions {
  databaseUrl: string
  /** POSTGRES_RO_PASSWORD (leading/trailing whitespace trimmed); skip when empty */
  roPassword: string
  /** Read-only role name, defaults to castor_kit_ro (tests use a separate role name to avoid changing the password of a role shared across the cluster) */
  roleName?: string
  log?: (msg: string) => void
}

export interface InitRoRoleResult {
  skipped: boolean
  granted: number
}

/** Get the database name from the connection string (URL path, decoded) */
function databaseNameFromUrl(databaseUrl: string): string {
  try {
    return decodeURIComponent(new URL(databaseUrl).pathname.replace(/^\//, ''))
  } catch {
    return ''
  }
}

export async function initRoRole(options: InitRoRoleOptions): Promise<InitRoRoleResult> {
  const log = options.log ?? console.log
  const role = options.roleName ?? RO_ROLE
  if (!SAFE_ROLE_NAME.test(role)) throw new Error(`非法角色名: ${role}`)

  const roPassword = options.roPassword.trim()
  if (!roPassword) {
    log('未配置 POSTGRES_RO_PASSWORD，跳过 AI SQL 只读角色初始化')
    return { skipped: true, granted: 0 }
  }

  log(`初始化 AI SQL 只读角色: ${role} ...`)

  const client = new pg.Client({ connectionString: options.databaseUrl })
  await client.connect()
  try {
    await client.query('BEGIN')
    // 1. Idempotently create the role (LOGIN, non-superuser, no CREATEDB/CREATEROLE)
    await client.query(`
      DO $$
      BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${role}') THEN
              CREATE ROLE ${role} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE;
          END IF;
      END $$;
    `)
    // 2. Set the password: ALTER ROLE is a utility statement that doesn't support bind parameters, so escape with escapeLiteral
    await client.query(`ALTER ROLE ${role} PASSWORD ${client.escapeLiteral(roPassword)}`)
    // 3. Enforce read-only + timeouts at the role level (applies even if app-level connection parameters are bypassed)
    await client.query(`ALTER ROLE ${role} SET default_transaction_read_only = on`)
    await client.query(`ALTER ROLE ${role} SET statement_timeout = 5000`)
    // 4. Allow access to the public schema
    await client.query(`GRANT USAGE ON SCHEMA public TO ${role}`)

    // 5. Grant SELECT on business tables only (sensitive tables get no grant, not even SELECT)
    const { rows } = await client.query<{ table_name: string }>(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'",
    )
    let granted = 0
    for (const { table_name: tname } of rows) {
      if (!isVisibleTable(tname)) continue
      // Table names come from information_schema and pass the allowlist check, so interpolation is safe
      if (!SAFE_TABLE_NAME.test(tname)) {
        log(`  跳过非预期表名: ${tname}`)
        continue
      }
      await client.query(`GRANT SELECT ON TABLE "${tname}" TO ${role}`)
      granted += 1
    }

    // 6. Forbid PUBLIC from using temporary tables (hardening)
    const databaseName = databaseNameFromUrl(options.databaseUrl)
    if (databaseName) {
      await client.query(`REVOKE TEMPORARY ON DATABASE ${client.escapeIdentifier(databaseName)} FROM PUBLIC`)
    }

    await client.query('COMMIT')
    log(`完成：为 ${granted} 张业务表授予只读权限`)
    return { skipped: false, granted }
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    log(`初始化 AI SQL 只读角色失败: ${err instanceof Error ? err.message : String(err)}`)
    throw err
  } finally {
    await client.end()
  }
}

// Detect direct execution by script file name: this file is bundled into the same output by setup-once, so import.meta.url is unreliable
const isMain = /[\\/]init-ro-role\.(?:ts|js|mjs)$/.test(process.argv[1] ?? '')
if (isMain) {
  const env = (process.env.NODE_ENV ?? 'development') as AppEnv
  loadEnvFiles(env)
  const config = loadConfig()
  initRoRole({ databaseUrl: config.databaseUrl, roPassword: config.postgresRoPassword }).catch(() => {
    process.exit(1)
  })
}
