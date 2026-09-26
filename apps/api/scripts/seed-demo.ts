/**
 * Sample data for trying departments and data scope: a small org tree, two restricted roles and a few users.
 *
 * Usage:
 *   pnpm seed:demo                          # password defaults to demo123456 (or DEMO_USER_PASSWORD)
 *   pnpm seed:demo -- --password <pwd>
 *   pnpm seed:demo -- --force               # allow NODE_ENV=production (e.g. a public demo site)
 *
 * Run after `pnpm seed:rbac` (roles are granted menus by code). Idempotent: departments / roles / users are matched by
 * code / username and updated in place; nothing is deleted, and existing users keep their passwords.
 */

import { parseArgs } from 'node:util'
import pg from 'pg'
import { generatePasswordHash } from '../src/common/password'
import { loadConfig, loadEnvFiles, type AppEnv } from '../src/config'

type Queryable = Pick<pg.Client, 'query'>
const UTC_NOW = "timezone('utc', now())"

export const DEMO_PASSWORD = 'demo123456'

/** [code, name, parent code, sort order] — parents come before children */
export const DEMO_DEPARTMENTS: [string, string, string | null, number][] = [
  ['hq', '总公司', null, 10],
  ['rd', '研发部', 'hq', 10],
  ['rd-fe', '前端组', 'rd', 10],
  ['rd-be', '后端组', 'rd', 20],
  ['mkt', '市场部', 'hq', 20],
  ['ops', '运营部', 'hq', 30],
]

export const DEMO_ROLES: { code: string; name: string; description: string; dataScope: string; menus: string[] }[] = [
  {
    code: 'dept_manager',
    name: '部门主管',
    description: '示例角色：管理本部门及下级部门的用户',
    dataScope: 'dept_and_children',
    menus: [
      'dashboard',
      'system_users',
      'system_users_add',
      'system_users_edit',
      'system_users_status',
      'system_users_export',
      'system_departments',
    ],
  },
  {
    code: 'staff',
    name: '普通员工',
    description: '示例角色：只能看到自己的数据',
    dataScope: 'self',
    menus: ['dashboard', 'system_users'],
  },
]

/** [username, nickname, department code, role code, leads the department] */
export const DEMO_USERS: [string, string, string, string, boolean][] = [
  ['zhang.wei', '张伟', 'rd', 'dept_manager', true],
  ['li.na', '李娜', 'rd-fe', 'staff', false],
  ['wang.qiang', '王强', 'rd-be', 'staff', false],
  ['liu.yang', '刘洋', 'mkt', 'dept_manager', true],
  ['chen.jing', '陈静', 'mkt', 'staff', false],
  ['zhao.lei', '赵磊', 'ops', 'staff', false],
]

export interface SeedDemoOptions {
  databaseUrl: string
  password?: string
  log?: (line: string) => void
}

export interface SeedDemoResult {
  departments: number
  roles: number
  usersCreated: number
  usersUpdated: number
  missingMenus: string[]
}

async function upsertDepartments(client: Queryable): Promise<Map<string, number>> {
  const ids = new Map<string, number>()
  for (const [code, name, parent, sort] of DEMO_DEPARTMENTS) {
    const parentId = parent ? ids.get(parent)! : null
    const { rows } = await client.query<{ id: number }>(
      `INSERT INTO departments (code, name, parent_id, sort_order, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'active', ${UTC_NOW}, ${UTC_NOW})
       ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, parent_id = EXCLUDED.parent_id, sort_order = EXCLUDED.sort_order
       RETURNING id`,
      [code, name, parentId, sort],
    )
    ids.set(code, rows[0]!.id)
  }
  return ids
}

async function upsertRoles(client: Queryable, missingMenus: Set<string>): Promise<Map<string, number>> {
  const ids = new Map<string, number>()
  for (const role of DEMO_ROLES) {
    const { rows } = await client.query<{ id: number }>(
      `INSERT INTO roles (code, name, description, data_scope, created_at) VALUES ($1, $2, $3, $4, ${UTC_NOW})
       ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, data_scope = EXCLUDED.data_scope
       RETURNING id`,
      [role.code, role.name, role.description, role.dataScope],
    )
    const roleId = rows[0]!.id
    ids.set(role.code, roleId)
    const found = await client.query<{ id: number; code: string }>('SELECT id, code FROM menus WHERE code = ANY($1)', [role.menus])
    const foundCodes = new Set(found.rows.map((r) => r.code))
    role.menus.filter((c) => !foundCodes.has(c)).forEach((c) => missingMenus.add(c))
    await client.query('DELETE FROM role_menus WHERE role_id = $1', [roleId])
    for (const menu of found.rows) {
      await client.query('INSERT INTO role_menus (role_id, menu_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [roleId, menu.id])
    }
  }
  return ids
}

async function upsertUsers(
  client: Queryable,
  depts: Map<string, number>,
  roles: Map<string, number>,
  password: string,
): Promise<{ created: number; updated: number }> {
  let created = 0
  let updated = 0
  const passwordHash = await generatePasswordHash(password)
  for (const [username, nickname, deptCode, roleCode, leads] of DEMO_USERS) {
    const deptId = depts.get(deptCode)!
    const email = `${username}@example.com`
    const existing = await client.query<{ id: number }>('SELECT id FROM admin_users WHERE username = $1', [username])
    let userId = existing.rows[0]?.id
    if (userId === undefined) {
      const inserted = await client.query<{ id: number }>(
        `INSERT INTO admin_users (username, password_hash, nickname, email, dept_id, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, 'active', ${UTC_NOW}, ${UTC_NOW}) RETURNING id`,
        [username, passwordHash, nickname, email, deptId],
      )
      userId = inserted.rows[0]!.id
      created += 1
    } else {
      // Keep the password; the email is only filled in when free (it's unique)
      await client.query(
        `UPDATE admin_users SET nickname = $2, dept_id = $3,
           email = COALESCE(email, CASE WHEN EXISTS (SELECT 1 FROM admin_users WHERE email = $4) THEN NULL ELSE $4 END)
         WHERE id = $1`,
        [userId, nickname, deptId, email],
      )
      updated += 1
    }
    await client.query('INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [userId, roles.get(roleCode)!])
    if (leads) await client.query('UPDATE departments SET leader_id = $1 WHERE id = $2', [userId, deptId])
  }
  return { created, updated }
}

/** Reusable entry point; everything runs in one transaction */
export async function seedDemo(options: SeedDemoOptions): Promise<SeedDemoResult> {
  const log = options.log ?? console.log
  const password = options.password || DEMO_PASSWORD
  const client = new pg.Client({ connectionString: options.databaseUrl })
  await client.connect()
  try {
    await client.query('BEGIN')
    const missing = new Set<string>()
    const depts = await upsertDepartments(client)
    const roles = await upsertRoles(client, missing)
    const users = await upsertUsers(client, depts, roles, password)
    await client.query('COMMIT')

    log(`部门 ${depts.size} 个、角色 ${roles.size} 个；新建用户 ${users.created} 个，更新 ${users.updated} 个`)
    if (missing.size > 0) log(`⚠️  以下菜单编码不存在，先运行 pnpm seed:rbac -- --incremental：${[...missing].join(', ')}`)
    log('\n示例账号（新建账号的密码：' + password + '；已存在的账号保留原密码）：')
    for (const [username, nickname, deptCode, roleCode] of DEMO_USERS) {
      const dept = DEMO_DEPARTMENTS.find(([c]) => c === deptCode)![1]
      const role = DEMO_ROLES.find((r) => r.code === roleCode)!.name
      log(`  ${username.padEnd(12)} ${nickname}  ${dept} · ${role}`)
    }
    log('\n部门主管能看到本部门及下级部门的用户，普通员工只能看到自己。')
    return {
      departments: depts.size,
      roles: roles.size,
      usersCreated: users.created,
      usersUpdated: users.updated,
      missingMenus: [...missing],
    }
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    await client.end()
  }
}

const isMain = /[\\/]seed-demo\.(?:ts|js|mjs)$/.test(process.argv[1] ?? '')
if (isMain) {
  let values: { password?: string; force: boolean }
  try {
    ;({ values } = parseArgs({
      args: process.argv.slice(2).filter((arg) => arg !== '--'),
      options: { password: { type: 'string' }, force: { type: 'boolean', default: false } },
    }))
  } catch (err) {
    console.error('usage: seed-demo [--password <pwd>] [--force]')
    console.error(`seed-demo: error: ${err instanceof Error ? err.message : String(err)}`)
    process.exit(2)
  }
  const env = (process.env.NODE_ENV ?? 'development') as AppEnv
  if (env === 'production' && !values.force) {
    console.error('❌ 生产环境不会写入示例数据；确实需要（例如公开演示站）请加 --force')
    process.exit(1)
  }
  loadEnvFiles(env)
  const config = loadConfig()
  seedDemo({ databaseUrl: config.databaseUrl, password: values.password || process.env.DEMO_USER_PASSWORD }).catch((err: unknown) => {
    console.error(`\n示例数据写入失败: ${err instanceof Error ? err.message : String(err)}`)
    process.exit(1)
  })
}
