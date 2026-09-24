/**
 * scripts/seed-rbac.ts：对齐 AuraStack init_rbac_data.py
 *
 * - 全量/增量在独立临时库（castor_seed_*）上验证，不动共享测试库的 RBAC 数据
 * - 增量模式另在 TEST_DATABASE_URL（现库克隆）上连跑两次，确认幂等、不改已有 ID
 */

import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { MENUS_DATA, RETIRED_MENU_CODES, seedRbac } from '../scripts/seed-rbac'
import { checkPasswordHash } from '../src/common/password'
import { runMigrations } from '../src/db/migrate'
import { TEST_DATABASE_URL } from './helpers'

const TEMP_DB = 'castor_seed_vt_r8'
const quiet = () => {}

function urlForDatabase(name: string): string {
  const url = new URL(TEST_DATABASE_URL)
  url.pathname = `/${name}`
  return url.toString()
}
const TEMP_URL = urlForDatabase(TEMP_DB)

async function admin(sql: string): Promise<void> {
  const client = new pg.Client({ connectionString: urlForDatabase('postgres') })
  await client.connect()
  try {
    await client.query(sql)
  } finally {
    await client.end()
  }
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

/** 除 password_hash / created_at 外的 RBAC 全表快照（含 menus.updated_at，用于判断是否发生了写入） */
async function snapshot(url: string) {
  const [menus, roles, roleMenus, userRoles, users, seq] = await Promise.all([
    query(url, 'SELECT id, name, code, icon, path, component, parent_id, sort_order, is_visible, is_active, menu_type, description, updated_at::text FROM menus ORDER BY id'),
    query(url, 'SELECT id, name, code, description FROM roles ORDER BY id'),
    query(url, 'SELECT role_id, menu_id FROM role_menus ORDER BY 1, 2'),
    query(url, 'SELECT user_id, role_id FROM user_roles ORDER BY 1, 2'),
    query(url, 'SELECT id, username FROM admin_users ORDER BY id'),
    query(url, "SELECT last_value::int AS last_value, is_called FROM menus_id_seq"),
  ])
  return { menus, roles, roleMenus, userRoles, users, seq: seq[0] }
}

beforeAll(async () => {
  await admin(`DROP DATABASE IF EXISTS ${TEMP_DB} WITH (FORCE)`)
  await admin(`CREATE DATABASE ${TEMP_DB}`)
  await runMigrations(TEMP_URL, quiet)
})

afterAll(async () => {
  await admin(`DROP DATABASE IF EXISTS ${TEMP_DB} WITH (FORCE)`)
})

describe('MENUS_DATA', () => {
  it('与 Python 菜单树逐条一致：120 条、ID/编码唯一、父节点先于子节点', () => {
    expect(MENUS_DATA).toHaveLength(120)
    const ids = MENUS_DATA.map((m) => m.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(new Set(MENUS_DATA.map((m) => m.code)).size).toBe(ids.length)
    // 历史遗留 ID 不许改
    for (const [id, code] of [
      [31, 'system_list_page'],
      [33, 'system_stats_list_page'],
      [34, 'system_card_list_page'],
      [35, 'system_tree_list_page'],
      [36, 'system_dynamic_form_page'],
      [37, 'system_dashboard_page'],
      [32, 'system_scheduled_tasks'],
      [100002, 'system_notifications'],
      [100003, 'system_announcements'],
      [1000035, 'system_announcements_import'],
      [4423, 'cc_ai_prompt_delete'],
    ] as const) {
      expect(MENUS_DATA.find((m) => m.id === id)?.code).toBe(code)
    }
    const seen = new Set<number>()
    for (const menu of MENUS_DATA) {
      if (menu.parent_id !== null) expect(seen.has(menu.parent_id)).toBe(true)
      seen.add(menu.id)
      expect(menu.is_visible).toBe(menu.menu_type === 'menu')
    }
  })
})

describe('全量重建（空库）', () => {
  it('写入 120 个菜单 + super_admin + admin，序列与 Python 一致', async () => {
    const result = await seedRbac({ databaseUrl: TEMP_URL, adminPassword: 'ck_test_r8_pw', log: quiet })
    expect(result).toEqual({ menusAdded: 120, menusUpdated: 0, superAdminMenuCount: 120, adminCreated: true })

    const snap = await snapshot(TEMP_URL)
    expect(snap.menus.map((m) => m.id)).toEqual(MENUS_DATA.map((m) => m.id).sort((a, b) => a - b))
    const byId = new Map(snap.menus.map((m) => [m.id as number, m]))
    for (const menu of MENUS_DATA) {
      const row = byId.get(menu.id)!
      for (const key of ['name', 'code', 'icon', 'path', 'component', 'parent_id', 'sort_order', 'menu_type', 'is_visible', 'is_active'] as const) {
        expect(row[key], `${menu.code}.${key}`).toEqual(menu[key])
      }
      expect(row.description).toBeNull()
    }
    // Python 实测：menus_id_seq = max(id)+1 且 is_called=false；roles / admin_users 各用了一次序列
    expect(snap.seq).toEqual({ last_value: 1000036, is_called: false })
    expect(snap.roles).toEqual([{ id: 1, name: '超级管理员', code: 'super_admin', description: '拥有所有权限的超级管理员' }])
    expect(snap.users).toEqual([{ id: 1, username: 'admin' }])
    expect(snap.userRoles).toEqual([{ user_id: 1, role_id: 1 }])
    expect(snap.roleMenus).toHaveLength(120)

    const [user] = await query<{ password_hash: string }>(TEMP_URL, "SELECT password_hash FROM admin_users WHERE username = 'admin'")
    expect(user!.password_hash).toMatch(/^pbkdf2:sha256:1000000\$[A-Za-z0-9]{16}\$[0-9a-f]{64}$/)
    expect(await checkPasswordHash(user!.password_hash, 'ck_test_r8_pw')).toBe(true)
  })

  it('再次全量：清空后重建（自定义角色与用户被删除，角色/用户走新序列号）', async () => {
    await query(TEMP_URL, "INSERT INTO roles (name, code, created_at) VALUES ('临时', 'ck_test_r8_role', now())")
    await query(TEMP_URL, "INSERT INTO admin_users (username, password_hash, created_at) VALUES ('ck_test_r8_user', 'x', now())")
    await seedRbac({ databaseUrl: TEMP_URL, adminPassword: 'ck_test_r8_pw', log: quiet })
    const snap = await snapshot(TEMP_URL)
    expect(snap.roles.map((r) => r.code)).toEqual(['super_admin'])
    expect(snap.users.map((u) => u.username)).toEqual(['admin'])
    expect(snap.roles[0]!.id).toBe(3)
    expect(snap.users[0]!.id).toBe(3)
    expect(snap.menus).toHaveLength(120)
    expect(snap.seq).toEqual({ last_value: 1000036, is_called: false })
  })
})

describe('增量同步', () => {
  it('无变化时连跑两次：不发 UPDATE（updated_at 不变），结果完全一致', async () => {
    const before = await snapshot(TEMP_URL)
    const first = await seedRbac({ databaseUrl: TEMP_URL, adminPassword: 'other', incremental: true, log: quiet })
    const second = await seedRbac({ databaseUrl: TEMP_URL, adminPassword: 'other', incremental: true, log: quiet })
    expect(first).toEqual({ menusAdded: 0, menusUpdated: 120, superAdminMenuCount: 120, adminCreated: false })
    expect(second).toEqual(first)
    expect(await snapshot(TEMP_URL)).toEqual(before)
  })

  it('按 code 更新字段但不改 ID；固定 ID 被占用走序列；旧编码迁移；下线历史菜单；不删除自定义数据', async () => {
    await query(TEMP_URL, `
      BEGIN;
      UPDATE menus SET name = '旧名', sort_order = 42 WHERE code = 'system_users';
      DELETE FROM menus WHERE code = 'cc_ai_prompt_delete';
      INSERT INTO menus (id, name, code, sort_order, menu_type, is_visible, is_active, created_at, updated_at)
        VALUES (4423, '占位', 'ck_test_r8_occupier', 1, 'menu', true, true, now(), now());
      UPDATE menus SET code = 'data_management', name = '数据管理' WHERE code = 'component_center';
      INSERT INTO roles (id, name, code, created_at) VALUES (50, '测试', 'ck_test_r8_role', now());
      INSERT INTO menus (id, name, code, parent_id, sort_order, menu_type, is_visible, is_active, created_at, updated_at)
        VALUES (9001, '旧新增', 'system_query_management_add', 31, 1, 'button', false, true, now(), now());
      INSERT INTO menus (id, name, code, parent_id, sort_order, menu_type, is_visible, is_active, created_at, updated_at)
        VALUES (9002, '旧子', 'ck_test_r8_child', 9001, 1, 'button', false, true, now(), now());
      INSERT INTO role_menus VALUES (50, 9001), (50, 21);
      INSERT INTO menus (id, name, code, sort_order, menu_type, is_visible, is_active, created_at, updated_at)
        VALUES (9003, '模板', '${RETIRED_MENU_CODES[0]}', 1, 'menu', true, true, now(), now());
      UPDATE menus SET code = 'system_query_management_delete' WHERE code = 'system_list_page_delete';
      COMMIT;
    `)
    const result = await seedRbac({ databaseUrl: TEMP_URL, adminPassword: 'other', incremental: true, log: quiet })
    expect(result.menusAdded).toBe(1)

    const rows = await query<{ id: number; code: string; name: string; sort_order: number; parent_id: number | null; is_active: boolean; is_visible: boolean }>(
      TEMP_URL,
      'SELECT id, code, name, sort_order, parent_id, is_active, is_visible FROM menus',
    )
    const byCode = new Map(rows.map((r) => [r.code, r]))
    expect(byCode.get('system_users')).toMatchObject({ id: 21, name: '用户管理', sort_order: 1 })
    // 4423 被占用 → 走序列（上次 setval 后的下一个值）
    expect(byCode.get('cc_ai_prompt_delete')!.id).toBe(1000036)
    expect(byCode.get('ck_test_r8_occupier')!.id).toBe(4423)
    // data_management → component_center（沿用原 ID 3）
    expect(byCode.get('component_center')).toMatchObject({ id: 3, name: '组件示例中心' })
    expect(byCode.has('data_management')).toBe(false)
    // 旧编码与新编码并存 → 合并到新编码：子菜单改挂、角色关联迁移、旧记录删除
    expect(byCode.has('system_query_management_add')).toBe(false)
    const listPageAdd = byCode.get('system_list_page_add')!
    expect(listPageAdd.id).toBe(311)
    expect(byCode.get('ck_test_r8_child')!.parent_id).toBe(311)
    const roleMenus = await query<{ menu_id: number }>(TEMP_URL, 'SELECT menu_id FROM role_menus WHERE role_id = 50 ORDER BY 1')
    expect(roleMenus.map((r) => r.menu_id)).toEqual([21, 311])
    // 只有旧编码 → 原地改名
    expect(byCode.get('system_list_page_delete')!.id).toBe(313)
    expect(byCode.get(RETIRED_MENU_CODES[0])).toMatchObject({ is_active: false, is_visible: false })
    // 自定义角色保留；超级管理员拥有全部菜单
    const [{ n }] = (await query<{ n: number }>(TEMP_URL, "SELECT count(*)::int AS n FROM roles WHERE code = 'ck_test_r8_role'")) as [{ n: number }]
    expect(n).toBe(1)
    const [counts] = await query<{ menus: number; granted: number }>(
      TEMP_URL,
      "SELECT (SELECT count(*)::int FROM menus) AS menus, (SELECT count(*)::int FROM role_menus rm JOIN roles r ON r.id = rm.role_id WHERE r.code = 'super_admin') AS granted",
    )
    expect(counts!.granted).toBe(counts!.menus)
    const seq = await query(TEMP_URL, 'SELECT last_value::int AS last_value, is_called FROM menus_id_seq')
    expect(seq[0]).toEqual({ last_value: 1000037, is_called: false })

    const again = await snapshot(TEMP_URL)
    await seedRbac({ databaseUrl: TEMP_URL, adminPassword: 'other', incremental: true, log: quiet })
    expect(await snapshot(TEMP_URL)).toEqual(again)
  })

  it('测试库（现库克隆）上连跑两次：已有菜单 ID 不变，第二次零写入', async () => {
    const before = await query<{ id: number; code: string }>(TEST_DATABASE_URL, 'SELECT id, code FROM menus ORDER BY id')
    await seedRbac({ databaseUrl: TEST_DATABASE_URL, adminPassword: 'admin123', incremental: true, log: quiet })
    const afterFirst = await snapshot(TEST_DATABASE_URL)
    const idByCode = new Map(afterFirst.menus.map((m) => [m.code as string, m.id as number]))
    for (const { id, code } of before) expect(idByCode.get(code)).toBe(id)
    for (const menu of MENUS_DATA) expect(idByCode.has(menu.code)).toBe(true)

    await seedRbac({ databaseUrl: TEST_DATABASE_URL, adminPassword: 'admin123', incremental: true, log: quiet })
    expect(await snapshot(TEST_DATABASE_URL)).toEqual(afterFirst)
  })
})
