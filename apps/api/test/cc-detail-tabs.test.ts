import { like } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DbHandle } from '@/db/client'
import { cc_detail_members } from '@/db/schema'
import {
  buildTestApp,
  cleanupFixture,
  createFixture,
  FIXTURE_PASSWORD,
  FIXTURE_USER,
  loginSession,
  openTestDb,
  superAdminSession,
  type AuthedSession,
} from './helpers'

const P = 'ck_test_r5_'
const B = '/api/admin/component-center/detail-tabs'
let app: FastifyInstance
let handle: DbHandle
let s: AuthedSession
let memberId: number

async function cleanup() {
  await handle.db.delete(cc_detail_members).where(like(cc_detail_members.name, `${P}%`))
}

beforeAll(async () => {
  handle = openTestDb()
  app = await buildTestApp()
  s = await superAdminSession(app, handle)
  await cleanup()
  // 克隆出来的测试库主键序列可能落后于 MAX(id)（该模块的 Python 实现没有序列自愈逻辑），先同步
  await handle.pool.query(
    "SELECT setval(pg_get_serial_sequence('cc_detail_members', 'id'), COALESCE((SELECT MAX(id) FROM cc_detail_members), 0) + 1, false)",
  )
})

afterAll(async () => {
  await cleanup()
  await cleanupFixture(handle)
  await app.close()
  await handle.pool.end()
})

describe('detail-tabs', () => {
  it('新建：201 + 归一化；缺姓名 400', async () => {
    const res = await s.inject({
      method: 'POST',
      url: `${B}/members`,
      payload: {
        name: ` ${P}甲 `,
        department: `${P}部门`,
        status: 'retired',
        join_date: '2023-07-08',
        avatar_color: '  ',
        sort_order: 9000,
        is_active: '0',
        email: '',
      },
    })
    expect(res.statusCode).toBe(201)
    const m = res.json()
    memberId = m.id
    expect(m).toMatchObject({
      name: `${P}甲`,
      department: `${P}部门`,
      role_title: null,
      email: null,
      status: 'active',
      join_date: '2023-07-08',
      avatar_color: '#4080FF',
      bio: null,
      sort_order: 9000,
      is_active: false,
    })
    expect(Object.keys(m).sort()).toEqual(
      ['avatar_color', 'bio', 'created_at', 'department', 'email', 'id', 'is_active', 'join_date', 'name', 'phone', 'role_title', 'sort_order', 'status', 'updated_at'].sort(),
    )
    await s.inject({ method: 'POST', url: `${B}/members`, payload: { name: `${P}乙`, role_title: `${P}角色`, sort_order: 9001, status: 'leave' } })

    const bad = await s.inject({ method: 'POST', url: `${B}/members`, payload: { name: '  ' } })
    expect(bad.statusCode).toBe(400)
    expect(bad.json()).toEqual({ error: '姓名不能为空' })
  })

  it('列表：search 覆盖姓名/部门/职位；空白 search 等于不筛选', async () => {
    const all = (await s.inject({ url: `${B}/members` })).json() as { sort_order: number }[]
    const orders = all.map((m) => m.sort_order)
    expect(orders).toEqual([...orders].sort((a, b) => a - b))
    const byDept = (await s.inject({ url: `${B}/members?search=${encodeURIComponent(`${P}部门`)}` })).json()
    expect(byDept.map((m: { name: string }) => m.name)).toEqual([`${P}甲`])
    const byRole = (await s.inject({ url: `${B}/members?search=${encodeURIComponent(`${P}角色`)}` })).json()
    expect(byRole.map((m: { name: string }) => m.name)).toEqual([`${P}乙`])
    const byName = (await s.inject({ url: `${B}/members?search=CK_TEST_R5_` })).json()
    expect(byName).toHaveLength(2)
    expect((await s.inject({ url: `${B}/members?search=%20` })).json()).toHaveLength(all.length)
  })

  it('详情 / 404 / 非数字 id', async () => {
    const res = await s.inject({ url: `${B}/members/${memberId}` })
    expect(res.json().name).toBe(`${P}甲`)
    expect((await s.inject({ url: `${B}/members/99999999` })).json()).toEqual({ error: '资源不存在' })
    expect((await s.inject({ url: `${B}/members/abc` })).statusCode).toBe(404)
    expect((await s.inject({ method: 'PUT', url: `${B}/members/abc`, payload: {} })).statusCode).toBe(405)
  })

  it('编辑：部分字段、枚举回落、日期清空；姓名清空 400', async () => {
    const res = await s.inject({
      method: 'PUT',
      url: `${B}/members/${memberId}`,
      payload: { status: 'probation', join_date: 'bad', bio: ' 简介 ', sort_order: 'x', is_active: 'YES' },
    })
    expect(res.json()).toMatchObject({ status: 'probation', join_date: null, bio: '简介', sort_order: 9000, is_active: true })
    const res2 = await s.inject({ method: 'PUT', url: `${B}/members/${memberId}`, payload: { status: null, avatar_color: '#000' } })
    expect(res2.json()).toMatchObject({ status: 'active', avatar_color: '#000' })
    const bad = await s.inject({ method: 'PUT', url: `${B}/members/${memberId}`, payload: { name: '' } })
    expect(bad.json()).toEqual({ error: '姓名不能为空' })
    expect((await s.inject({ method: 'PUT', url: `${B}/members/99999999`, payload: {} })).statusCode).toBe(404)
  })

  it('无权限 → 403；404 先于 403', async () => {
    const fx = await createFixture(handle)
    const u = await loginSession(app, FIXTURE_USER, FIXTURE_PASSWORD, fx.userId)
    expect((await u.inject({ url: `${B}/members` })).json()).toEqual({ error: '无权限' })
    expect((await u.inject({ method: 'POST', url: `${B}/members`, payload: {} })).json()).toEqual({ error: '无权限新建成员' })
    expect((await u.inject({ url: `${B}/members/${memberId}` })).json()).toEqual({ error: '无权限' })
    expect((await u.inject({ method: 'PUT', url: `${B}/members/${memberId}`, payload: {} })).json()).toEqual({ error: '无权限编辑成员' })
    const del = await u.inject({ method: 'DELETE', url: `${B}/members/${memberId}` })
    expect(del.statusCode).toBe(403)
    expect(del.json()).toEqual({ error: '无权限删除成员' })
    expect((await u.inject({ url: `${B}/members/99999999` })).statusCode).toBe(404)
  })

  it('删除', async () => {
    s = await superAdminSession(app, handle) // createFixture 会清掉 ck_test_ 前缀的用户（含 super 测试账号）
    expect((await s.inject({ method: 'DELETE', url: `${B}/members/${memberId}` })).json()).toEqual({ message: '删除成功' })
    expect((await s.inject({ url: `${B}/members/${memberId}` })).statusCode).toBe(404)
  })
})
