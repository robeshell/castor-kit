/**
 * Roadmap stage 1 acceptance: on the same table (admin_users), `self` sees only its own row, `dept` only its
 * department, `dept_and_children` includes sub-departments, `custom` the listed departments; out-of-scope detail /
 * update / delete are 404 and exports are limited the same way.
 *
 * Tree: A > (A1, A2), plus a separate root B. Plain users: m_a (A), m_a1 (A1), m_a2 (A2), m_b (B).
 */
import { eq, inArray, like } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { generatePasswordHash } from '@/common/password'
import type { DbHandle } from '@/db/client'
import { admin_users, departments } from '@/db/schema'
import { buildTestApp, cleanupFixture, openTestDb, scopedSession, superAdminSession, type AuthedSession } from './helpers'

const P = 'ck_test_ds_'
const CODES = ['system_users', 'system_users_add', 'system_users_edit', 'system_users_delete', 'system_users_status']
let app: FastifyInstance
let handle: DbHandle
const dept: Record<string, number> = {}
const member: Record<string, number> = {}

async function cleanupDepts() {
  await handle.db.update(admin_users).set({ dept_id: null }).where(like(admin_users.username, 'ck_test_%'))
  const rows = await handle.db.select().from(departments).where(like(departments.code, `${P}%`))
  const children = rows.filter((r) => r.parent_id !== null).map((r) => r.id)
  if (children.length) await handle.db.delete(departments).where(inArray(departments.id, children))
  await handle.db.delete(departments).where(like(departments.code, `${P}%`))
}

beforeAll(async () => {
  handle = openTestDb()
  app = await buildTestApp()
  await cleanupFixture(handle)
  await cleanupDepts()
  const add = async (key: string, parent: string | null) => {
    const [row] = await handle.db
      .insert(departments)
      .values({ name: key, code: `${P}${key}`, parent_id: parent ? dept[parent]! : null })
      .returning()
    dept[key] = row!.id
  }
  await add('A', null)
  await add('A1', 'A')
  await add('A2', 'A')
  await add('B', null)
  const hash = await generatePasswordHash('member-pass', 1000)
  for (const [key, d] of [['m_a', 'A'], ['m_a1', 'A1'], ['m_a2', 'A2'], ['m_b', 'B']] as const) {
    const [row] = await handle.db.insert(admin_users).values({ username: `${P}${key}`, password_hash: hash, dept_id: dept[d]! }).returning()
    member[key] = row!.id
  }
})

afterAll(async () => {
  await cleanupFixture(handle)
  await cleanupDepts()
  await app.close()
  await handle.pool.end()
})

/** ck_test_ usernames the session can list (members + operators of this file) */
async function visible(s: AuthedSession): Promise<string[]> {
  const res = await s.inject({ url: '/api/admin/users?search=ck_test_ds_&per_page=200' })
  expect(res.statusCode, res.body).toBe(200)
  return (res.json().items as { username: string }[]).map((u) => u.username.replace(P, '')).sort()
}

describe('users data scope', () => {
  it('self：只看到自己', async () => {
    const s = await scopedSession(app, handle, { name: 'ds_op_self', codes: CODES, dataScope: 'self', deptId: dept.A1 })
    expect(await visible(s)).toEqual(['op_self'])
  })

  it('dept：只看到本部门', async () => {
    const s = await scopedSession(app, handle, { name: 'ds_op_dept', codes: CODES, dataScope: 'dept', deptId: dept.A })
    expect(await visible(s)).toEqual(['m_a', 'op_dept'])
  })

  it('dept_and_children：本部门及下级', async () => {
    const s = await scopedSession(app, handle, { name: 'ds_op_tree', codes: CODES, dataScope: 'dept_and_children', deptId: dept.A })
    expect(await visible(s)).toEqual(['m_a', 'm_a1', 'm_a2', 'op_dept', 'op_self', 'op_tree'])
  })

  it('custom：只看到勾选的部门（不含自己所在部门）', async () => {
    const s = await scopedSession(app, handle, {
      name: 'ds_op_custom',
      codes: CODES,
      dataScope: 'custom',
      deptId: dept.A1,
      customDeptIds: [dept.A2!, dept.B!],
    })
    expect(await visible(s)).toEqual(['m_a2', 'm_b'])
  })

  it('dept 角色但用户没有部门：什么也看不到（不会退化成看全部）', async () => {
    const s = await scopedSession(app, handle, { name: 'ds_op_nodept', codes: CODES, dataScope: 'dept', deptId: null })
    expect(await visible(s)).toEqual([])
  })

  it('越权修改 / 停用 / 删除 → 404；范围内正常', async () => {
    const s = await scopedSession(app, handle, { name: 'ds_op_dept2', codes: CODES, dataScope: 'dept', deptId: dept.A })
    const outside = member.m_b!
    expect((await s.inject({ method: 'PUT', url: `/api/admin/users/${outside}`, payload: { nickname: 'x' } })).statusCode).toBe(404)
    expect((await s.inject({ method: 'PUT', url: `/api/admin/users/${outside}/status`, payload: { status: 'disabled' } })).statusCode).toBe(404)
    expect((await s.inject({ method: 'DELETE', url: `/api/admin/users/${outside}` })).statusCode).toBe(404)
    const [still] = await handle.db.select().from(admin_users).where(eq(admin_users.id, outside))
    expect(still).toMatchObject({ nickname: null, status: 'active' })

    const inside = await s.inject({ method: 'PUT', url: `/api/admin/users/${member.m_a}`, payload: { nickname: '甲' } })
    expect(inside.json()).toMatchObject({ nickname: '甲', dept_id: dept.A, dept_name: 'A' })
  })

  it('范围受限时不能把用户分配到范围外的部门', async () => {
    const s = await scopedSession(app, handle, { name: 'ds_op_dept3', codes: CODES, dataScope: 'dept', deptId: dept.A })
    const move = await s.inject({ method: 'PUT', url: `/api/admin/users/${member.m_a}`, payload: { dept_id: dept.B } })
    expect(move.json()).toEqual({ error: '不能把用户分配到数据权限范围外的部门' })
    const create = await s.inject({
      method: 'POST',
      url: '/api/admin/users',
      payload: { username: `${P}new`, password: 'x-pass-1', dept_id: dept.A1 },
    })
    expect(create.json()).toEqual({ error: '不能把用户分配到数据权限范围外的部门' })
    expect((await s.inject({ method: 'PUT', url: `/api/admin/users/${member.m_a}`, payload: { dept_id: 999999 } })).json()).toEqual({
      error: '部门不存在',
    })
  })

  it('导出同样受限（勾选范围外的 id 也导不出来）', async () => {
    const s = await scopedSession(app, handle, {
      name: 'ds_op_exp',
      codes: [...CODES, 'system_users_export'],
      dataScope: 'custom',
      deptId: null,
      customDeptIds: [dept.B!],
    })
    const filtered = await s.inject({
      method: 'POST',
      url: '/api/admin/users/export',
      payload: { export_mode: 'filtered', filters: { search: P }, fields: ['username', 'dept_name'] },
    })
    expect(filtered.body).toBe(`﻿用户名,部门\r\n${P}m_b,B\r\n`)
    const selected = await s.inject({
      method: 'POST',
      url: '/api/admin/users/export',
      payload: { ids: [member.m_a, member.m_b], fields: ['username'] },
    })
    expect(selected.body).toBe(`﻿用户名\r\n${P}m_b\r\n`)
  })

  it('按部门筛选包含下级部门；超级管理员不受数据权限限制', async () => {
    const s = await superAdminSession(app, handle)
    const res = await s.inject({ url: `/api/admin/users?search=${P}m_&dept_id=${dept.A}` })
    expect((res.json().items as { username: string }[]).map((u) => u.username).sort()).toEqual([
      `${P}m_a`,
      `${P}m_a1`,
      `${P}m_a2`,
    ])
    const all = await s.inject({ url: `/api/admin/users?search=${P}m_` })
    expect(all.json().total).toBe(4)
  })
})
