import ExcelJS from 'exceljs'
import { eq, inArray, like } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DbHandle } from '@/db/client'
import { dict_items, dict_types } from '@/db/schema'
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

const P = 'ck_test_r2_t_'
const INTERNAL = { error: '服务器内部错误，请稍后重试' }
let app: FastifyInstance
let handle: DbHandle
let s: AuthedSession
let u: AuthedSession

async function cleanup() {
  await handle.db.delete(dict_types).where(like(dict_types.code, `${P}%`))
}

async function itemsOf(typeId: number) {
  return handle.db.select().from(dict_items).where(eq(dict_items.dict_type_id, typeId)).orderBy(dict_items.id)
}

async function xlsxBuffer(rows: unknown[][]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Sheet')
  for (const row of rows) ws.addRow(row)
  return Buffer.from(await wb.xlsx.writeBuffer())
}

async function readXlsx(buf: Buffer): Promise<unknown[][]> {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buf as unknown as ArrayBuffer)
  const rows: unknown[][] = []
  wb.worksheets[0]!.eachRow((row) => rows.push((row.values as unknown[]).slice(1)))
  return rows
}

beforeAll(async () => {
  handle = openTestDb()
  app = await buildTestApp()
  await cleanup()
  // createFixture cleans up all ck_test_ users, so it must run before superAdminSession
  const fx = await createFixture(handle)
  u = await loginSession(app, FIXTURE_USER, FIXTURE_PASSWORD, fx.userId)
  s = await superAdminSession(app, handle)
})

afterAll(async () => {
  await cleanup()
  await cleanupFixture(handle)
  await app.close()
  await handle.pool.end()
})

describe('dicts：字典类型', () => {
  let typeId: number

  it('新增 → 201，None 值走默认值（sort_order=0, is_active=true），名称/编码去空白', async () => {
    const res = await s.inject({
      method: 'POST',
      url: '/api/admin/dicts',
      payload: { name: ' 测试字典 ', code: ` ${P}a `, sort_order: null, is_active: null, description: 5 },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    typeId = body.id
    expect(body).toMatchObject({
      name: '测试字典',
      code: `${P}a`,
      description: '5',
      sort_order: 0,
      is_active: true,
      item_count: 0,
    })
    expect(Object.keys(body).sort()).toEqual(
      ['code', 'created_at', 'description', 'id', 'is_active', 'item_count', 'name', 'sort_order', 'updated_at'].sort(),
    )
    expect(body.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{6})?$/)
  })

  it('新增校验：名称/编码为空、编码重复、非法布尔/整数 → 500 且不落库', async () => {
    const post = (payload: unknown) => s.inject({ method: 'POST', url: '/api/admin/dicts', payload: payload as object })
    expect((await post({ code: 'x' })).json()).toEqual({ error: '字典名称不能为空' })
    expect((await post({ name: 'x' })).json()).toEqual({ error: '字典编码不能为空' })
    expect((await post({ name: 'x', code: `${P}a` })).json()).toEqual({ error: '字典编码已存在' })
    for (const bad of [{ is_active: 'yes' }, { sort_order: 'abc' }, { sort_order: true }, { description: { a: 1 } }]) {
      const res = await post({ name: 'x', code: `${P}bad`, ...bad })
      expect(res.statusCode).toBe(500)
      expect(res.json()).toEqual(INTERNAL)
    }
    expect(await handle.db.select().from(dict_types).where(eq(dict_types.code, `${P}bad`))).toHaveLength(0)
  })

  it('列表：分页形状、search 同时匹配名称与编码、is_active 过滤、item_count', async () => {
    await s.inject({ method: 'POST', url: '/api/admin/dicts', payload: { name: '第二', code: `${P}b`, is_active: false, sort_order: 5 } })
    const res = await s.inject({ url: `/api/admin/dicts?search=${P}&per_page=999` })
    const body = res.json()
    expect(Object.keys(body).sort()).toEqual(['items', 'page', 'per_page', 'total'])
    expect(body.per_page).toBe(200)
    expect(body.items.map((i: { code: string }) => i.code)).toEqual([`${P}a`, `${P}b`])
    const inactive = (await s.inject({ url: `/api/admin/dicts?search=${P}&is_active=停用` })).json()
    expect(inactive.items.map((i: { code: string }) => i.code)).toEqual([`${P}b`])
    const byName = (await s.inject({ url: `/api/admin/dicts?search=${encodeURIComponent('第二')}` })).json()
    expect(byName.items.map((i: { code: string }) => i.code)).toContain(`${P}b`)
  })

  it('编辑：同值/空 body 不改 updated_at；原始值落库（不去空白）；编码重复 400；404 先于 403', async () => {
    const [before] = await handle.db.select().from(dict_types).where(eq(dict_types.id, typeId))
    const same = await s.inject({ method: 'PUT', url: `/api/admin/dicts/${typeId}`, payload: { name: '测试字典', sort_order: false, is_active: 1 } })
    expect(same.statusCode).toBe(200)
    const [after] = await handle.db.select().from(dict_types).where(eq(dict_types.id, typeId))
    expect(after!.updated_at).toBe(before!.updated_at)

    const changed = await s.inject({ method: 'PUT', url: `/api/admin/dicts/${typeId}`, payload: { name: ' 改名 ', sort_order: 3.5 } })
    expect(changed.json()).toMatchObject({ name: ' 改名 ', sort_order: 4 })
    const [after2] = await handle.db.select().from(dict_types).where(eq(dict_types.id, typeId))
    expect(after2!.updated_at).not.toBe(before!.updated_at)

    expect((await s.inject({ method: 'PUT', url: `/api/admin/dicts/${typeId}`, payload: { code: `${P}b` } })).json()).toEqual({
      error: '字典编码已存在',
    })
    expect((await s.inject({ method: 'PUT', url: `/api/admin/dicts/${typeId}`, payload: { name: '' } })).json()).toEqual({
      error: '字典名称不能为空',
    })
    expect((await s.inject({ method: 'PUT', url: '/api/admin/dicts/99999999', payload: {} })).statusCode).toBe(404)
    expect((await s.inject({ method: 'PUT', url: '/api/admin/dicts/abc', payload: {} })).statusCode).toBe(405)
  })
})

describe('dicts：字典项', () => {
  let typeId: number
  let otherTypeId: number
  let a: number
  let b: number

  beforeAll(async () => {
    const [t] = await handle.db.select().from(dict_types).where(eq(dict_types.code, `${P}a`))
    const [o] = await handle.db.select().from(dict_types).where(eq(dict_types.code, `${P}b`))
    typeId = t!.id
    otherTypeId = o!.id
  })

  it('新增：201 带 dict_type_code/name；默认项互斥；校验文案', async () => {
    const ra = await s.inject({
      method: 'POST',
      url: `/api/admin/dicts/${typeId}/items`,
      payload: { label: ' 甲 ', value: ' a ', is_default: true, color: 'red', sort_order: 2 },
    })
    expect(ra.statusCode).toBe(201)
    expect(ra.json()).toMatchObject({ label: '甲', value: 'a', is_default: true, is_active: true, dict_type_code: `${P}a` })
    a = ra.json().id
    const rb = await s.inject({
      method: 'POST',
      url: `/api/admin/dicts/${typeId}/items`,
      payload: { label: '乙', value: 'b', is_default: 1, sort_order: null, is_active: null },
    })
    expect(rb.json()).toMatchObject({ sort_order: 0, is_active: true, is_default: true })
    b = rb.json().id
    const rows = await itemsOf(typeId)
    expect(rows.find((r) => r.id === a)!.is_default).toBe(false)

    const post = (payload: object) => s.inject({ method: 'POST', url: `/api/admin/dicts/${typeId}/items`, payload })
    expect((await post({ value: 'x' })).json()).toEqual({ error: '字典标签不能为空' })
    expect((await post({ label: 'x' })).json()).toEqual({ error: '字典值不能为空' })
    expect((await post({ label: 'x', value: 'a' })).json()).toEqual({ error: '同一字典下字典值不能重复' })
    // is_default is an invalid boolean: clearing the default then failing the insert → the whole thing rolls back, b is still the default
    const bad = await post({ label: 'x', value: 'zz', is_default: 'yes' })
    expect(bad.statusCode).toBe(500)
    expect((await itemsOf(typeId)).find((r) => r.id === b)!.is_default).toBe(true)
  })

  it('列表：{items,total,dict_type}，search / is_active 过滤', async () => {
    const res = (await s.inject({ url: `/api/admin/dicts/${typeId}/items` })).json()
    expect(Object.keys(res).sort()).toEqual(['dict_type', 'items', 'total'])
    expect(res.items.map((i: { value: string }) => i.value)).toEqual(['b', 'a'])
    expect(res.dict_type.item_count).toBe(2)
    expect(res.items[0].dict_type_name).toBe(' 改名 ')
    expect((await s.inject({ url: `/api/admin/dicts/${typeId}/items?search=${encodeURIComponent('甲')}` })).json().total).toBe(1)
    expect((await s.inject({ url: `/api/admin/dicts/${typeId}/items?is_active=false` })).json().total).toBe(0)
    const detail = (await s.inject({ url: `/api/admin/dicts/${typeId}?include_items=1` })).json()
    expect(detail.items.map((i: { value: string }) => i.value)).toEqual(['b', 'a'])
    expect(detail.items[0]).not.toHaveProperty('dict_type_code')
  })

  it('options：只返回启用类型的启用项，未知 code 返回空数组；无需菜单权限', async () => {
    await s.inject({ method: 'PUT', url: `/api/admin/dicts/items/${a}`, payload: { is_active: false } })
    const res = await u.inject({ url: `/api/admin/dicts/options?codes=${P}a,${P}b,${P}a,none` })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({
      [`${P}a`]: [{ label: '乙', value: 'b', color: null, is_default: true }],
      [`${P}b`]: [],
      none: [],
    })
    expect((await u.inject({ url: '/api/admin/dicts/options' })).json()).toEqual({ error: 'codes 参数不能为空' })
    await s.inject({ method: 'PUT', url: `/api/admin/dicts/items/${a}`, payload: { is_active: true } })
  })

  it('编辑：默认项互斥、类型迁移、值重复、唯一约束冲突 → 500 回滚', async () => {
    const res = await s.inject({ method: 'PUT', url: `/api/admin/dicts/items/${a}`, payload: { is_default: true } })
    expect(res.json()).toMatchObject({ is_default: true })
    expect((await itemsOf(typeId)).find((r) => r.id === b)!.is_default).toBe(false)

    expect((await s.inject({ method: 'PUT', url: `/api/admin/dicts/items/${a}`, payload: { value: ' b ' } })).json()).toEqual({
      error: '同一字典下字典值不能重复',
    })
    expect((await s.inject({ method: 'PUT', url: `/api/admin/dicts/items/${a}`, payload: { dict_type_id: 99999999 } })).json()).toEqual({
      error: '字典类型不存在',
    })
    expect((await s.inject({ method: 'PUT', url: `/api/admin/dicts/items/${a}`, payload: { label: ' ' } })).json()).toEqual({
      error: '字典标签不能为空',
    })

    // The raw value (with whitespace) is stored; the duplicate check uses the trimmed value, so the ' c ' vs ' c ' conflict is only caught by the unique constraint at commit
    const spaced = await s.inject({ method: 'PUT', url: `/api/admin/dicts/items/${b}`, payload: { value: ' c ' } })
    expect(spaced.json().value).toBe(' c ')
    const conflict = await s.inject({ method: 'PUT', url: `/api/admin/dicts/items/${a}`, payload: { value: ' c ', is_default: true, label: '冲突' } })
    expect(conflict.statusCode).toBe(500)
    expect(conflict.json()).toEqual(INTERNAL)
    const [stillA] = await handle.db.select().from(dict_items).where(eq(dict_items.id, a))
    expect(stillA).toMatchObject({ value: 'a', label: '甲' })

    // Move to another dict type
    const moved = await s.inject({ method: 'PUT', url: `/api/admin/dicts/items/${b}`, payload: { dict_type_id: String(otherTypeId), value: 'b' } })
    expect(moved.json()).toMatchObject({ dict_type_id: otherTypeId, dict_type_code: `${P}b`, value: 'b' })
    await s.inject({ method: 'PUT', url: `/api/admin/dicts/items/${b}`, payload: { dict_type_id: typeId } })
  })

  it('导出 csv 精确字节（公式防注入、逗号引用）/ xlsx 读回；模板', async () => {
    await s.inject({
      method: 'POST',
      url: `/api/admin/dicts/${typeId}/items`,
      payload: { label: '=SUM(1)', value: '-x', description: '备注,逗号', sort_order: 9, is_active: false },
    })
    const csv = await s.inject({ url: `/api/admin/dicts/${typeId}/items/export` })
    expect(csv.headers['content-disposition']).toBe(`attachment; filename=dict_${P}a_items.csv`)
    expect(csv.headers['content-type']).toBe('text/csv; charset=utf-8')
    expect(csv.body).toBe(
      '﻿字典标签,字典值,标签颜色,排序,是否默认,是否启用,备注\r\n' +
        '乙,b,,0,否,是,\r\n' +
        '甲,a,red,2,是,是,\r\n' +
        "'=SUM(1),'-x,,9,否,否,\"备注,逗号\"\r\n",
    )
    const xlsx = await s.inject({ url: `/api/admin/dicts/${typeId}/items/export?file_type=xlsx` })
    expect(xlsx.headers['content-disposition']).toBe(`attachment; filename=dict_${P}a_items.xlsx`)
    const rows = await readXlsx(xlsx.rawPayload)
    expect(rows[0]).toEqual(['字典标签', '字典值', '标签颜色', '排序', '是否默认', '是否启用', '备注'])
    expect(rows[2]!.slice(0, 6)).toEqual(['甲', 'a', 'red', '2', '是', '是'])

    const tpl = await s.inject({ url: `/api/admin/dicts/${typeId}/items/template?file_type=xls` })
    expect(tpl.headers['content-disposition']).toBe(`attachment; filename=dict_${P}a_import_template.csv`)
    expect(tpl.body).toBe('﻿字典标签,字典值,标签颜色,排序,是否默认,是否启用,备注\r\n示例标签,sample_value,#1677ff,0,否,是,可选\r\n')
  })

  it('导入：新增 + 更新（空排序沿用原值）+ 默认项互斥；旧英文表头与 xlsx', async () => {
    const file = multipartFile(
      'd.csv',
      '字典标签,字典值,标签颜色,排序,是否默认,是否启用,备注\n' +
        '甲改,a,,,否,,新备注\n' +
        '新,n1,blue,7,是,停用,\n' +
        '新2,n2,,x,,,\n',
    )
    const res = await s.inject({ method: 'POST', url: `/api/admin/dicts/${typeId}/items/import`, ...file })
    expect(res.json()).toEqual({ message: '导入成功', created: 2, updated: 1 })
    const rows = await itemsOf(typeId)
    const byValue = Object.fromEntries(rows.map((r) => [r.value, r]))
    expect(byValue.a).toMatchObject({ label: '甲改', color: null, sort_order: 2, is_default: false, description: '新备注' })
    expect(byValue.n1).toMatchObject({ is_default: true, is_active: false, sort_order: 7, color: 'blue' })
    expect(byValue.n2).toMatchObject({ is_default: false, is_active: true, sort_order: 0, description: null })
    expect(rows.filter((r) => r.is_default).map((r) => r.value)).toEqual(['n1'])

    const xlsx = multipartFile('d.xlsx', await xlsxBuffer([[' label ', 'value', 'is_default'], ['X', 'n3', 'yes'], [null, null, null]]))
    const res2 = await s.inject({ method: 'POST', url: `/api/admin/dicts/${typeId}/items/import`, ...xlsx })
    expect(res2.json()).toEqual({ message: '导入成功', created: 1, updated: 0 })
    expect((await itemsOf(typeId)).filter((r) => r.is_default).map((r) => r.value)).toEqual(['n3'])
  })

  it('导入：错误行整体回滚；缺列/空文件/无文件/不支持格式', async () => {
    const before = await itemsOf(typeId)
    const bad = multipartFile('d.csv', '字典标签,字典值\n好,ok1\n,缺标签\n')
    const res = await s.inject({ method: 'POST', url: `/api/admin/dicts/${typeId}/items/import`, ...bad })
    expect(res.statusCode).toBe(400)
    expect(res.json()).toEqual({ error: '第 3 行“字典标签/字典值”不能为空' })
    expect(await itemsOf(typeId)).toEqual(before)

    const imp = (file: ReturnType<typeof multipartFile>) =>
      s.inject({ method: 'POST', url: `/api/admin/dicts/${typeId}/items/import`, ...file })
    expect((await imp(multipartFile('d.csv', '字典标签,备注\nx,y\n'))).json()).toEqual({ error: '导入文件缺少必填列：字典标签、字典值' })
    expect((await imp(multipartFile('d.xlsx', await xlsxBuffer([])))).json()).toEqual({ error: '导入内容为空' })
    expect((await imp(multipartFile('d.xls', 'x'))).json()).toEqual({ error: '不支持 .xls 格式，请另存为 .xlsx 后重新上传' })
    expect((await imp(multipartFile('d.txt', 'x'))).json()).toEqual({ error: '仅支持 csv/xlsx 文件' })
    expect((await s.inject({ method: 'POST', url: `/api/admin/dicts/${typeId}/items/import` })).json()).toEqual({ error: '请上传导入文件' })
    expect((await s.inject({ method: 'POST', url: '/api/admin/dicts/99999999/items/import' })).statusCode).toBe(404)
  })

  it('删除：仍有字典项 → 400；删项后可删类型；404', async () => {
    expect((await s.inject({ method: 'DELETE', url: `/api/admin/dicts/${typeId}` })).json()).toEqual({
      error: '该字典下仍有字典项，请先清空后再删除',
    })
    for (const item of await itemsOf(typeId)) {
      expect((await s.inject({ method: 'DELETE', url: `/api/admin/dicts/items/${item.id}` })).json()).toEqual({ message: '删除成功' })
    }
    expect((await s.inject({ method: 'DELETE', url: `/api/admin/dicts/${typeId}` })).json()).toEqual({ message: '删除成功' })
    expect((await s.inject({ method: 'DELETE', url: `/api/admin/dicts/${typeId}` })).statusCode).toBe(404)
    expect((await s.inject({ method: 'DELETE', url: '/api/admin/dicts/items/99999999' })).json()).toEqual({ error: '资源不存在' })
  })
})

describe('dicts：权限', () => {
  it('无权限用户：各接口 403 文案；带 id 的路由先 404 后 403', async () => {
    const [t] = await handle.db.select().from(dict_types).where(eq(dict_types.code, `${P}b`))
    const id = t!.id
    const [item] = await handle.db
      .insert(dict_items)
      .values({ dict_type_id: id, label: 'p', value: 'p' })
      .returning()
    const cases: [string, string, string][] = [
      ['GET', '/api/admin/dicts', '无权限查看数据字典'],
      ['POST', '/api/admin/dicts', '无权限新增数据字典'],
      ['GET', `/api/admin/dicts/${id}`, '无权限查看数据字典'],
      ['PUT', `/api/admin/dicts/${id}`, '无权限编辑数据字典'],
      ['DELETE', `/api/admin/dicts/${id}`, '无权限删除数据字典'],
      ['GET', `/api/admin/dicts/${id}/items`, '无权限查看字典项'],
      ['POST', `/api/admin/dicts/${id}/items`, '无权限新增字典项'],
      ['GET', `/api/admin/dicts/${id}/items/export`, '无权限导出字典项'],
      ['GET', `/api/admin/dicts/${id}/items/template`, '无权限下载模板'],
      ['POST', `/api/admin/dicts/${id}/items/import`, '无权限导入字典项'],
      ['GET', `/api/admin/dicts/items/${item!.id}`, '无权限查看字典项'],
      ['PUT', `/api/admin/dicts/items/${item!.id}`, '无权限编辑字典项'],
      ['DELETE', `/api/admin/dicts/items/${item!.id}`, '无权限删除字典项'],
    ]
    for (const [method, url, error] of cases) {
      const res = await u.inject({ method: method as 'GET', url, ...(method === 'GET' ? {} : { payload: {} }) })
      expect([res.statusCode, res.json()], `${method} ${url}`).toEqual([403, { error }])
    }
    for (const url of ['/api/admin/dicts/99999999', '/api/admin/dicts/99999999/items', '/api/admin/dicts/items/99999999']) {
      expect((await u.inject({ url })).json()).toEqual({ error: '资源不存在' })
    }
    // Not logged in
    const anon = await app.inject({ url: '/api/admin/dicts/options?codes=a' })
    expect([anon.statusCode, anon.json()]).toEqual([401, { error: '未授权访问', redirect: '/admin/login' }])
    await handle.db.delete(dict_items).where(inArray(dict_items.id, [item!.id]))
  })
})
