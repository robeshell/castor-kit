import { and, eq, inArray, like, ne } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { checkPasswordHash } from '@/common/password'
import type { DbHandle } from '@/db/client'
import { admin_users, login_logs, menus, role_menus, roles, user_roles } from '@/db/schema'
import {
  buildTestApp,
  cleanupFixture,
  loginSession,
  multipartFile,
  openTestDb,
  sessionCookie,
  superAdminSession,
  type AuthedSession,
} from './helpers'

const P = 'ck_test_u_'
let app: FastifyInstance
let handle: DbHandle
let s: AuthedSession

beforeAll(async () => {
  handle = openTestDb()
  app = await buildTestApp()
  s = await superAdminSession(app, handle)
})

/** Menu ids this file inserted because the test DB lacked them (removed in afterAll) */
const createdMenuIds: number[] = []

afterAll(async () => {
  await handle.db.delete(admin_users).where(like(admin_users.username, `${P}%`))
  if (createdMenuIds.length > 0) await handle.db.delete(menus).where(inArray(menus.id, createdMenuIds))
  await cleanupFixture(handle)
  await app.close()
  await handle.pool.end()
})

describe('users', () => {
  it('列表：分页形状、search、per_page 钳制', async () => {
    const res = await s.inject({ url: '/api/admin/users?search=ck_test_super&per_page=999' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(Object.keys(body).sort()).toEqual(['items', 'page', 'per_page', 'total'])
    expect(body.per_page).toBe(200)
    expect(body.total).toBe(1)
    expect(body.items[0].username).toBe('ck_test_super')
    expect(body.items[0].roles[0].code).toBe('super_admin')
  })

  it('新增 → 201；重名 400；缺字段 400；无效角色 400', async () => {
    const [role] = (await s.inject({ url: '/api/admin/users?search=ck_test_super' })).json().items[0].roles
    const created = await s.inject({
      method: 'POST',
      url: '/api/admin/users',
      payload: { username: `${P}a`, password: '123456', role_ids: [role.id] },
    })
    expect(created.statusCode).toBe(201)
    expect(created.json()).toMatchObject({ username: `${P}a`, roles: [{ code: 'super_admin' }] })

    const dup = await s.inject({ method: 'POST', url: '/api/admin/users', payload: { username: `${P}a`, password: 'x' } })
    expect(dup.json()).toEqual({ error: '用户名已存在' })
    const missing = await s.inject({ method: 'POST', url: '/api/admin/users', payload: { username: `${P}b` } })
    expect(missing.json()).toEqual({ error: '用户名和密码不能为空' })
    const badRole = await s.inject({
      method: 'POST',
      url: '/api/admin/users',
      payload: { username: `${P}c`, password: 'x', role_ids: [999999, '1'] },
    })
    expect(badRole.statusCode).toBe(400)
    expect(badRole.json()).toEqual({ error: "角色不存在: [999999, '1']" })
  })

  it('编辑：改密 + 清空角色；不存在 id → 404（先于权限检查）；非数字 id 不匹配带 id 的路由（405）', async () => {
    const [u] = await handle.db.select().from(admin_users).where(eq(admin_users.username, `${P}a`))
    const res = await s.inject({ method: 'PUT', url: `/api/admin/users/${u!.id}`, payload: { password: 'newpass', role_ids: [] } })
    expect(res.statusCode).toBe(200)
    expect(res.json().roles).toEqual([])
    const [after] = await handle.db.select().from(admin_users).where(eq(admin_users.id, u!.id))
    expect(await checkPasswordHash(after!.password_hash, 'newpass')).toBe(true)

    expect((await s.inject({ method: 'PUT', url: '/api/admin/users/99999999', payload: {} })).statusCode).toBe(404)
    expect((await s.inject({ method: 'PUT', url: '/api/admin/users/99999999999', payload: {} })).statusCode).toBe(404)
    expect((await s.inject({ method: 'PUT', url: '/api/admin/users/abc', payload: {} })).statusCode).toBe(405)
  })

  it('删除：不能删自己；正常删除', async () => {
    const self = await s.inject({ method: 'DELETE', url: `/api/admin/users/${s.userId}` })
    expect(self.json()).toEqual({ error: '不能删除当前登录账号' })
    const [u] = await handle.db.select().from(admin_users).where(eq(admin_users.username, `${P}a`))
    const del = await s.inject({ method: 'DELETE', url: `/api/admin/users/${u!.id}` })
    expect(del.json()).toEqual({ message: '删除成功' })
  })

  it('导出 csv：选中模式与筛选模式', async () => {
    const none = await s.inject({ method: 'POST', url: '/api/admin/users/export', payload: {} })
    expect(none.json()).toEqual({ error: '请先勾选要导出的用户数据' })
    const res = await s.inject({
      method: 'POST',
      url: '/api/admin/users/export',
      payload: { export_mode: 'filtered', filters: { search: 'ck_test_super' }, fields: ['username', 'role_codes', 'bogus'] },
    })
    expect(res.headers['content-disposition']).toBe('attachment; filename=users_export.csv')
    expect(res.body).toBe('﻿用户名,角色编码\r\nck_test_super,super_admin\r\n')
  })

  it('模板下载 xlsx', async () => {
    const res = await s.inject({ url: '/api/admin/users/template?file_type=xlsx' })
    expect(res.headers['content-disposition']).toBe('attachment; filename=users_import_template.xlsx')
    expect(res.rawPayload.subarray(0, 2).toString()).toBe('PK')
  })

  it('导入：有错误整体回滚并返回 error_rows；无错误则新增/更新', async () => {
    const bad = multipartFile('u.csv', `用户名,密码,角色编码\n${P}imp1,123456,\n${P}imp2,,\n,x,\n${P}imp3,1,nope_role\n`)
    const badRes = await s.inject({ method: 'POST', url: '/api/admin/users/import', ...bad })
    expect(badRes.statusCode).toBe(400)
    const body = badRes.json()
    expect(body.error).toBe('导入失败，存在错误数据')
    expect(body.error_count).toBe(3)
    expect(body.error_rows.map((r: { line: number; reason: string }) => [r.line, r.reason])).toEqual([
      [3, '新增用户必须提供密码'],
      [4, '用户名不能为空'],
      [5, '角色编码不存在: nope_role'],
    ])
    expect(await handle.db.select().from(admin_users).where(eq(admin_users.username, `${P}imp1`))).toHaveLength(0)

    const good = multipartFile('u.csv', `用户名,密码,角色编码\n${P}imp1,123456,super_admin\n${P}imp1,654321,\n`)
    const ok = await s.inject({ method: 'POST', url: '/api/admin/users/import', ...good })
    expect(ok.json()).toEqual({ message: '导入成功', created: 1, updated: 1 })

    const xls = multipartFile('u.xls', 'x')
    expect((await s.inject({ method: 'POST', url: '/api/admin/users/import', ...xls })).json()).toEqual({
      error: '不支持 .xls 格式，请另存为 .xlsx 后重新上传',
    })
    expect((await s.inject({ method: 'POST', url: '/api/admin/users/import' })).json()).toEqual({ error: '请上传导入文件' })
  })

  it('无权限用户 → 403 文案', async () => {
    const { createFixture, loginSession, FIXTURE_USER, FIXTURE_PASSWORD } = await import('./helpers')
    const fx = await createFixture(handle)
    const u = await loginSession(app, FIXTURE_USER, FIXTURE_PASSWORD, fx.userId)
    expect((await u.inject({ url: '/api/admin/users' })).json()).toEqual({ error: '无权限查看用户列表' })
    expect((await u.inject({ method: 'POST', url: '/api/admin/users/import' })).json()).toEqual({ error: '无权限导入用户' })
  })
})

// ---- Profile fields, status and self-service profile ----

async function menuIdsFor(codes: string[]): Promise<number[]> {
  const ids: number[] = []
  for (const code of codes) {
    const [found] = await handle.db.select().from(menus).where(eq(menus.code, code))
    if (found) {
      ids.push(found.id)
      continue
    }
    const [created] = await handle.db.insert(menus).values({ name: code, code, menu_type: 'button', is_visible: false }).returning()
    createdMenuIds.push(created!.id)
    ids.push(created!.id)
  }
  return ids
}

/** Creates a user with a role holding exactly `codes`, and signs in as them */
async function operatorSession(name: string, codes: string[]): Promise<AuthedSession> {
  const { generatePasswordHash } = await import('@/common/password')
  const [role] = await handle.db
    .insert(roles)
    .values({ name, code: `ck_test_role_${name}` })
    .returning()
  const menuIds = await menuIdsFor(codes)
  await handle.db.insert(role_menus).values(menuIds.map((menu_id) => ({ role_id: role!.id, menu_id })))
  const [user] = await handle.db
    .insert(admin_users)
    .values({ username: `${P}${name}`, password_hash: await generatePasswordHash('op-pass-1', 1000) })
    .returning()
  await handle.db.insert(user_roles).values({ user_id: user!.id, role_id: role!.id })
  return loginSession(app, `${P}${name}`, 'op-pass-1', user!.id)
}

async function createUser(username: string, extra: Record<string, unknown> = {}) {
  const res = await s.inject({ method: 'POST', url: '/api/admin/users', payload: { username, password: 'pass-123', ...extra } })
  expect(res.statusCode, res.body).toBe(201)
  return res.json() as { id: number } & Record<string, unknown>
}

describe('users: profile fields', () => {
  // The fixture test above removes every ck_test_* user, including the super admin behind `s`
  beforeAll(async () => {
    s = await superAdminSession(app, handle)
  })

  it('新增带资料：邮箱转小写、空值存 null；邮箱重复（忽略大小写）/ 格式错误 → 400', async () => {
    const u = await createUser(`${P}p1`, { nickname: ' 张三 ', email: 'Zhang.San@Example.com', phone: '', avatar: '/a.png' })
    expect(u).toMatchObject({
      nickname: '张三',
      email: 'zhang.san@example.com',
      phone: null,
      avatar: '/a.png',
      status: 'active',
      dept_id: null,
      last_login_at: null,
    })

    const post = (payload: Record<string, unknown>) => s.inject({ method: 'POST', url: '/api/admin/users', payload })
    expect((await post({ username: `${P}p2`, password: 'x', email: 'ZHANG.SAN@example.com' })).json()).toEqual({ error: '邮箱已被使用' })
    expect((await post({ username: `${P}p2`, password: 'x', email: 'not-an-email' })).json()).toEqual({ error: '邮箱格式不正确' })
    expect((await post({ username: `${P}p2`, password: 'x', phone: 'abc' })).json()).toEqual({ error: '手机号格式不正确' })
    expect((await post({ username: `${P}p2`, password: 'x', avatar: 'javascript:alert(1)' })).json()).toEqual({
      error: '头像地址需以 http(s):// 或 / 开头',
    })
    expect((await post({ username: `${P}p2`, password: 'x', nickname: 'n'.repeat(101) })).json()).toEqual({ error: '昵称不能超过 100 个字符' })
  })

  it('编辑：改资料、清空邮箱；body 里的 status 被忽略；搜索昵称 / 邮箱 + 状态筛选', async () => {
    const [u] = await handle.db.select().from(admin_users).where(eq(admin_users.username, `${P}p1`))
    const res = await s.inject({
      method: 'PUT',
      url: `/api/admin/users/${u!.id}`,
      payload: { nickname: '张三丰', email: '', phone: '+86 138-0000-0000', status: 'disabled' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ nickname: '张三丰', email: null, phone: '+86 138-0000-0000', avatar: '/a.png', status: 'active' })
    expect(res.json().updated_at).toMatch(/^\d{4}-\d{2}-\d{2}T/)

    const byNick = (await s.inject({ url: '/api/admin/users?search=张三丰' })).json()
    expect(byNick.items.map((i: { username: string }) => i.username)).toEqual([`${P}p1`])
    const disabled = (await s.inject({ url: '/api/admin/users?search=ck_test_u_p1&status=disabled' })).json()
    expect(disabled.total).toBe(0)
    const bogus = (await s.inject({ url: '/api/admin/users?search=ck_test_u_p1&status=bogus' })).json()
    expect(bogus.total).toBe(1)
  })

  it('个人资料：只改自己的昵称 / 邮箱 / 手机 / 头像；邮箱冲突 400；未登录 401', async () => {
    await createUser(`${P}p3`, { email: 'taken@example.com' })
    const res = await s.inject({
      method: 'PUT',
      url: '/api/admin/profile',
      payload: { nickname: '超管', avatar: 'https://example.com/a.png', username: 'hacked', status: 'disabled' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().message).toBe('资料已更新')
    expect(res.json().user).toMatchObject({ id: s.userId, username: 'ck_test_super', nickname: '超管', status: 'active' })
    expect((await s.inject({ url: '/api/admin/me' })).json().user.avatar).toBe('https://example.com/a.png')

    const clash = await s.inject({ method: 'PUT', url: '/api/admin/profile', payload: { email: 'TAKEN@example.com' } })
    expect([clash.statusCode, clash.json()]).toEqual([400, { error: '邮箱已被使用' }])
    const anon = await app.inject({ method: 'PUT', url: '/api/admin/profile', payload: {} })
    expect(anon.statusCode).toBe(401)
  })
})

describe('users: enable / disable', () => {
  it('停用：取值校验、不能停用自己、不存在 → 404、无权限 → 403', async () => {
    const u = await createUser(`${P}s1`)
    const put = (id: number, payload: unknown, session = s) =>
      session.inject({ method: 'PUT', url: `/api/admin/users/${id}/status`, payload: payload as Record<string, unknown> })
    expect((await put(u.id, { status: 'paused' })).json()).toEqual({ error: '状态取值不合法' })
    expect((await put(s.userId, { status: 'disabled' })).json()).toEqual({ error: '不能停用当前登录账号' })
    expect((await put(99999999, { status: 'disabled' })).statusCode).toBe(404)
    const ok = await put(u.id, { status: 'disabled' })
    expect([ok.statusCode, ok.json().status]).toEqual([200, 'disabled'])

    const viewer = await operatorSession('viewer', ['system_users', 'system_users_edit'])
    expect((await put(u.id, { status: 'active' }, viewer)).json()).toEqual({ error: '无权限启用或停用用户' })
  })

  it('停用账号：密码正确也不能登录（403，记失败日志）；已登录会话下一次请求 401 并清 cookie；启用后恢复，记录最后登录', async () => {
    const u = await createUser(`${P}s2`)
    const session = await loginSession(app, `${P}s2`, 'pass-123', u.id)
    const [afterLogin] = await handle.db.select().from(admin_users).where(eq(admin_users.id, u.id))
    expect(afterLogin!.last_login_at).not.toBeNull()
    expect(afterLogin!.last_login_ip).toBeTruthy()
    expect((await session.inject({ url: '/api/admin/me' })).statusCode).toBe(200)

    await s.inject({ method: 'PUT', url: `/api/admin/users/${u.id}/status`, payload: { status: 'disabled' } })

    const me = await session.inject({ url: '/api/admin/me' })
    expect([me.statusCode, me.json()]).toEqual([401, { error: '未授权访问', redirect: '/admin/login' }])
    expect(sessionCookie(me)).toBe('')
    const menusRes = await session.inject({ url: '/api/admin/my-menus' })
    expect(menusRes.statusCode).toBe(401)

    const wrong = await app.inject({ method: 'POST', url: '/api/admin/login', payload: { username: `${P}s2`, password: 'nope' } })
    expect(wrong.json()).toEqual({ error: '用户名或密码错误' })
    const blocked = await app.inject({ method: 'POST', url: '/api/admin/login', payload: { username: `${P}s2`, password: 'pass-123' } })
    expect([blocked.statusCode, blocked.json()]).toEqual([403, { error: '账号已停用，请联系管理员' }])
    const logs = await handle.db
      .select()
      .from(login_logs)
      .where(and(eq(login_logs.username, `${P}s2`), eq(login_logs.message, '账号已停用')))
    expect(logs).toHaveLength(1)

    await s.inject({ method: 'PUT', url: `/api/admin/users/${u.id}/status`, payload: { status: 'active' } })
    const again = await app.inject({ method: 'POST', url: '/api/admin/login', payload: { username: `${P}s2`, password: 'pass-123' } })
    expect(again.statusCode).toBe(200)
    expect(again.json().user.last_login_at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('非超级管理员不能编辑 / 停用 / 删除超级管理员账号，也不能授予超级管理员角色', async () => {
    const [superRole] = await handle.db.select().from(roles).where(eq(roles.code, 'super_admin'))
    const target = await createUser(`${P}s3`, { role_ids: [superRole!.id] })
    const plain = await createUser(`${P}s4`)
    const operator = await operatorSession('operator', ['system_users', 'system_users_add', 'system_users_edit', 'system_users_status', 'system_users_delete'])
    const denied = { error: '只有超级管理员可以操作超级管理员账号' }
    const edit = await operator.inject({ method: 'PUT', url: `/api/admin/users/${target.id}`, payload: { password: 'taken-over' } })
    expect([edit.statusCode, edit.json()]).toEqual([403, denied])
    expect((await operator.inject({ method: 'PUT', url: `/api/admin/users/${target.id}/status`, payload: { status: 'disabled' } })).json()).toEqual(denied)
    expect((await operator.inject({ method: 'DELETE', url: `/api/admin/users/${target.id}` })).json()).toEqual(denied)

    const grant = { error: '只有超级管理员可以分配超级管理员角色' }
    expect((await operator.inject({ method: 'PUT', url: `/api/admin/users/${plain.id}`, payload: { role_ids: [superRole!.id] } })).json()).toEqual(grant)
    expect((await operator.inject({ method: 'PUT', url: `/api/admin/users/${operator.userId}`, payload: { role_ids: [superRole!.id] } })).json()).toEqual(grant)
    const create = await operator.inject({ method: 'POST', url: '/api/admin/users', payload: { username: `${P}s5`, password: 'x-pass-1', role_ids: [superRole!.id] } })
    expect([create.statusCode, create.json()]).toEqual([403, grant])
    // Ordinary edits still work
    expect((await operator.inject({ method: 'PUT', url: `/api/admin/users/${plain.id}`, payload: { nickname: '普通' } })).json().nickname).toBe('普通')
  })

  it('超级管理员不能移除自己的超级管理员角色', async () => {
    const res = await s.inject({ method: 'PUT', url: `/api/admin/users/${s.userId}`, payload: { role_ids: [] } })
    expect([res.statusCode, res.json()]).toEqual([400, { error: '不能移除自己的超级管理员角色' }])
  })

  it('兜底：最后一个启用中的超级管理员不能被停用 / 删除 / 移除角色（直接调用 service）', async () => {
    const { UserService } = await import('@/modules/admin/users/service')
    const { UNRESTRICTED } = await import('@/common/data-scope')
    const service = new UserService(handle.db)
    const [superRole] = await handle.db.select().from(roles).where(eq(roles.code, 'super_admin'))
    const target = await createUser(`${P}s6`, { role_ids: [superRole!.id] })
    const others = await handle.db
      .select({ id: admin_users.id })
      .from(admin_users)
      .innerJoin(user_roles, eq(user_roles.user_id, admin_users.id))
      .where(and(eq(user_roles.role_id, superRole!.id), ne(admin_users.id, target.id), eq(admin_users.status, 'active')))
    const otherIds = others.map((o) => o.id)
    await handle.db.update(admin_users).set({ status: 'disabled' }).where(inArray(admin_users.id, otherIds))
    try {
      const user = await service.getUserOr404(target.id)
      const caller = { username: 'someone-else', superAdmin: true }
      await expect(service.setUserStatus(user, 'disabled', caller)).rejects.toThrow('不能停用最后一个超级管理员')
      await expect(service.deleteUser(user, caller)).rejects.toThrow('不能删除最后一个超级管理员')
      await expect(service.updateUser(user, { role_ids: [] }, UNRESTRICTED, caller)).rejects.toThrow(
        '不能移除最后一个超级管理员的超级管理员角色',
      )
    } finally {
      await handle.db.update(admin_users).set({ status: 'active' }).where(inArray(admin_users.id, otherIds))
    }
  })
})

describe('users: import / export with profile fields', () => {
  it('导出包含资料与状态列', async () => {
    const res = await s.inject({
      method: 'POST',
      url: '/api/admin/users/export',
      payload: {
        export_mode: 'filtered',
        filters: { search: `${P}s1`, status: 'disabled' },
        fields: ['username', 'nickname', 'email', 'status', 'last_login_at'],
      },
    })
    expect(res.body).toBe(`\ufeff用户名,昵称,邮箱,状态,最后登录时间\r\n${P}s1,,,停用,\r\n`)
  })

  it('导入：资料与状态列；非法状态 / 批内重复邮箱 / 停用自己记为错误行；空单元格不覆盖已有值', async () => {
    const bad = multipartFile(
      'u.csv',
      `用户名,密码,昵称,邮箱,手机,状态,角色编码\n` +
        `${P}i1,123456,甲,dup@example.com,,正常,\n` +
        `${P}i2,123456,乙,DUP@example.com,,,\n` +
        `${P}i3,123456,,,,暂停,\n` +
        `ck_test_super,,,,,停用,\n`,
    )
    const badRes = await s.inject({ method: 'POST', url: '/api/admin/users/import', ...bad })
    expect(badRes.json().error_rows.map((r: { line: number; reason: string }) => [r.line, r.reason])).toEqual([
      [3, '邮箱已被使用'],
      [4, '状态取值不合法（可填 正常 / 停用）'],
      [5, '不能停用当前登录账号'],
    ])
    expect(await handle.db.select().from(admin_users).where(eq(admin_users.username, `${P}i1`))).toHaveLength(0)

    const good = multipartFile(
      'u.csv',
      `用户名,密码,昵称,邮箱,手机,状态,角色编码\n${P}i1,123456,甲,i1@example.com,13800000000,停用,\n${P}i1,,,,,,\n`,
    )
    expect((await s.inject({ method: 'POST', url: '/api/admin/users/import', ...good })).json()).toEqual({
      message: '导入成功',
      created: 1,
      updated: 1,
    })
    const [row] = await handle.db.select().from(admin_users).where(eq(admin_users.username, `${P}i1`))
    expect(row).toMatchObject({ nickname: '甲', email: 'i1@example.com', phone: '13800000000', status: 'disabled' })
  })

  it('导入：没有启用 / 停用权限时，填了状态的行记为错误行', async () => {
    const editor = await operatorSession('editor', ['system_users', 'system_users_edit'])
    const file = multipartFile(
      'u.csv',
      `用户名,密码,状态,角色编码\n${P}i4,123456,正常,\n${P}i5,123456,,\n${P}i6,123456,,super_admin\nck_test_super,newpass,,\n`,
    )
    const res = await editor.inject({ method: 'POST', url: '/api/admin/users/import', ...file })
    expect(res.json().error_rows.map((r: { line: number; reason: string }) => [r.line, r.reason])).toEqual([
      [2, '无权限修改用户状态'],
      [4, '只有超级管理员可以分配超级管理员角色'],
      [5, '只有超级管理员可以操作超级管理员账号'],
    ])
  })
})
