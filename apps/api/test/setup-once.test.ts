/**
 * scripts/setup-once.ts + scripts/init-ro-role.ts
 *
 * Verified on a temporary DB (castor_seed_*): full flow on an empty DB, two concurrent runs (serialized by an advisory lock), idempotency, and the read-only role's grant scope.
 * The read-only role is a cluster-level object: the test uses a dedicated role name ck_test_r8_ro and runs DROP OWNED + DROP ROLE at the end, never touching the shared read-only role.
 */

import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { initRoRole, isVisibleTable, RO_ROLE } from '../scripts/init-ro-role'
import { ADVISORY_LOCK_KEY, runSetupOnce } from '../scripts/setup-once'
import { MENUS_DATA } from '../scripts/seed-rbac'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { TEST_DATABASE_URL } from './helpers'

const EMPTY_DB = 'castor_seed_vt_r8_setup'
const TEST_ROLE = 'ck_test_r8_ro'
const quiet = () => {}

function urlForDatabase(name: string): string {
  const url = new URL(TEST_DATABASE_URL)
  url.pathname = `/${name}`
  return url.toString()
}

async function query<T extends pg.QueryResultRow>(url: string, sql: string, params: unknown[] = []): Promise<T[]> {
  const client = new pg.Client({ connectionString: url })
  await client.connect()
  try {
    return (await client.query<T>(sql, params)).rows
  } finally {
    await client.end()
  }
}

const adminSql = (sql: string) => query(urlForDatabase('postgres'), sql)

async function dropTestRole(): Promise<void> {
  const exists = await adminSql(`SELECT 1 FROM pg_roles WHERE rolname = '${TEST_ROLE}'`)
  if (exists.length === 0) return
  for (const db of [EMPTY_DB]) {
    const dbExists = await adminSql(`SELECT 1 FROM pg_database WHERE datname = '${db}'`)
    if (dbExists.length > 0) await query(urlForDatabase(db), `DROP OWNED BY ${TEST_ROLE}`)
  }
  await adminSql(`DROP ROLE ${TEST_ROLE}`)
}

async function rbacSnapshot(url: string) {
  return {
    menus: await query(url, 'SELECT id, code, name, parent_id, sort_order, updated_at::text FROM menus ORDER BY id'),
    roles: await query(url, 'SELECT id, code FROM roles ORDER BY id'),
    roleMenus: await query(url, 'SELECT role_id, menu_id FROM role_menus ORDER BY 1, 2'),
    users: await query(url, 'SELECT id, username, password_hash FROM admin_users ORDER BY id'),
    userRoles: await query(url, 'SELECT user_id, role_id FROM user_roles ORDER BY 1, 2'),
    migrations: await query(url, 'SELECT hash FROM drizzle.__drizzle_migrations ORDER BY id'),
  }
}

beforeAll(async () => {
  await dropTestRole()
  for (const db of [EMPTY_DB]) {
    await adminSql(`DROP DATABASE IF EXISTS ${db} WITH (FORCE)`)
    await adminSql(`CREATE DATABASE ${db}`)
  }
})

afterAll(async () => {
  await dropTestRole()
  for (const db of [EMPTY_DB]) await adminSql(`DROP DATABASE IF EXISTS ${db} WITH (FORCE)`)
})

describe('isVisibleTable（与 AI SQL 的表可见范围同一套规则）', () => {
  it('精确排除 RBAC 表、前缀排除 admin_/audit_/scheduled_task、后缀排除 _logs', () => {
    for (const name of ['roles', 'menus', 'user_roles', 'role_menus', 'admin_users', 'audit_x', 'scheduled_tasks', 'scheduled_task_runs', 'login_logs', 'operation_logs', 'ADMIN_USERS', '']) {
      expect(isVisibleTable(name), name).toBe(name === '')
    }
    for (const name of ['list_page_items', 'dict_types', 'notifications', 'migrations_x', 'log_entries', 'user_roles_x']) {
      expect(isVisibleTable(name), name).toBe(true)
    }
    expect(isVisibleTable(null)).toBe(true)
    expect(RO_ROLE).toBe('castor_kit_ro')
  })
})

const DRIZZLE_DIR = resolve(__dirname, '../drizzle')
/** Current number of migrations in the repo (grows as features are added) */
const MIGRATION_COUNT = (JSON.parse(readFileSync(join(DRIZZLE_DIR, 'meta/_journal.json'), 'utf8')) as { entries: unknown[] }).entries.length

describe('setup-once', () => {
  const url = urlForDatabase(EMPTY_DB)

  it('空库：两个实例并发执行，advisory lock 串行化，结果与单次执行一致', async () => {
    const events: string[] = []
    const logger = (tag: string) => (msg: string) => {
      if (msg.startsWith('[setup]')) events.push(`${tag} ${msg}`)
    }
    // Hold the lock first, and confirm both instances are waiting on it and neither has started migrating
    const holder = new pg.Client({ connectionString: url })
    await holder.connect()
    await holder.query(`SELECT pg_advisory_lock(${ADVISORY_LOCK_KEY})`)
    const runs = Promise.all([
      runSetupOnce({ databaseUrl: url, adminPassword: 'ck_test_r8_pw', roPassword: '', log: logger('A') }),
      runSetupOnce({ databaseUrl: url, adminPassword: 'ck_test_r8_pw', roPassword: '', log: logger('B') }),
    ])
    await new Promise((r) => setTimeout(r, 300))
    expect(events).toEqual([])
    const waiting = await query<{ n: number }>(
      url,
      `SELECT count(*)::int AS n FROM pg_locks WHERE locktype = 'advisory' AND objid = ${ADVISORY_LOCK_KEY} AND NOT granted`,
    )
    expect(waiting[0]!.n).toBe(2)
    await holder.query(`SELECT pg_advisory_unlock(${ADVISORY_LOCK_KEY})`)
    await holder.end()
    await runs

    // The two runs don't interleave: one instance runs to completion (through the read-only account step) before the other gets the lock
    const first = events[0]!.slice(0, 1)
    const second = first === 'A' ? 'B' : 'A'
    const secondAcquired = events.indexOf(`${second} [setup] 已获取初始化锁（并发安全）`)
    const firstReleased = `${first} [setup] 初始化完成，已释放锁`
    expect(events.slice(0, secondAcquired).filter((e) => e !== firstReleased)).toEqual([
      `${first} [setup] 已获取初始化锁（并发安全）`,
      `${first} [setup] 运行数据库迁移...`,
      `${first} [setup] 数据库迁移完成`,
      `${first} [setup] 同步 RBAC 菜单与权限...`,
      `${first} [setup] 初始化 AI SQL 只读账号...`,
    ])
    expect(events.filter((e) => e.startsWith(second))).toHaveLength(6)

    const snap = await rbacSnapshot(url)
    expect(snap.menus).toHaveLength(MENUS_DATA.length)
    expect(snap.roles).toEqual([{ id: 1, code: 'super_admin' }])
    expect(snap.users.map((u) => u.username)).toEqual(['admin'])
    expect(snap.roleMenus).toHaveLength(MENUS_DATA.length)
    expect(snap.migrations).toHaveLength(MIGRATION_COUNT)
    const locks = await query<{ n: number }>(url, `SELECT count(*)::int AS n FROM pg_locks WHERE locktype = 'advisory' AND objid = ${ADVISORY_LOCK_KEY}`)
    expect(locks[0]!.n).toBe(0)
  })

  it('再次执行幂等：增量同步不删用户/自定义角色，数据与 updated_at 均不变', async () => {
    await query(url, "INSERT INTO roles (name, code, created_at) VALUES ('自定义', 'ck_test_r8_role', now())")
    await query(url, "INSERT INTO admin_users (username, password_hash, created_at) VALUES ('ck_test_r8_user', 'x', now())")
    const before = await rbacSnapshot(url)
    await runSetupOnce({ databaseUrl: url, adminPassword: 'changed', roPassword: '', log: quiet })
    expect(await rbacSnapshot(url)).toEqual(before)
  })

  it('配置只读密码：创建只读角色，只授权业务表 SELECT，角色级强制只读 + 超时；重复执行幂等', async () => {
    const log: string[] = []
    await runSetupOnce({ databaseUrl: url, adminPassword: 'x', roPassword: " ck'pw ", roRoleName: TEST_ROLE, log: (m) => log.push(m) })
    await runSetupOnce({ databaseUrl: url, adminPassword: 'x', roPassword: "ck'pw", roRoleName: TEST_ROLE, log: quiet })

    const tables = await query<{ table_name: string }>(url, "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'")
    const expected = tables.map((t) => t.table_name).filter(isVisibleTable).sort()
    expect(log).toContain(`完成：为 ${expected.length} 张业务表授予只读权限`)
    const grants = await query<{ table_name: string; privilege_type: string }>(
      url,
      'SELECT table_name, privilege_type FROM information_schema.role_table_grants WHERE grantee = $1 ORDER BY 1',
      [TEST_ROLE],
    )
    expect(grants.map((g) => g.table_name).sort()).toEqual(expected)
    expect(new Set(grants.map((g) => g.privilege_type))).toEqual(new Set(['SELECT']))
    expect(grants.map((g) => g.table_name)).not.toContain('admin_users')

    const [role] = await query<{ rolconfig: string[]; rolsuper: boolean; rolcreatedb: boolean; rolcreaterole: boolean; rolcanlogin: boolean }>(
      url,
      'SELECT rolconfig, rolsuper, rolcreatedb, rolcreaterole, rolcanlogin FROM pg_roles WHERE rolname = $1',
      [TEST_ROLE],
    )
    expect(role).toEqual({
      rolconfig: ['default_transaction_read_only=on', 'statement_timeout=5000'],
      rolsuper: false,
      rolcreatedb: false,
      rolcreaterole: false,
      rolcanlogin: true,
    })
    const [priv] = await query<{ usage: boolean; temp: boolean }>(
      url,
      `SELECT has_schema_privilege($1, 'public', 'USAGE') AS usage, has_database_privilege('public', $2, 'TEMPORARY') AS temp`,
      [TEST_ROLE, EMPTY_DB],
    )
    expect(priv).toEqual({ usage: true, temp: false })
  })

  it('initRoRole：未配置密码跳过；非法角色名拒绝', async () => {
    const log: string[] = []
    expect(await initRoRole({ databaseUrl: url, roPassword: '   ', log: (m) => log.push(m) })).toEqual({ skipped: true, granted: 0 })
    expect(log).toEqual(['未配置 POSTGRES_RO_PASSWORD，跳过 AI SQL 只读角色初始化'])
    await expect(initRoRole({ databaseUrl: url, roPassword: 'x', roleName: 'bad; drop', log: quiet })).rejects.toThrow('非法角色名')
  })
})
