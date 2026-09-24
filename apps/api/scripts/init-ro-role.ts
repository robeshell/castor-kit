/**
 * AI SQL 只读角色初始化（对齐 AuraStack backend/scripts/init_ai_sql_ro_role.py）
 *
 * 在迁移建表之后执行：创建非超级用户只读角色 aurastack_ro，仅授予业务表 SELECT
 * （排除 admin_users / 日志 / 定时任务等敏感表，复用 AI SQL 模块的 isVisibleTable），
 * 并强制角色级只读 + 超时。
 *
 * 用法：`pnpm init-ro-role`（setup-once 在迁移与 RBAC 之后调用）。
 * 未配置 POSTGRES_RO_PASSWORD 时跳过（不阻塞启动）。全程幂等，新迁移新增的业务表会被自动授权。
 */

import pg from 'pg'
import { loadConfig, loadEnvFiles, type AppEnv } from '../src/config'
import { isVisibleTable } from '../src/modules/component-center/ai-sql/schema'

export const RO_ROLE = 'aurastack_ro'
const SAFE_TABLE_NAME = /^[a-z0-9_]+$/
const SAFE_ROLE_NAME = /^[a-z_][a-z0-9_]*$/

// 授权范围与 AI SQL 的 schema 可见范围同一套规则（ai_sql_engine.is_visible_table）
export { isVisibleTable }

export interface InitRoRoleOptions {
  databaseUrl: string
  /** POSTGRES_RO_PASSWORD（首尾空白已去除）；为空则跳过 */
  roPassword: string
  /** 只读角色名，默认 aurastack_ro（测试用独立角色名，避免改动集群里共用角色的密码） */
  roleName?: string
  log?: (msg: string) => void
}

export interface InitRoRoleResult {
  skipped: boolean
  granted: number
}

/** 对齐 SQLAlchemy `engine.url.database` */
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
    // 1. 幂等创建角色（LOGIN，非超级用户、无建库建角色权限）
    await client.query(`
      DO $$
      BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${role}') THEN
              CREATE ROLE ${role} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE;
          END IF;
      END $$;
    `)
    // 2. 设置密码：ALTER ROLE 是工具语句不支持绑定参数，用 escapeLiteral 转义（Python 由 psycopg2 客户端插值）
    await client.query(`ALTER ROLE ${role} PASSWORD ${client.escapeLiteral(roPassword)}`)
    // 3. 角色级强制只读 + 超时（即使绕过应用层连接参数也生效）
    await client.query(`ALTER ROLE ${role} SET default_transaction_read_only = on`)
    await client.query(`ALTER ROLE ${role} SET statement_timeout = 5000`)
    // 4. 允许访问 public 模式
    await client.query(`GRANT USAGE ON SCHEMA public TO ${role}`)

    // 5. 只授予业务表 SELECT（敏感表不授权，连 SELECT 都拿不到）
    const { rows } = await client.query<{ table_name: string }>(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'",
    )
    let granted = 0
    for (const { table_name: tname } of rows) {
      if (!isVisibleTable(tname)) continue
      // 表名来自 information_schema 且经白名单校验，安全拼接
      if (!SAFE_TABLE_NAME.test(tname)) {
        log(`  跳过非预期表名: ${tname}`)
        continue
      }
      await client.query(`GRANT SELECT ON TABLE "${tname}" TO ${role}`)
      granted += 1
    }

    // 6. 禁止 PUBLIC 使用临时表（加固）
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

// 按脚本文件名判断是否为直接运行：本文件会被 setup-once 打包进同一个产物，import.meta.url 不可靠
const isMain = /[\\/]init-ro-role\.(?:ts|js|mjs)$/.test(process.argv[1] ?? '')
if (isMain) {
  const env = (process.env.NODE_ENV ?? 'development') as AppEnv
  loadEnvFiles(env)
  const config = loadConfig()
  initRoRole({ databaseUrl: config.databaseUrl, roPassword: config.postgresRoPassword }).catch(() => {
    process.exit(1)
  })
}
