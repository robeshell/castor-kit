import ExcelJS from 'exceljs'
import { eq, like, sql } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DbHandle } from '@/db/client'
import { announcements } from '@/db/schema'
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
  await handle.db.delete(announcements).where(like(announcements.title, `${P}%`))
}

async function row(id: number) {
  const [r] = await handle.db.select().from(announcements).where(eq(announcements.id, id))
  return r!
}

/** 在数据库里算期望值（会话时区换算），不经过 JS Date */
async function dbScalar(expr: ReturnType<typeof sql>): Promise<string> {
  const res = await handle.db.execute<{ v: string }>(sql`SELECT (${expr})::text AS v`)
  return res.rows[0]!.v
}

async function readXlsx(buf: Buffer): Promise<unknown[][]> {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buf as unknown as ArrayBuffer)
  const rows: unknown[][] = []
  wb.worksheets[0]!.eachRow((r) => rows.push((r.values as unknown[]).slice(1)))
  return rows
}

beforeAll(async () => {
  handle = openTestDb()
  app = await buildTestApp()
  await cleanup()
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

describe('announcement', () => {
  let a: number
  let b: number

  it('新增：201，默认值与 publish_at 解析（带 Z 按会话时区换算、naive 原样）', async () => {
    const res = await s.inject({
      method: 'POST',
      url: '/api/admin/announcements',
      payload: { title: ` ${P}甲 `, publish_at: '2026-09-23T10:00:00Z', is_top: 'x', sort_order: '3', content: null },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    a = body.id
    expect(Object.keys(body).sort()).toEqual(
      ['announce_type', 'content', 'created_at', 'id', 'is_top', 'publish_at', 'sort_order', 'status', 'title', 'updated_at'].sort(),
    )
    expect(body).toMatchObject({ title: `${P}甲`, content: '', announce_type: 'system', status: 'draft', is_top: true, sort_order: 3 })
    const expected = await dbScalar(sql`('2026-09-23T10:00:00+00:00'::timestamptz)::timestamp`)
    expect((await row(a)).publish_at).toBe(expected)
    expect(body.publish_at).toBe(expected.replace(' ', 'T'))

    const rb = await s.inject({
      method: 'POST',
      url: '/api/admin/announcements',
      payload: { title: `${P}乙`, announce_type: 'activity', status: 'published', publish_at: 'garbage', sort_order: 2.9, is_top: 0 },
    })
    expect(rb.json()).toMatchObject({ announce_type: 'activity', status: 'published', publish_at: null, sort_order: 2, is_top: false })
    b = rb.json().id
  })

  it('新增校验：标题为空 400；非字符串标题 / 非法 sort_order / 超长 → 500', async () => {
    const post = (payload: object) => s.inject({ method: 'POST', url: '/api/admin/announcements', payload })
    expect([(await post({})).statusCode, (await post({ title: ' ' })).json()]).toEqual([400, { error: '标题不能为空' }])
    for (const bad of [{ title: 123 }, { title: `${P}x`, sort_order: 'abc' }, { title: `${P}${'x'.repeat(100)}` }, { title: `${P}x`, content: { a: 1 } }]) {
      const res = await post(bad)
      expect([res.statusCode, res.json()]).toEqual([500, INTERNAL])
    }
    expect(await handle.db.select().from(announcements).where(eq(announcements.title, `${P}x`))).toHaveLength(0)
  })

  it('列表：{items,total}，置顶优先、sort_order 升序、id 降序；search/status/announce_type', async () => {
    const res = (await s.inject({ url: `/api/admin/announcements?search=${P}&per_page=200` })).json()
    expect(Object.keys(res).sort()).toEqual(['items', 'total'])
    expect(res.items.map((i: { id: number }) => i.id)).toEqual([a, b])
    expect((await s.inject({ url: `/api/admin/announcements?search=${P}&status=published` })).json().total).toBe(1)
    expect((await s.inject({ url: `/api/admin/announcements?search=${P}&announce_type=%20activity%20` })).json().total).toBe(1)
    expect((await s.inject({ url: `/api/admin/announcements?search=${P}&per_page=1&page=2` })).json().items[0].id).toBe(b)
  })

  it('编辑：空 body / 同值不改 updated_at；status=published 补 publish_at；publish_at 非法保持', async () => {
    const before = await row(b)
    expect((await s.inject({ method: 'PUT', url: `/api/admin/announcements/${b}`, payload: {} })).statusCode).toBe(200)
    await s.inject({ method: 'PUT', url: `/api/admin/announcements/${b}`, payload: { title: `${P}乙 `, sort_order: '2', is_top: null } })
    expect((await row(b)).updated_at).toBe(before.updated_at)

    const pub = (await s.inject({ method: 'PUT', url: `/api/admin/announcements/${b}`, payload: { status: 'published', publish_at: 'bad' } })).json()
    expect(pub.publish_at).not.toBeNull()
    const afterPub = await row(b)
    expect(afterPub.updated_at).not.toBe(before.updated_at)

    // 已有 publish_at 时 status=published 不覆盖
    await s.inject({ method: 'PUT', url: `/api/admin/announcements/${b}`, payload: { status: 'published' } })
    expect((await row(b)).publish_at).toBe(afterPub.publish_at)

    const naive = (await s.inject({ method: 'PUT', url: `/api/admin/announcements/${b}`, payload: { publish_at: '2026-01-02 03:04:05.5' } })).json()
    expect(naive.publish_at).toBe('2026-01-02T03:04:05.500000')
    const cleared = (await s.inject({ method: 'PUT', url: `/api/admin/announcements/${b}`, payload: { publish_at: null, content: 0 } })).json()
    expect(cleared).toMatchObject({ publish_at: null, content: '' })

    expect((await s.inject({ method: 'PUT', url: `/api/admin/announcements/${b}`, payload: { title: '' } })).json()).toEqual({
      error: '标题不能为空',
    })
    for (const bad of [{ announce_type: null }, { sort_order: [1] }, { title: ['x'] }]) {
      const res = await s.inject({ method: 'PUT', url: `/api/admin/announcements/${b}`, payload: bad })
      expect([res.statusCode, res.json()]).toEqual([500, INTERNAL])
    }
    expect((await s.inject({ method: 'PUT', url: '/api/admin/announcements/99999999', payload: {} })).statusCode).toBe(404)
  })

  it('发布/撤回：首次发布写 publish_at；重复发布无变化；撤回只改状态', async () => {
    await s.inject({ method: 'PUT', url: `/api/admin/announcements/${a}`, payload: { publish_at: '' } })
    const first = (await s.inject({ method: 'POST', url: `/api/admin/announcements/${a}/publish` })).json()
    expect(first.status).toBe('published')
    expect(first.publish_at).not.toBeNull()
    const again = (await s.inject({ method: 'POST', url: `/api/admin/announcements/${a}/publish` })).json()
    expect(again).toEqual(first)
    const un = (await s.inject({ method: 'POST', url: `/api/admin/announcements/${a}/unpublish` })).json()
    expect(un).toMatchObject({ status: 'draft', publish_at: first.publish_at })
    const un2 = (await s.inject({ method: 'POST', url: `/api/admin/announcements/${a}/unpublish` })).json()
    expect(un2).toEqual(un)
    expect((await s.inject({ method: 'POST', url: '/api/admin/announcements/99999999/publish' })).statusCode).toBe(404)
  })

  it('导出：csv 精确字节（选中模式按 id 升序）/ 默认 xlsx 全部 / 导出字段', async () => {
    await s.inject({ method: 'PUT', url: `/api/admin/announcements/${a}`, payload: { content: '=cmd', title: `${P}甲,"q"`, publish_at: '2026-01-02T03:04:05.9' } })
    const csv = await s.inject({
      method: 'POST',
      url: '/api/admin/announcements/export',
      payload: { export_mode: 'selected', ids: [b, a], fields: ['title', 'is_top', 'content', 'publish_at', 'bogus'], file_type: 'csv' },
    })
    expect(csv.headers['content-disposition']).toBe('attachment; filename=announcements_export.csv')
    expect(csv.body).toBe(`﻿标题,是否置顶,内容,发布时间\r\n"${P}甲,""q""",是,'=cmd,2026-01-02 03:04:05\r\n${P}乙,否,,\r\n`)

    const xlsx = await s.inject({ method: 'POST', url: '/api/admin/announcements/export', payload: { ids: [a] } })
    expect(xlsx.headers['content-disposition']).toBe('attachment; filename=announcements_export.xlsx')
    const rows = await readXlsx(xlsx.rawPayload)
    expect(rows[0]).toEqual(['ID', '标题', '公告类型', '状态', '是否置顶', '排序权重', '内容', '发布时间', '创建时间'])
    expect(rows.length).toBeGreaterThanOrEqual(3)

    const fields = (await u.inject({ url: '/api/admin/announcements/export-fields' })).json()
    expect(fields).toEqual([
      { label: 'ID', value: 'id' },
      { label: '标题', value: 'title' },
      { label: '公告类型', value: 'announce_type' },
      { label: '状态', value: 'status' },
      { label: '是否置顶', value: 'is_top' },
      { label: '排序权重', value: 'sort_order' },
      { label: '内容', value: 'content' },
      { label: '发布时间', value: 'publish_at' },
      { label: '创建时间', value: 'created_at' },
    ])
    const bad = await s.inject({ method: 'POST', url: '/api/admin/announcements/export', payload: { export_mode: 'selected', ids: 'abc' } })
    expect([bad.statusCode, bad.json()]).toEqual([500, INTERNAL])
  })

  it('模板：默认 xlsx，csv 精确字节', async () => {
    const x = await s.inject({ url: '/api/admin/announcements/template' })
    expect(x.headers['content-disposition']).toBe('attachment; filename=announcements_import_template.xlsx')
    expect((await readXlsx(x.rawPayload))[1]).toEqual(['系统维护公告', 'system', 'draft', '否', '0', '系统将于今晚进行维护，请提前保存工作。'])
    const c = await s.inject({ url: '/api/admin/announcements/template?file_type=csv' })
    expect(c.body).toBe('﻿标题,公告类型,状态,是否置顶,排序权重,内容\r\n系统维护公告,system,draft,否,0,系统将于今晚进行维护，请提前保存工作。\r\n')
  })

  it('导入：逐行提交，错误行不影响成功行，返回 200 + error_rows', async () => {
    const long = `${P}${'x'.repeat(100)}`
    const file = multipartFile(
      'a.csv',
      '标题,公告类型,状态,是否置顶,排序权重,内容\n' +
        `${P}导入1,activity,published,是,5,c1\n` +
        ',system,draft,,,\n' +
        `${P}导入2,bogus,bogus,True,x,\n` +
        `${long},,,,,\n`,
    )
    const res = await s.inject({ method: 'POST', url: '/api/admin/announcements/import', ...file })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.created).toBe(2)
    expect(body.updated).toBe(0)
    expect(body.error_rows.map((r: { line: number }) => r.line)).toEqual([3, 5])
    expect(body.error_rows[0]).toEqual({
      line: 3,
      reason: '标题不能为空',
      row: { 标题: '', 公告类型: 'system', 状态: 'draft', 是否置顶: '', 排序权重: '', 内容: '' },
    })
    expect(body.error_rows[1].reason).toMatch(/^\(psycopg2\.errors\.StringDataRightTruncation\) /)
    const [one] = await handle.db.select().from(announcements).where(eq(announcements.title, `${P}导入1`))
    expect(one).toMatchObject({ announce_type: 'activity', status: 'published', is_top: true, sort_order: 5, content: 'c1', publish_at: null })
    const [two] = await handle.db.select().from(announcements).where(eq(announcements.title, `${P}导入2`))
    expect(two).toMatchObject({ announce_type: 'system', status: 'draft', is_top: true, sort_order: 0, content: '' })

    const ok = await s.inject({ method: 'POST', url: '/api/admin/announcements/import', ...multipartFile('a.csv', `title\n${P}导入3\n`) })
    expect(ok.json()).toEqual({ created: 1, updated: 0 })
  })

  it('导入：表头带空白的列不会被映射；空文件/无文件/格式', async () => {
    const res = await s.inject({ method: 'POST', url: '/api/admin/announcements/import', ...multipartFile('a.csv', ` 标题 \n${P}空白表头\n`) })
    expect(res.json()).toEqual({ created: 0, updated: 0, error_rows: [{ line: 2, reason: '标题不能为空', row: { ' 标题 ': `${P}空白表头` } }] })

    const imp = (f: ReturnType<typeof multipartFile>) => s.inject({ method: 'POST', url: '/api/admin/announcements/import', ...f })
    const wb = new ExcelJS.Workbook()
    wb.addWorksheet('Sheet')
    const empty = Buffer.from(await wb.xlsx.writeBuffer())
    expect((await imp(multipartFile('a.xlsx', empty))).json()).toEqual({ error: '文件为空或格式错误' })
    expect((await imp(multipartFile('a.csv', ''))).json()).toEqual({ error: '导入文件内容为空' })
    expect((await imp(multipartFile('a.xls', 'x'))).json()).toEqual({ error: '不支持 .xls 格式，请另存为 .xlsx 后重新上传' })
    expect((await s.inject({ method: 'POST', url: '/api/admin/announcements/import' })).json()).toEqual({ error: '请上传导入文件' })
  })

  it('删除', async () => {
    expect((await s.inject({ method: 'DELETE', url: `/api/admin/announcements/${a}` })).json()).toEqual({ message: '删除成功' })
    expect((await s.inject({ method: 'DELETE', url: `/api/admin/announcements/${a}` })).statusCode).toBe(404)
  })

  it('权限：先 403 后 404；export-fields 只需登录', async () => {
    const cases: [string, string][] = [
      ['GET', '/api/admin/announcements'],
      ['POST', '/api/admin/announcements'],
      ['PUT', '/api/admin/announcements/99999999'],
      ['DELETE', '/api/admin/announcements/99999999'],
      ['POST', '/api/admin/announcements/99999999/publish'],
      ['POST', '/api/admin/announcements/99999999/unpublish'],
      ['POST', '/api/admin/announcements/export'],
      ['GET', '/api/admin/announcements/template'],
      ['POST', '/api/admin/announcements/import'],
    ]
    for (const [method, url] of cases) {
      const res = await u.inject({ method: method as 'GET', url, ...(method === 'GET' ? {} : { payload: {} }) })
      expect([res.statusCode, res.json()], `${method} ${url}`).toEqual([403, { error: '无权限' }])
    }
    expect((await u.inject({ url: '/api/admin/announcements/export-fields' })).statusCode).toBe(200)
    expect((await app.inject({ url: '/api/admin/announcements/export-fields' })).statusCode).toBe(401)
  })
})
