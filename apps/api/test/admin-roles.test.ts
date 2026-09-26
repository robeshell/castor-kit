import ExcelJS from 'exceljs'
import { eq, inArray, like } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DbHandle } from '@/db/client'
import { departments, menus, role_menus, roles } from '@/db/schema'
import {
  buildTestApp,
  cleanupFixture,
  createFixture,
  FIXTURE_PASSWORD,
  FIXTURE_USER,
  loginSession,
  multipartFile,
  openTestDb,
  superAdminSession,
  type AuthedSession,
} from './helpers'

const P = 'ck_test_r1_role_'
let app: FastifyInstance
let handle: DbHandle
let s: AuthedSession
let u: AuthedSession
let menuA: number
let menuB: number
let menuC: number

async function cleanup() {
  await handle.db.delete(roles).where(like(roles.code, `${P}%`))
  await handle.db.delete(menus).where(like(menus.code, `${P}%`))
}

async function roleByCode(code: string) {
  const [row] = await handle.db.select().from(roles).where(eq(roles.code, code))
  return row!
}

async function menuIdsOf(roleId: number) {
  const rows = await handle.db.select().from(role_menus).where(eq(role_menus.role_id, roleId))
  return rows.map((r) => r.menu_id).sort((a, b) => a - b)
}

beforeAll(async () => {
  handle = openTestDb()
  app = await buildTestApp()
  // createFixture cleans up all ck_test_-prefixed data, so it must run before this file creates its own data
  const fx = await createFixture(handle)
  u = await loginSession(app, FIXTURE_USER, FIXTURE_PASSWORD, fx.userId)
  s = await superAdminSession(app, handle)
  await cleanup()
  const ins = async (code: string, sort: number) =>
    (await handle.db.insert(menus).values({ name: `菜单${code}`, code: `${P}${code}`, sort_order: sort }).returning())[0]!.id
  menuA = await ins('ma', 30)
  menuB = await ins('mb', 10)
  menuC = await ins('mc', 10)
})

afterAll(async () => {
  await cleanup()
  await cleanupFixture(handle)
  await app.close()
  await handle.pool.end()
})

describe('roles 列表 / 新增', () => {
  it('列表：数组形状，含 menu_ids/menus 且按 (sort_order, id) 排序', async () => {
    const res = await s.inject({ url: '/api/admin/roles' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(Array.isArray(body)).toBe(true)
    const superRole = body.find((r: { code: string }) => r.code === 'super_admin')
    expect(Object.keys(superRole).sort()).toEqual([
      'code', 'created_at', 'data_scope', 'dept_ids', 'description', 'id', 'menu_ids', 'menus', 'name',
    ])
    expect(Object.keys(superRole.menus[0]).sort()).toEqual(['code', 'id', 'menu_type', 'name', 'parent_id'])
    expect(superRole.created_at).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d{6})?$/)
  })

  it('新增 → 201，menu_ids 可以是 dict（取键）/数字字符串，无效 id 忽略', async () => {
    const res = await s.inject({
      method: 'POST',
      url: '/api/admin/roles',
      payload: { name: '测试角色', code: `${P}a`, description: 5, menu_ids: [menuA, String(menuB), ` ${menuC} `, 99999999999, 1.5, null] },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body).toMatchObject({ name: '测试角色', code: `${P}a`, description: '5' })
    // (sort_order, id): B(10) < C(10, larger id) < A(30)
    expect(body.menu_ids).toEqual([menuB, menuC, menuA])

    const dict = await s.inject({ method: 'POST', url: '/api/admin/roles', payload: { name: ['x', 'y z'], code: `${P}b`, menu_ids: { [menuA]: true } } })
    expect(dict.statusCode).toBe(201)
    expect(dict.json()).toMatchObject({ name: '{x,"y z"}', menu_ids: [menuA], description: null })

    const noMenus = await s.inject({ method: 'POST', url: '/api/admin/roles', payload: { name: 'n', code: `${P}c` } })
    expect(noMenus.json()).toMatchObject({ menu_ids: [], menus: [] })
  })

  it('新增校验：缺名称 / 缺编码 / 编码重复 / 非法类型 → 500', async () => {
    const post = (payload: unknown) => s.inject({ method: 'POST', url: '/api/admin/roles', payload: payload as object })
    expect((await post({ code: 'x' })).json()).toEqual({ error: '角色名称不能为空' })
    expect((await post({ name: 'x', code: 0 })).json()).toEqual({ error: '角色编码不能为空' })
    expect((await post({})).json()).toEqual({ error: '角色名称不能为空' })
    const dup = await post({ name: 'x', code: `${P}a` })
    expect(dup.statusCode).toBe(400)
    expect(dup.json()).toEqual({ error: '角色编码已存在' })

    const internal = { error: '服务器内部错误，请稍后重试' }
    for (const payload of [
      { name: 'x', code: 5 },
      { name: 'x', code: `${P}z`, menu_ids: 5 },
      { name: 'x', code: `${P}z`, menu_ids: 'abc' },
      { name: 'x', code: `${P}z`, menu_ids: ['abc'] },
      { name: 'x', code: `${P}z`, menu_ids: [true] },
      { name: 'x', code: `${P}z`, menu_ids: [[1]] },
      { name: 'x', code: `${P}z`, description: { a: 1 } },
    ]) {
      const res = await post(payload)
      expect(res.statusCode, JSON.stringify(payload)).toBe(500)
      expect(res.json()).toEqual(internal)
    }
    expect(await handle.db.select().from(roles).where(eq(roles.code, `${P}z`))).toHaveLength(0)
  })

  it('请求体不是对象：真值 → 500，假值当作 {}', async () => {
    const json = { 'content-type': 'application/json' }
    const post = (payload: unknown) => s.inject({ method: 'POST', url: '/api/admin/roles', payload: JSON.stringify(payload), headers: json })
    expect((await post([1, 2])).statusCode).toBe(500)
    expect((await post('abc')).statusCode).toBe(500)
    expect((await post([])).json()).toEqual({ error: '角色名称不能为空' })
    expect((await post(0)).json()).toEqual({ error: '角色名称不能为空' })
    const role = await roleByCode(`${P}a`)
    // update_role only uses `'key' in data`: a list always yields False → returned unchanged
    const put = (payload: unknown) =>
      s.inject({ method: 'PUT', url: `/api/admin/roles/${role.id}`, payload: JSON.stringify(payload), headers: json })
    expect((await put([1])).json()).toMatchObject({ id: role.id, code: `${P}a` })
    expect((await put('xyz')).json()).toMatchObject({ id: role.id })
    expect((await put('has name')).statusCode).toBe(500)
    expect((await put(5)).statusCode).toBe(500)
  })
})

describe('roles 编辑 / 删除', () => {
  it('编辑：改名、清空描述、替换菜单；未出现的字段不变', async () => {
    const role = await roleByCode(`${P}a`)
    const res = await s.inject({ method: 'PUT', url: `/api/admin/roles/${role.id}`, payload: { name: '改名', description: null, menu_ids: [menuC] } })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ id: role.id, name: '改名', code: `${P}a`, description: null, menu_ids: [menuC] })
    expect(await menuIdsOf(role.id)).toEqual([menuC])

    const keep = await s.inject({ method: 'PUT', url: `/api/admin/roles/${role.id}`, payload: {} })
    expect(keep.json()).toMatchObject({ name: '改名', menu_ids: [menuC] })
    const clear = await s.inject({ method: 'PUT', url: `/api/admin/roles/${role.id}`, payload: { menu_ids: null } })
    expect(clear.json().menu_ids).toEqual([])
  })

  it('编辑失败整体回滚：编码冲突 / name=null → 500', async () => {
    const role = await roleByCode(`${P}a`)
    await s.inject({ method: 'PUT', url: `/api/admin/roles/${role.id}`, payload: { menu_ids: [menuA] } })
    const conflict = await s.inject({ method: 'PUT', url: `/api/admin/roles/${role.id}`, payload: { code: `${P}b`, menu_ids: [menuB] } })
    expect(conflict.statusCode).toBe(500)
    expect(conflict.json()).toEqual({ error: '服务器内部错误，请稍后重试' })
    const nullName = await s.inject({ method: 'PUT', url: `/api/admin/roles/${role.id}`, payload: { name: null } })
    expect(nullName.statusCode).toBe(500)
    expect((await roleByCode(`${P}a`)).name).toBe('改名')
    expect(await menuIdsOf(role.id)).toEqual([menuA])
  })

  it('404 先于权限；非数字 id → 405', async () => {
    expect((await s.inject({ method: 'PUT', url: '/api/admin/roles/99999999', payload: {} })).json()).toEqual({ error: '资源不存在' })
    expect((await u.inject({ method: 'PUT', url: '/api/admin/roles/99999999', payload: {} })).statusCode).toBe(404)
    expect((await u.inject({ method: 'DELETE', url: '/api/admin/roles/99999999' })).statusCode).toBe(404)
    expect((await s.inject({ method: 'PUT', url: '/api/admin/roles/abc', payload: {} })).statusCode).toBe(405)
    expect((await s.inject({ url: '/api/admin/roles/1' })).statusCode).toBe(404)
  })

  it('删除：级联删除 role_menus', async () => {
    const role = await roleByCode(`${P}b`)
    expect(await menuIdsOf(role.id)).toEqual([menuA])
    const res = await s.inject({ method: 'DELETE', url: `/api/admin/roles/${role.id}` })
    expect(res.json()).toEqual({ message: '删除成功' })
    expect(await menuIdsOf(role.id)).toEqual([])
    expect(await handle.db.select().from(roles).where(eq(roles.id, role.id))).toHaveLength(0)
  })
})

describe('roles 导出 / 模板 / 导入', () => {
  it('导出：未勾选 400；ids 非 list 400；选中 csv 精确字节', async () => {
    expect((await s.inject({ method: 'POST', url: '/api/admin/roles/export', payload: {} })).json()).toEqual({ error: '请先勾选要导出的角色数据' })
    expect((await s.inject({ method: 'POST', url: '/api/admin/roles/export', payload: { ids: { a: 1 } } })).statusCode).toBe(400)

    const role = await roleByCode(`${P}a`)
    const res = await s.inject({
      method: 'POST',
      url: '/api/admin/roles/export',
      payload: { ids: [role.id, 99999999], fields: ['code', 'name', 'description', 'menu_codes', 'bogus'] },
    })
    expect(res.headers['content-disposition']).toBe('attachment; filename=roles_export.csv')
    expect(res.headers['content-type']).toBe('text/csv; charset=utf-8')
    expect(res.body).toBe(`\ufeff角色编码,角色名称,描述,菜单编码\r\n${P}a,改名,,${P}ma\r\n`)
  })

  it('导出 filtered：search 匹配名称或编码；fields 为字符串时按字符迭代 → 全部字段', async () => {
    const res = await s.inject({
      method: 'POST',
      url: '/api/admin/roles/export',
      payload: { export_mode: 'filtered', filters: { search: `${P}C` }, fields: 'code', file_type: 'xlsx' },
    })
    expect(res.headers['content-disposition']).toBe('attachment; filename=roles_export.xlsx')
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(res.rawPayload as unknown as ArrayBuffer)
    const rows: unknown[][] = []
    wb.worksheets[0]!.eachRow((row) => rows.push((row.values as unknown[]).slice(1)))
    expect(rows[0]).toEqual(['ID', '角色名称', '角色编码', '描述', '数据范围', '菜单编码', '菜单名称', '创建时间'])
    expect(rows).toHaveLength(2)
    expect(rows[1]![2]).toBe(`${P}c`)
    expect(rows[1]![4]).toBe('全部数据')
    expect(String(rows[1]![7])).toMatch(/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/)
  })

  it('导出：非法参数 → 500', async () => {
    for (const payload of [{ export_mode: 1 }, { export_mode: 'filtered', filters: [1] }, { ids: [1], fields: 5 }, { ids: [1], fields: [[1]] }, { ids: ['x'] }]) {
      expect((await s.inject({ method: 'POST', url: '/api/admin/roles/export', payload })).statusCode, JSON.stringify(payload)).toBe(500)
    }
  })

  it('模板 csv 精确字节 / xlsx', async () => {
    const csv = await s.inject({ url: '/api/admin/roles/template?file_type=xls' })
    expect(csv.headers['content-disposition']).toBe('attachment; filename=roles_import_template.csv')
    expect(csv.body).toBe('\ufeff角色名称,角色编码,描述,菜单编码\r\n示例角色,demo_role,示例描述,"dashboard,system_users"\r\n')
    const xlsx = await s.inject({ url: '/api/admin/roles/template?file_type=xlsx' })
    expect(xlsx.headers['content-disposition']).toBe('attachment; filename=roles_import_template.xlsx')
    expect(xlsx.rawPayload.subarray(0, 2).toString()).toBe('PK')
  })

  it('导入：有错误整体回滚；成功时新增/更新（菜单编码为空则保留原菜单）', async () => {
    const bad = multipartFile(
      'r.csv',
      `角色名称,角色编码,描述,菜单编码\n新角色,${P}imp1,,${P}ma\n,${P}x,,\n坏,${P}imp2,,"${P}ma，nope_menu,nope2"\n`,
    )
    const badRes = await s.inject({ method: 'POST', url: '/api/admin/roles/import', ...bad })
    expect(badRes.statusCode).toBe(400)
    expect(badRes.json()).toEqual({
      error: '导入失败，存在错误数据',
      error_count: 2,
      error_rows: [
        { line: 3, reason: '角色名称和编码不能为空', row: { 角色名称: '', 角色编码: `${P}x`, 描述: '', 菜单编码: '' } },
        { line: 4, reason: '菜单编码不存在: nope_menu, nope2', row: { 角色名称: '坏', 角色编码: `${P}imp2`, 描述: '', 菜单编码: `${P}ma，nope_menu,nope2` } },
      ],
    })
    expect(await handle.db.select().from(roles).where(eq(roles.code, `${P}imp1`))).toHaveLength(0)

    const roleA = await roleByCode(`${P}a`)
    const good = multipartFile(
      'r.csv',
      `角色名称,角色编码,描述,菜单编码\n新角色,${P}imp1,描述,"${P}ma, ${P}mb"\n新角色2,${P}imp1,,\n再改,${P}a,,\n`,
    )
    const ok = await s.inject({ method: 'POST', url: '/api/admin/roles/import', ...good })
    expect(ok.json()).toEqual({ message: '导入成功', created: 1, updated: 2 })
    const imp1 = await roleByCode(`${P}imp1`)
    expect(imp1).toMatchObject({ name: '新角色2', description: null })
    expect(await menuIdsOf(imp1.id)).toEqual([menuA, menuB].sort((a, b) => a - b))
    expect((await roleByCode(`${P}a`)).name).toBe('再改')
    expect(await menuIdsOf(roleA.id)).toEqual([menuA])
  })

  it('导入：缺列 / 空文件 / 无文件 / xls', async () => {
    const noCode = multipartFile('r.csv', '角色名称,描述\nx,y\n')
    expect((await s.inject({ method: 'POST', url: '/api/admin/roles/import', ...noCode })).json()).toEqual({ error: '导入文件缺少“角色名称/角色编码”列' })
    const empty = multipartFile('r.csv', '')
    expect((await s.inject({ method: 'POST', url: '/api/admin/roles/import', ...empty })).json()).toEqual({ error: '导入文件内容为空' })
    expect((await s.inject({ method: 'POST', url: '/api/admin/roles/import' })).json()).toEqual({ error: '请上传导入文件' })
    const xls = multipartFile('r.xls', 'x')
    expect((await s.inject({ method: 'POST', url: '/api/admin/roles/import', ...xls })).json()).toEqual({ error: '不支持 .xls 格式，请另存为 .xlsx 后重新上传' })
  })
})

describe('roles 数据范围', () => {
  it('自定义部门：保存 dept_ids；切到其他范围时清空；取值 / 部门校验', async () => {
    const [dept] = await handle.db.insert(departments).values({ name: 'r1 部门', code: `${P}dept` }).returning()
    const created = await s.inject({
      method: 'POST',
      url: '/api/admin/roles',
      payload: { name: 'scoped', code: `${P}scoped`, data_scope: 'custom', dept_ids: [dept!.id] },
    })
    expect(created.statusCode).toBe(201)
    expect(created.json()).toMatchObject({ data_scope: 'custom', dept_ids: [dept!.id] })
    const listed = (await s.inject({ url: '/api/admin/roles' })).json().find((r: { code: string }) => r.code === `${P}scoped`)
    expect(listed).toMatchObject({ data_scope: 'custom', dept_ids: [dept!.id] })

    const id = created.json().id
    const toDept = await s.inject({ method: 'PUT', url: `/api/admin/roles/${id}`, payload: { data_scope: 'dept' } })
    expect(toDept.json()).toMatchObject({ data_scope: 'dept', dept_ids: [] })

    const put = (payload: Record<string, unknown>) => s.inject({ method: 'PUT', url: `/api/admin/roles/${id}`, payload })
    expect((await put({ data_scope: 'everything' })).json()).toEqual({ error: '数据范围取值不合法' })
    expect((await put({ data_scope: 'custom', dept_ids: [99999999] })).json()).toEqual({ error: '部门不存在' })
    expect((await put({ data_scope: 'custom', dept_ids: 'x' })).json()).toEqual({ error: '部门不存在' })
    // Default for new roles stays 'all'
    const plain = await s.inject({ method: 'POST', url: '/api/admin/roles', payload: { name: 'plain', code: `${P}plain` } })
    expect(plain.json()).toMatchObject({ data_scope: 'all', dept_ids: [] })

    await handle.db.delete(roles).where(inArray(roles.code, [`${P}scoped`, `${P}plain`]))
    await handle.db.delete(departments).where(eq(departments.id, dept!.id))
  })
})

describe('roles 权限', () => {
  it('无权限用户 → 403 文案', async () => {
    const role = await roleByCode(`${P}a`)
    const cases: [string, string, string][] = [
      ['GET', '/api/admin/roles', '无权限查看角色列表'],
      ['POST', '/api/admin/roles', '无权限新增角色'],
      ['PUT', `/api/admin/roles/${role.id}`, '无权限编辑角色'],
      ['DELETE', `/api/admin/roles/${role.id}`, '无权限删除角色'],
      ['POST', '/api/admin/roles/export', '无权限导出角色'],
      ['GET', '/api/admin/roles/template', '无权限下载角色导入模板'],
      ['POST', '/api/admin/roles/import', '无权限导入角色'],
    ]
    for (const [method, url, error] of cases) {
      const res = await u.inject({ method: method as 'GET', url, ...(method === 'GET' || method === 'DELETE' ? {} : { payload: {} }) })
      expect(res.statusCode, url).toBe(403)
      expect(res.json()).toEqual({ error })
    }
    expect(await handle.db.select().from(roles).where(inArray(roles.id, [role.id]))).toHaveLength(1)
  })
})
