/**
 * scripts/seed-demo.ts: sample departments / roles / users, run on a temporary database (castor_seed_demo_*)
 * after migrations + seed-rbac, so the shared test DB is untouched.
 */

import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { DEMO_DEPARTMENTS, DEMO_ROLES, DEMO_USERS, seedDemo } from '../scripts/seed-demo'
import { seedRbac } from '../scripts/seed-rbac'
import { computeDataScope } from '../src/common/data-scope'
import { checkPasswordHash } from '../src/common/password'
import { runMigrations } from '../src/db/migrate'
import type { AdminUserWithRoles } from '../src/db/schema'
import { TEST_DATABASE_URL } from './helpers'

const TEMP_DB = 'castor_seed_demo_q4'
const quiet = () => {}

function urlForDatabase(name: string): string {
  const url = new URL(TEST_DATABASE_URL)
  url.pathname = `/${name}`
  return url.toString()
}
const TEMP_URL = urlForDatabase(TEMP_DB)

async function query<T extends pg.QueryResultRow>(url: string, sql: string, params: unknown[] = []): Promise<T[]> {
  const client = new pg.Client({ connectionString: url })
  await client.connect()
  try {
    return (await client.query<T>(sql, params)).rows
  } finally {
    await client.end()
  }
}

beforeAll(async () => {
  await query(urlForDatabase('postgres'), `DROP DATABASE IF EXISTS ${TEMP_DB} WITH (FORCE)`)
  await query(urlForDatabase('postgres'), `CREATE DATABASE ${TEMP_DB}`)
  await runMigrations(TEMP_URL, quiet)
  await seedRbac({ databaseUrl: TEMP_URL, adminPassword: 'admin-pass-1', incremental: true, log: quiet })
}, 120_000)

afterAll(async () => {
  await query(urlForDatabase('postgres'), `DROP DATABASE IF EXISTS ${TEMP_DB} WITH (FORCE)`)
})

describe('seed-demo', () => {
  it('写入部门树、两个受限角色（带菜单）和示例用户；新账号密码可用', async () => {
    const result = await seedDemo({ databaseUrl: TEMP_URL, password: 'demo-pass-1', log: quiet })
    expect(result).toEqual({
      departments: DEMO_DEPARTMENTS.length,
      roles: DEMO_ROLES.length,
      usersCreated: DEMO_USERS.length,
      usersUpdated: 0,
      missingMenus: [],
    })

    const depts = await query<{ code: string; parent: string | null; leader: string | null }>(
      TEMP_URL,
      `SELECT d.code, p.code AS parent, u.username AS leader FROM departments d
       LEFT JOIN departments p ON p.id = d.parent_id LEFT JOIN admin_users u ON u.id = d.leader_id ORDER BY d.id`,
    )
    expect(depts.map((d) => [d.code, d.parent])).toEqual(DEMO_DEPARTMENTS.map(([code, , parent]) => [code, parent]))
    expect(depts.find((d) => d.code === 'rd')!.leader).toBe('zhang.wei')

    const roles = await query<{ code: string; data_scope: string; menus: number }>(
      TEMP_URL,
      `SELECT r.code, r.data_scope, count(rm.menu_id)::int AS menus FROM roles r LEFT JOIN role_menus rm ON rm.role_id = r.id
       WHERE r.code IN ('dept_manager', 'staff') GROUP BY r.code, r.data_scope ORDER BY r.code`,
    )
    expect(roles).toEqual([
      { code: 'dept_manager', data_scope: 'dept_and_children', menus: DEMO_ROLES[0]!.menus.length },
      { code: 'staff', data_scope: 'self', menus: DEMO_ROLES[1]!.menus.length },
    ])

    const [li] = await query<{ password_hash: string }>(TEMP_URL, "SELECT password_hash FROM admin_users WHERE username = 'li.na'")
    expect(await checkPasswordHash(li!.password_hash, 'demo-pass-1')).toBe(true)
  })

  it('重复执行：只更新不新增，已存在账号保留原密码', async () => {
    const before = await query<{ n: number }>(TEMP_URL, 'SELECT count(*)::int AS n FROM admin_users')
    const result = await seedDemo({ databaseUrl: TEMP_URL, password: 'another-pass', log: quiet })
    expect(result).toMatchObject({ usersCreated: 0, usersUpdated: DEMO_USERS.length })
    expect((await query<{ n: number }>(TEMP_URL, 'SELECT count(*)::int AS n FROM admin_users'))[0]!.n).toBe(before[0]!.n)
    const [li] = await query<{ password_hash: string }>(TEMP_URL, "SELECT password_hash FROM admin_users WHERE username = 'li.na'")
    expect(await checkPasswordHash(li!.password_hash, 'demo-pass-1')).toBe(true)
  })

  it('数据范围：研发部主管看到研发部及其下级，普通员工只看到自己', async () => {
    const deptIds = new Map(
      (await query<{ id: number; code: string }>(TEMP_URL, 'SELECT id, code FROM departments')).map((d) => [d.code, d.id]),
    )
    const subtree = async (ids: number[]) =>
      (
        await query<{ id: number }>(
          TEMP_URL,
          `WITH RECURSIVE t(id) AS (SELECT id FROM departments WHERE id = ANY($1) UNION SELECT d.id FROM departments d JOIN t ON d.parent_id = t.id) SELECT id FROM t`,
          [ids],
        )
      ).map((r) => r.id)
    const user = (id: number, deptCode: string, scope: string) =>
      ({ id, dept_id: deptIds.get(deptCode)!, roles: [{ id: 1, code: 'x', data_scope: scope, menus: [] }] }) as unknown as AdminUserWithRoles
    const lookups = { customDeptIds: async () => [], subtree }

    const manager = await computeDataScope(user(1, 'rd', 'dept_and_children'), lookups)
    expect(manager.all ? [] : [...manager.deptIds].sort()).toEqual(
      ['rd', 'rd-fe', 'rd-be'].map((c) => deptIds.get(c)!).sort((a, b) => a - b),
    )
    expect(await computeDataScope(user(2, 'rd-fe', 'self'), lookups)).toMatchObject({ deptIds: [], self: true })
  })
})
