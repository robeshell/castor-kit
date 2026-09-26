import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import ExcelJS from 'exceljs'
import { eq, inArray, like } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DbHandle } from '@/db/client'
import { file_references, files, query_management_versions, query_managements } from '@/db/schema'
import { pyTitle, secureFilename } from '@/modules/component-center/list-page/schema'
import { normalizeImageUrls, parseSchemaConfig } from '@/modules/component-center/list-page/service'
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
  testConfig,
  type AuthedSession,
} from './helpers'

const P = 'ck_test_r3_lp_'
const B = '/api/admin/component-center/list-page'
let app: FastifyInstance
let handle: DbHandle
let s: AuthedSession
let noPerm: AuthedSession
let instanceDir: string

async function cleanupRows() {
  await handle.db.delete(query_managements).where(like(query_managements.query_code, `${P}%`))
}

async function create(body: Record<string, unknown>) {
  const res = await s.inject({ method: 'POST', url: B, payload: body })
  expect(res.statusCode).toBe(201)
  return res.json()
}

beforeAll(async () => {
  handle = openTestDb()
  instanceDir = mkdtempSync(join(tmpdir(), 'ck-r3-instance-'))
  app = await buildTestApp({ instanceDir, storage: { ...testConfig().storage, localDir: join(instanceDir, 'uploads', 'files') } })
  // createFixture first cleans up all ck_test_ users, so it must run before superAdminSession
  await createFixture(handle)
  s = await superAdminSession(app, handle)
  noPerm = await loginSession(app, FIXTURE_USER, FIXTURE_PASSWORD)
  await cleanupRows()
})

afterAll(async () => {
  await cleanupRows()
  await cleanupFixture(handle)
  await app.close()
  await handle.pool.end()
  rmSync(instanceDir, { recursive: true, force: true })
})

describe('list-page 纯函数', () => {
  it('secure_filename / str.title / URL 列表 / schema_config', () => {
    expect(secureFilename('My cool movie.mov')).toBe('My_cool_movie.mov')
    expect(secureFilename('../../../etc/passwd')).toBe('etc_passwd')
    expect(secureFilename('i contain cool \xfcml\xe4uts.txt')).toBe('i_contain_cool_umlauts.txt')
    expect(secureFilename('报告.pdf')).toBe('pdf')
    expect(secureFilename('._.')).toBe('')
    expect(pyTitle('user2id')).toBe('User2Id')
    expect(pyTitle('updated at')).toBe('Updated At')
    expect(pyTitle('ÉCOLE x')).toBe('École X')
    expect(normalizeImageUrls('a，b；c\nd')).toEqual(['a', 'b', 'c', 'd'])
    expect(normalizeImageUrls('["x", 1, null, " "]')).toEqual(['x', '1', 'None'])
    expect(normalizeImageUrls('123')).toEqual(['123'])
    expect(normalizeImageUrls({ a: 1 })).toEqual([])
    expect(parseSchemaConfig({ a: [1, {}], b: '中' })).toBe('{\n  "a": [\n    1,\n    {}\n  ],\n  "b": "中"\n}')
    expect(parseSchemaConfig(['x', true, null])).toBe("['x', True, None]")
  })
})

describe('list-page CRUD', () => {
  it('新增 201：归一化 + Python json.dumps 格式落库 + create 版本快照', async () => {
    const body = await create({
      name: ' 全字段 ',
      query_code: `${P}a`,
      category: ' ',
      owner: ' me ',
      priority: '12',
      is_active: '否',
      status: 'published',
      condition_logic: 'or',
      conditions: { groups: [{ logic: 'x' }], items: [{ field: 'f', operator: 'eq', value: null, logic: 'or' }, { field: '' }] },
      display_config: '{"a": {"中": 1}}',
      permission_config: [1],
      schema_config: { v: 1 },
      image_urls: 'a.png，b.png',
      file_url: 'x.pdf',
      operator: 'tester',
    })
    expect(body).toMatchObject({
      name: '全字段',
      category: 'general',
      owner: 'me',
      priority: 12,
      is_active: false,
      status: 'published',
      condition_logic: 'OR',
      conditions: { groups: [{ name: '分组1', logic: 'AND' }], items: [{ field: 'f', operator: 'eq', value: '', logic: 'OR' }] },
      display_config: { a: { 中: 1 } },
      permission_config: {},
      schema_config: '{\n  "v": 1\n}',
      image_url: 'a.png',
      image_urls: ['a.png', 'b.png'],
      file_url: 'x.pdf',
      file_urls: ['x.pdf'],
      version: 1,
      keyword: null,
    })
    expect(body.published_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{6})?$/)

    const [row] = await handle.db.select().from(query_managements).where(eq(query_managements.id, body.id))
    expect(row!.conditions_json).toBe(
      '{"groups": [{"name": "分组1", "logic": "AND"}], "items": [{"field": "f", "operator": "eq", "value": "", "logic": "OR"}]}',
    )
    expect(row!.display_config).toBe('{"a": {"中": 1}}')
    expect(row!.image_urls).toBe('["a.png", "b.png"]')

    const versions = await handle.db.select().from(query_management_versions).where(eq(query_management_versions.query_management_id, body.id))
    expect(versions).toHaveLength(1)
    expect(versions[0]).toMatchObject({ version_no: 1, action: 'create', operator: 'tester' })
    const snapshot = JSON.parse(versions[0]!.snapshot_json)
    expect(Object.keys(snapshot)).not.toContain('created_at')
    expect(snapshot.query_code).toBe(`${P}a`)
    expect(versions[0]!.snapshot_json.startsWith(`{"id": ${body.id}, "name": "全字段", `)).toBe(true)
  })

  it('新增 校验分支', async () => {
    const cases: [Record<string, unknown>, string][] = [
      [{}, '查询名称不能为空'],
      [{ name: 'x' }, '查询编码不能为空'],
      [{ name: 'x', query_code: `${P}a` }, '查询编码已存在'],
      [{ name: 'x', query_code: `${P}z`, status: 0 }, '状态仅支持 draft/published'],
      [{ name: 'x', query_code: `${P}z`, conditions: '{bad' }, '条件配置 JSON 格式错误'],
      [{ name: 'x', query_code: `${P}z`, conditions: [] }, '条件配置必须是对象'],
    ]
    for (const [payload, error] of cases) {
      const res = await s.inject({ method: 'POST', url: B, payload })
      expect(res.statusCode).toBe(400)
      expect(res.json()).toEqual({ error })
    }
    const long = await s.inject({ method: 'POST', url: B, payload: { name: 'n'.repeat(121), query_code: `${P}z` } })
    expect(long.statusCode).toBe(500)
    expect(long.json()).toEqual({ error: '服务器内部错误，请稍后重试' })
  })

  it('列表：形状、筛选、per_page 钳制、排序 priority desc', async () => {
    await create({ name: 'B', query_code: `${P}b`, priority: 99, owner: 'Zed', category: 'cat_r3', status: 'draft' })
    const res = await s.inject({ url: `${B}?search=${P}&per_page=999` })
    const body = res.json()
    expect(Object.keys(body).sort()).toEqual(['items', 'page', 'per_page', 'total'])
    expect(body.per_page).toBe(200)
    expect(body.items.map((i: { query_code: string }) => i.query_code)).toEqual([`${P}b`, `${P}a`])
    const filtered = await s.inject({ url: `${B}?search=${P}&owner=zE&category=cat_r3&is_active=1&status=draft` })
    expect(filtered.json().total).toBe(1)
    const inactive = await s.inject({ url: `${B}?search=${P}&is_active=停用` })
    expect(inactive.json().items.map((i: { query_code: string }) => i.query_code)).toEqual([`${P}a`])
  })

  it('详情 / 404 先于 403 / 非数字 id', async () => {
    const [row] = await handle.db.select().from(query_managements).where(eq(query_managements.query_code, `${P}a`))
    expect((await s.inject({ url: `${B}/${row!.id}` })).json().query_code).toBe(`${P}a`)
    expect((await s.inject({ url: `${B}/99999999` })).json()).toEqual({ error: '资源不存在' })
    expect((await noPerm.inject({ url: `${B}/99999999` })).statusCode).toBe(404)
    const forbidden = await noPerm.inject({ url: `${B}/${row!.id}` })
    expect(forbidden.statusCode).toBe(403)
    expect(forbidden.json()).toEqual({ error: '无权限查看记录详情' })
    expect((await noPerm.inject({ method: 'PUT', url: `${B}/${row!.id}`, payload: {} })).json()).toEqual({ error: '无权限编辑记录' })
    expect((await noPerm.inject({ method: 'DELETE', url: `${B}/${row!.id}` })).json()).toEqual({ error: '无权限删除记录' })
    expect((await s.inject({ url: `${B}/abc` })).statusCode).toBe(404)
    expect((await s.inject({ method: 'PUT', url: `${B}/abc`, payload: {} })).statusCode).toBe(405)
  })

  it('权限 403：列表/新增/导出/模板/导入/回读/预览/版本/回滚', async () => {
    const checks: [string, string, string][] = [
      ['GET', B, '无权限查看列表页数据'],
      ['POST', B, '无权限新增记录'],
      ['GET', `${B}/export`, '无权限导出数据'],
      ['POST', `${B}/export`, '无权限导出数据'],
      ['GET', `${B}/template`, '无权限下载导入模板'],
      ['POST', `${B}/import`, '无权限导入数据'],
      ['GET', `${B}/image/x.png`, '无权限查看图片'],
      ['GET', `${B}/file/x.pdf`, '无权限查看附件'],
      ['POST', `${B}/run-preview`, '无权限执行数据预览'],
      // versions / rollback: permission check before 404
      ['GET', `${B}/99999999/versions`, '无权限查看版本历史'],
      ['POST', `${B}/99999999/versions/1/rollback`, '无权限回滚版本'],
    ]
    for (const [method, url, error] of checks) {
      const res = await noPerm.inject({ method: method as 'GET', url, ...(method === 'POST' ? { payload: {} } : {}) })
      expect(res.statusCode, url).toBe(403)
      expect(res.json()).toEqual({ error })
    }
  })

  it('编辑：部分字段、version+1、published_at、快照；校验分支', async () => {
    const [row] = await handle.db.select().from(query_managements).where(eq(query_managements.query_code, `${P}b`))
    expect(row!.published_at).toBeNull()
    const res = await s.inject({
      method: 'PUT',
      url: `${B}/${row!.id}`,
      payload: { status: 'published', priority: 'bad', is_active: 'maybe', keyword: 5, image_url: 'one.png', file_urls: [' f ', null] },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body).toMatchObject({ status: 'published', priority: 99, is_active: true, keyword: '5', version: 2, image_urls: ['one.png'], file_urls: ['f', 'None'] })
    expect(body.published_at).not.toBeNull()
    expect(body.updated_at).not.toBe(body.created_at)

    const errs: [Record<string, unknown>, string][] = [
      [{ name: '' }, '查询名称不能为空'],
      [{ query_code: '  ' }, '查询编码不能为空'],
      [{ query_code: `${P}a` }, '查询编码已存在'],
      [{ status: 'x' }, '状态仅支持 draft/published'],
      [{ conditions: 'x' }, '条件配置 JSON 格式错误'],
    ]
    for (const [payload, error] of errs) {
      const r = await s.inject({ method: 'PUT', url: `${B}/${row!.id}`, payload })
      expect(r.json()).toEqual({ error })
    }
    const [after] = await handle.db.select().from(query_managements).where(eq(query_managements.id, row!.id))
    expect(after!.version).toBe(2)
  })

  it('版本列表 + 回滚成功 / 版本不属于当前记录 / 编码冲突 / 404', async () => {
    const [b] = await handle.db.select().from(query_managements).where(eq(query_managements.query_code, `${P}b`))
    const [a] = await handle.db.select().from(query_managements).where(eq(query_managements.query_code, `${P}a`))
    const versions = (await s.inject({ url: `${B}/${b!.id}/versions?per_page=1` })).json()
    expect(versions).toMatchObject({ total: 2, page: 1, per_page: 1 })
    expect(versions.items[0]).toMatchObject({ version_no: 2, action: 'update', operator: 'system' })
    expect(versions.items[0].snapshot.status).toBe('published')

    const all = (await s.inject({ url: `${B}/${b!.id}/versions` })).json().items
    const v1 = all[all.length - 1]
    const rolled = await s.inject({ method: 'POST', url: `${B}/${b!.id}/versions/${v1.id}/rollback` })
    expect(rolled.statusCode).toBe(200)
    expect(rolled.json()).toMatchObject({ status: 'draft', published_at: null, version: 3, image_urls: [], priority: 99 })
    const latest = (await s.inject({ url: `${B}/${b!.id}/versions?per_page=1` })).json().items[0]
    expect(latest).toMatchObject({ version_no: 3, action: 'rollback', operator: 'ck_test_super' })

    const aVersions = (await s.inject({ url: `${B}/${a!.id}/versions` })).json().items
    const wrong = await s.inject({ method: 'POST', url: `${B}/${b!.id}/versions/${aVersions[0].id}/rollback` })
    expect(wrong.json()).toEqual({ error: '版本不属于当前记录' })

    // Change b's code, then roll back to v1 (the old code in the snapshot is taken by c) → conflict
    await s.inject({ method: 'PUT', url: `${B}/${b!.id}`, payload: { query_code: `${P}b2` } })
    await create({ name: 'C', query_code: `${P}b` })
    const conflict = await s.inject({ method: 'POST', url: `${B}/${b!.id}/versions/${v1.id}/rollback` })
    expect(conflict.json()).toEqual({ error: '回滚后查询编码冲突' })

    expect((await s.inject({ method: 'POST', url: `${B}/${b!.id}/versions/99999999/rollback` })).statusCode).toBe(404)
    expect((await s.inject({ url: `${B}/99999999/versions` })).statusCode).toBe(404)
  })

  it('删除：级联删除版本', async () => {
    const [c] = await handle.db.select().from(query_managements).where(eq(query_managements.query_code, `${P}b`))
    const del = await s.inject({ method: 'DELETE', url: `${B}/${c!.id}` })
    expect(del.json()).toEqual({ message: '删除成功' })
    const left = await handle.db.select().from(query_management_versions).where(eq(query_management_versions.query_management_id, c!.id))
    expect(left).toHaveLength(0)
  })
})

describe('list-page 预览', () => {
  it('列定义、行数钳制、条件计数', async () => {
    const res = await s.inject({
      method: 'POST',
      url: `${B}/run-preview`,
      payload: {
        display_config: { selected_fields: ['user2id', 'is_active', 'priority', 'status', 'created_at', 0, ''], preview_rows: 100 },
        conditions: { items: [{ field: 'a', operator: 'eq' }, { field: 'b', operator: 'gt', value: 1 }, { field: 'c' }] },
      },
    })
    const body = res.json()
    expect(body.total).toBe(50)
    expect(body.rows).toHaveLength(50)
    expect(body.condition_count).toBe(2)
    expect(body.elapsed_ms).toBe(35 + 5 * 6 + 2 * 11)
    expect(body.columns.map((c: { title: string }) => c.title)).toEqual(['User2Id', 'Is Active', 'Priority', 'Status', 'Created At'])
    expect(body.rows[1]).toMatchObject({ user2id: 'user2id_sample_2', is_active: false, priority: 2, status: 'draft' })
    expect(body.rows[0].created_at).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)

    const empty = (await s.inject({ method: 'POST', url: `${B}/run-preview`, payload: { display_config: { selected_fields: [''], preview_rows: 0 } } })).json()
    expect(empty.columns).toEqual([{ title: 'Id', dataIndex: 'id' }, { title: 'Name', dataIndex: 'name' }])
    expect(empty.total).toBe(1)
    const bad = await s.inject({ method: 'POST', url: `${B}/run-preview`, payload: { conditions: 5 } })
    expect(bad.json()).toEqual({ error: '条件配置必须是对象' })
  })
})

describe('list-page 导入导出', () => {
  let ids: number[] = []

  beforeAll(async () => {
    const e1 = await create({ name: '导出1', query_code: `${P}e1`, priority: 3, keyword: '=cmd', image_urls: ['u1', 'u2'], conditions: { items: [{ field: 'x', operator: 'eq', value: 'v,1' }] } })
    const e2 = await create({ name: '导出2', query_code: `${P}e2`, is_active: false, file_url: 'f.pdf' })
    ids = [e1.id, e2.id]
  })

  it('导出 csv 选中：精确字节', async () => {
    const res = await s.inject({
      method: 'POST',
      url: `${B}/export`,
      payload: { ids: [ids[1], String(ids[0]), null], fields: ['query_code', 'keyword', 'image_urls', 'file_urls', 'is_active', 'conditions_json', 'priority', 'bad'] },
    })
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-disposition']).toBe('attachment; filename=list_page_export.csv')
    const expected =
      '﻿编码,关键字,图片URL列表,文件URL列表,状态,条件配置JSON,优先级\r\n' +
      `${P}e1,'=cmd,"u1,u2",,启用,"{""groups"": [], ""items"": [{""field"": ""x"", ""operator"": ""eq"", ""value"": ""v,1"", ""logic"": ""AND""}]}",3\r\n` +
      `${P}e2,,,f.pdf,停用,"{""groups"": [], ""items"": []}",0\r\n`
    expect(res.rawPayload.toString('utf8')).toBe(expected)
  })

  it('导出 GET 筛选 + xlsx 读回；fields 字符串/对象语义', async () => {
    const res = await s.inject({ url: `${B}/export?file_type=xlsx&search=${P}e&is_active=1&fields=name,%20query_code` })
    expect(res.headers['content-disposition']).toBe('attachment; filename=list_page_export.xlsx')
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(res.rawPayload as unknown as ArrayBuffer)
    const rows: unknown[] = []
    wb.worksheets[0]!.eachRow((row) => rows.push((row.values as unknown[]).slice(1)))
    expect(rows).toEqual([['名称', '编码'], ['导出1', `${P}e1`]])

    const strFields = await s.inject({ method: 'POST', url: `${B}/export`, payload: { ids: [ids[0]], fields: 'name' } })
    expect(strFields.rawPayload.toString('utf8').split('\r\n')[0]).toContain('ID,名称,编码')
    const objFields = await s.inject({ method: 'POST', url: `${B}/export`, payload: { ids: [ids[0]], fields: { name: 1 } } })
    expect(objFields.rawPayload.toString('utf8')).toBe('﻿名称\r\n导出1\r\n')
    const filtered = await s.inject({
      method: 'POST',
      url: `${B}/export`,
      payload: { export_mode: 'filtered', filters: { search: `${P}e`, is_active: 'false' }, fields: ['name'] },
    })
    expect(filtered.rawPayload.toString('utf8')).toBe('﻿名称\r\n导出2\r\n')
  })

  it('导出 错误分支（400 / 未捕获异常 → 500）', async () => {
    expect((await s.inject({ method: 'POST', url: `${B}/export`, payload: {} })).json()).toEqual({ error: '请先勾选要导出的查询数据' })
    expect((await s.inject({ method: 'POST', url: `${B}/export`, payload: { ids: 1 } })).statusCode).toBe(400)
    for (const payload of [
      { ids: ['abc'] },
      { ids: [true] },
      { ids: [1], fields: 5 },
      { ids: [1], fields: [['name']] },
      { export_mode: 'filtered', filters: [1] },
    ]) {
      const res = await s.inject({ method: 'POST', url: `${B}/export`, payload })
      expect(res.statusCode, JSON.stringify(payload)).toBe(500)
      expect(res.json()).toEqual({ error: '服务器内部错误，请稍后重试' })
    }
  })

  it('模板 csv 精确字节 / xlsx', async () => {
    const res = await s.inject({ url: `${B}/template` })
    expect(res.headers['content-disposition']).toBe('attachment; filename=list_page_import_template.csv')
    expect(res.rawPayload.toString('utf8')).toBe(
      '﻿查询名称,查询编码,查询分类,关键字,数据源,负责人,图片URL列表,文件URL列表,优先级,状态,发布状态,描述\r\n' +
        '订单主查询,order_main_query,order,"订单,时间范围",orders,admin,"https://example.com/1.png,https://example.com/2.png","https://example.com/a.pdf,https://example.com/b.xlsx",10,启用,draft,查询模板示例\r\n',
    )
    const xlsx = await s.inject({ url: `${B}/template?file_type=xlsx` })
    expect(xlsx.headers['content-type']).toContain('spreadsheetml')
  })

  it('导入成功：新增 + 按编码更新（import_update 快照）', async () => {
    const csv =
      '﻿查询名称,查询编码,图片URL列表,优先级,状态,发布状态\r\n' +
      `新导入,${P}i1,"a.png,b.png",7,停用,published\r\n` +
      `改名,${P}e1,,x,,draft\r\n`
    const file = multipartFile('import.csv', csv)
    const res = await s.inject({ method: 'POST', url: `${B}/import`, payload: file.payload, headers: file.headers })
    expect(res.json()).toEqual({ message: '导入成功', created: 1, updated: 1 })
    const [i1] = await handle.db.select().from(query_managements).where(eq(query_managements.query_code, `${P}i1`))
    expect(i1).toMatchObject({ priority: 7, is_active: false, status: 'published', image_urls: '["a.png", "b.png"]', schema_config: '', conditions_json: '{"groups": [], "items": []}' })
    expect(i1!.published_at).not.toBeNull()
    const [e1] = await handle.db.select().from(query_managements).where(eq(query_managements.query_code, `${P}e1`))
    expect(e1).toMatchObject({ name: '改名', version: 2, priority: 0, image_urls: null, keyword: null })
    // The update path leaves the condition config untouched
    expect(e1!.conditions_json).toContain('"v,1"')
    const [v] = await handle.db
      .select()
      .from(query_management_versions)
      .where(inArray(query_management_versions.query_management_id, [e1!.id]))
      .orderBy(query_management_versions.id)
      .then((rows) => rows.slice(-1))
    expect(v).toMatchObject({ action: 'import_update', operator: 'import', version_no: 2 })
  })

  it('导入失败：错误行整体回滚；非法发布状态直接 400；缺列；无文件；xls', async () => {
    const csv = `查询名称,查询编码\r\n回滚我,${P}i2\r\n,${P}i3\r\n`
    const file = multipartFile('import.csv', csv)
    const res = await s.inject({ method: 'POST', url: `${B}/import`, payload: file.payload, headers: file.headers })
    expect(res.statusCode).toBe(400)
    expect(res.json()).toEqual({
      error: '导入失败，存在错误数据',
      error_rows: [{ line: 3, reason: '查询名称和查询编码不能为空', row: { 查询名称: '', 查询编码: `${P}i3` } }],
      error_count: 1,
    })
    expect(await handle.db.select().from(query_managements).where(eq(query_managements.query_code, `${P}i2`))).toHaveLength(0)

    const badStatus = multipartFile('b.csv', `查询名称,查询编码,发布状态\r\nA,${P}i4,bad\r\n`)
    const r2 = await s.inject({ method: 'POST', url: `${B}/import`, payload: badStatus.payload, headers: badStatus.headers })
    expect(r2.json()).toEqual({ error: '状态仅支持 draft/published' })

    const noCol = multipartFile('c.csv', '名称,x\r\nA,1\r\n')
    const r3 = await s.inject({ method: 'POST', url: `${B}/import`, payload: noCol.payload, headers: noCol.headers })
    expect(r3.json()).toEqual({ error: '导入文件缺少“查询名称/查询编码”列' })

    expect((await s.inject({ method: 'POST', url: `${B}/import` })).json()).toEqual({ error: '请上传导入文件' })
    const xls = multipartFile('a.xls', 'x')
    expect((await s.inject({ method: 'POST', url: `${B}/import`, payload: xls.payload, headers: xls.headers })).json()).toEqual({
      error: '不支持 .xls 格式，请另存为 .xlsx 后重新上传',
    })
  })
})

describe('list-page 图片 / 附件（文件中心）与旧文件回读', () => {
  it('保存文件中心的图片 / 附件地址时登记引用；改掉或删除记录时解除', async () => {
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')
    const up = async (name: string, data: Buffer | string) =>
      (await s.inject({ method: 'POST', url: '/api/admin/files', ...multipartFile(name, data) })).json()
    const image = await up('cover.png', png)
    const doc = await up('spec.pdf', '%PDF-1.4 spec')
    const refs = async (id: number) =>
      (await handle.db.select().from(file_references).where(eq(file_references.ref_table, 'query_managements')))
        .filter((r) => r.ref_id === String(id))
        .map((r) => [r.ref_field, r.file_id])
        .sort()

    const created = await s.inject({
      method: 'POST',
      url: B,
      payload: { name: `${P}files`, query_code: `${P}files`, image_urls: [image.url, 'https://example.com/x.png'], file_urls: [doc.url] },
    })
    expect(created.statusCode, created.body).toBe(201)
    const id = created.json().id
    expect(await refs(id)).toEqual([['attachments', doc.id], ['images', image.id]].sort())
    expect((await s.inject({ method: 'DELETE', url: image.url })).json()).toEqual({ error: '文件正在被使用，不能删除' })

    await s.inject({ method: 'PUT', url: `${B}/${id}`, payload: { image_urls: [] } })
    expect(await refs(id)).toEqual([['attachments', doc.id]])
    await s.inject({ method: 'DELETE', url: `${B}/${id}` })
    expect(await refs(id)).toEqual([])
    await handle.db.delete(files).where(inArray(files.id, [image.id, doc.id]))
  })

  it('旧文件回读：图片 inline、附件 attachment', async () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3])
    mkdirSync(join(instanceDir, 'uploads', 'list_page'), { recursive: true })
    mkdirSync(join(instanceDir, 'uploads', 'list_page_files'), { recursive: true })
    writeFileSync(join(instanceDir, 'uploads', 'list_page', 'legacy.png'), png)
    writeFileSync(join(instanceDir, 'uploads', 'list_page_files', 'legacy_r3.pdf'), 'hello pdf')

    const img = await s.inject({ url: `${B}/image/legacy.png` })
    expect(img.statusCode).toBe(200)
    expect(img.headers['content-type']).toBe('image/png')
    expect(img.headers['content-disposition']).toBe('inline; filename=legacy.png')
    expect(img.rawPayload.equals(png)).toBe(true)
    const file = await s.inject({ url: `${B}/file/legacy_r3.pdf` })
    expect(file.headers['content-disposition']).toBe('attachment; filename=legacy_r3.pdf')
    expect(file.headers['cache-control']).toBe('no-cache')
    expect(file.body).toBe('hello pdf')
  })

  it('回读：不存在 404、空名 404、无效名 400、目录穿越被 secure_filename 化解', async () => {
    expect((await s.inject({ url: `${B}/image/nope.png` })).json()).toEqual({ error: '资源不存在' })
    expect((await s.inject({ url: `${B}/image/` })).statusCode).toBe(404)
    expect((await s.inject({ url: `${B}/image/%E4%B8%AD` })).json()).toEqual({ error: '无效的图片文件名' })
    // ../../ is normalized to a bare file name like "x.txt", so only files inside the upload directory can be read
    const traversal = await s.inject({ url: `${B}/file/..%2F..%2Fpackage.json` })
    expect(traversal.statusCode).toBe(404)
    expect((await s.inject({ method: 'POST', url: `${B}/image/a.png` })).statusCode).toBe(405)
  })
})
