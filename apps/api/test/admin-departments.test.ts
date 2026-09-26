import { eq, like } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DbHandle } from '@/db/client'
import { admin_users, departments } from '@/db/schema'
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

const P = 'ck_test_d_'
const BASE = '/api/admin/departments'
let app: FastifyInstance
let handle: DbHandle
let s: AuthedSession

type Node = { id: number; code: string; name: string; user_count: number; leader_name: string | null; children: Node[] }
const find = (nodes: Node[], code: string): Node | undefined => {
  for (const n of nodes) {
    if (n.code === code) return n
    const hit = find(n.children, code)
    if (hit) return hit
  }
  return undefined
}

async function cleanup() {
  // Children first: the parent FK is ON DELETE RESTRICT
  for (let i = 0; i < 5; i += 1) {
    const rows = await handle.db.select().from(departments).where(like(departments.code, `${P}%`))
    if (rows.length === 0) return
    const parents = new Set(rows.map((r) => r.parent_id))
    for (const r of rows.filter((r) => !parents.has(r.id))) await handle.db.delete(departments).where(eq(departments.id, r.id))
  }
}

beforeAll(async () => {
  handle = openTestDb()
  app = await buildTestApp()
  await cleanup()
  s = await superAdminSession(app, handle)
})

afterAll(async () => {
  await handle.db.update(admin_users).set({ dept_id: null }).where(like(admin_users.username, 'ck_test_%'))
  await cleanup()
  await cleanupFixture(handle)
  await app.close()
  await handle.pool.end()
})

const post = (payload: Record<string, unknown>) => s.inject({ method: 'POST', url: BASE, payload })

describe('departments', () => {
  it('新增：必填、编码唯一、上级 / 负责人必须存在', async () => {
    const root = await post({ name: '总部', code: `${P}root`, leader_id: s.userId })
    expect(root.statusCode).toBe(201)
    expect(root.json()).toMatchObject({ name: '总部', code: `${P}root`, parent_id: null, leader_id: s.userId, sort_order: 0, status: 'active' })

    expect((await post({ code: `${P}x` })).json()).toEqual({ error: '部门名称不能为空' })
    expect((await post({ name: 'x' })).json()).toEqual({ error: '部门编码不能为空' })
    expect((await post({ name: 'x', code: `${P}root` })).json()).toEqual({ error: '部门编码已存在' })
    expect((await post({ name: 'x', code: `${P}x`, parent_id: 99999999 })).json()).toEqual({ error: '上级部门不存在' })
    expect((await post({ name: 'x', code: `${P}x`, parent_id: 'abc' })).json()).toEqual({ error: '上级部门不存在' })
    expect((await post({ name: 'x', code: `${P}x`, leader_id: 99999999 })).json()).toEqual({ error: '负责人不存在' })
    expect((await post({ name: 'x', code: `${P}x`, sort_order: -1 })).json()).toEqual({ error: '排序必须是非负整数' })
    expect((await post({ name: 'x', code: `${P}x`, status: 'paused' })).json()).toEqual({ error: '状态取值不合法' })
  })

  it('树：子部门挂在父级下，带负责人与人数；搜索保留祖先', async () => {
    const [root] = await handle.db.select().from(departments).where(eq(departments.code, `${P}root`))
    const a = (await post({ name: '研发部', code: `${P}rd`, parent_id: root!.id, sort_order: 10 })).json()
    await post({ name: '前端组', code: `${P}fe`, parent_id: a.id })
    await post({ name: '市场部', code: `${P}mkt`, parent_id: root!.id, sort_order: 20, status: 'disabled' })
    await handle.db.update(admin_users).set({ dept_id: a.id }).where(eq(admin_users.id, s.userId))

    const tree = (await s.inject({ url: BASE })).json() as Node[]
    const rootNode = find(tree, `${P}root`)!
    expect(rootNode.leader_name).toBe('ck_test_super')
    expect(rootNode.children.map((c) => c.code)).toEqual([`${P}rd`, `${P}mkt`])
    expect(find(tree, `${P}rd`)!.user_count).toBe(1)
    expect(find(tree, `${P}rd`)!.children.map((c) => c.code)).toEqual([`${P}fe`])

    const searched = (await s.inject({ url: `${BASE}?search=前端组` })).json() as Node[]
    expect(find(searched, `${P}root`)!.children.map((c) => c.code)).toEqual([`${P}rd`])
    const disabledOnly = (await s.inject({ url: `${BASE}?status=disabled` })).json() as Node[]
    expect(find(disabledOnly, `${P}root`)!.children.map((c) => c.code)).toEqual([`${P}mkt`])
  })

  it('编辑：不能把上级改成自身或下级；详情；404', async () => {
    const [root] = await handle.db.select().from(departments).where(eq(departments.code, `${P}root`))
    const [fe] = await handle.db.select().from(departments).where(eq(departments.code, `${P}fe`))
    const self = await s.inject({ method: 'PUT', url: `${BASE}/${root!.id}`, payload: { parent_id: root!.id } })
    expect(self.json()).toEqual({ error: '上级部门不能是自身或其下级部门' })
    const cycle = await s.inject({ method: 'PUT', url: `${BASE}/${root!.id}`, payload: { parent_id: fe!.id } })
    expect(cycle.json()).toEqual({ error: '上级部门不能是自身或其下级部门' })

    const ok = await s.inject({ method: 'PUT', url: `${BASE}/${fe!.id}`, payload: { name: '前端组（新）', leader_id: null } })
    expect(ok.json()).toMatchObject({ name: '前端组（新）', code: `${P}fe` })
    expect((await s.inject({ url: `${BASE}/${fe!.id}` })).json().name).toBe('前端组（新）')
    expect((await s.inject({ url: `${BASE}/99999999` })).statusCode).toBe(404)
  })

  it('排序：同级上下移动', async () => {
    const [mkt] = await handle.db.select().from(departments).where(eq(departments.code, `${P}mkt`))
    const up = await s.inject({ method: 'POST', url: `${BASE}/${mkt!.id}/sort`, payload: { direction: 'up' } })
    expect(up.json()).toEqual({ message: '排序成功', changed: true })
    const tree = (await s.inject({ url: BASE })).json() as Node[]
    expect(find(tree, `${P}root`)!.children.map((c) => c.code)).toEqual([`${P}mkt`, `${P}rd`])
    const again = await s.inject({ method: 'POST', url: `${BASE}/${mkt!.id}/sort`, payload: { direction: 'up' } })
    expect(again.json().changed).toBe(false)
    const bad = await s.inject({ method: 'POST', url: `${BASE}/${mkt!.id}/sort`, payload: { direction: 'left' } })
    expect(bad.json()).toEqual({ error: 'direction 参数必须是 up 或 down' })
  })

  it('删除：有下级或有用户时拒绝；否则删除', async () => {
    const [root] = await handle.db.select().from(departments).where(eq(departments.code, `${P}root`))
    const [rd] = await handle.db.select().from(departments).where(eq(departments.code, `${P}rd`))
    const [fe] = await handle.db.select().from(departments).where(eq(departments.code, `${P}fe`))
    expect((await s.inject({ method: 'DELETE', url: `${BASE}/${root!.id}` })).json()).toEqual({ error: '存在下级部门，不能删除' })
    await s.inject({ method: 'DELETE', url: `${BASE}/${fe!.id}` })
    expect((await s.inject({ method: 'DELETE', url: `${BASE}/${rd!.id}` })).json()).toEqual({ error: '部门下还有用户，不能删除' })
    await handle.db.update(admin_users).set({ dept_id: null }).where(eq(admin_users.id, s.userId))
    expect((await s.inject({ method: 'DELETE', url: `${BASE}/${rd!.id}` })).json()).toEqual({ message: '删除成功' })
  })

  it('权限：没有部门 / 用户 / 角色菜单权限 → 403', async () => {
    const fx = await createFixture(handle)
    const u = await loginSession(app, FIXTURE_USER, FIXTURE_PASSWORD, fx.userId)
    expect((await u.inject({ url: BASE })).json()).toEqual({ error: '无权限查看部门' })
    expect((await u.inject({ method: 'POST', url: BASE, payload: { name: 'x', code: `${P}y` } })).json()).toEqual({
      error: '无权限新增部门',
    })
  })
})
