import { eq, like } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { checkPasswordHash } from '@/common/password'
import type { DbHandle } from '@/db/client'
import { admin_users } from '@/db/schema'
import { buildTestApp, cleanupFixture, multipartFile, openTestDb, superAdminSession, type AuthedSession } from './helpers'

const P = 'ck_test_u_'
let app: FastifyInstance
let handle: DbHandle
let s: AuthedSession

beforeAll(async () => {
  handle = openTestDb()
  app = await buildTestApp()
  s = await superAdminSession(app, handle)
})

afterAll(async () => {
  await handle.db.delete(admin_users).where(like(admin_users.username, `${P}%`))
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
