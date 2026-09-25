import ExcelJS from 'exceljs'
import { eq, like } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DbHandle } from '@/db/client'
import { stats_items } from '@/db/schema'
import { pyRound2 } from '@/modules/component-center/stats-list-page/schema'
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

const P = 'ck_test_r4_vt_s_'
const B = '/api/admin/component-center/stats-list-page'
let app: FastifyInstance
let handle: DbHandle
let s: AuthedSession
let u: AuthedSession

async function cleanup() {
  await handle.db.delete(stats_items).where(like(stats_items.item_code, `${P}%`))
}

async function rowByCode(code: string) {
  const [row] = await handle.db.select().from(stats_items).where(eq(stats_items.item_code, code))
  return row
}

async function create(body: Record<string, unknown>) {
  const res = await s.inject({ method: 'POST', url: B, payload: body })
  expect(res.statusCode).toBe(201)
  return res.json()
}

beforeAll(async () => {
  handle = openTestDb()
  app = await buildTestApp()
  await cleanup()
  // createFixture removes all ck_test_ users (including super), so create fixtures before logging in as super
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

describe('stats-list-page', () => {
  it('新增：201 + 归一化（金额四舍五入到 2 位、非法数字回落、布尔/状态解析、空串 → null）', async () => {
    const body = await create({
      name: ' 甲 ',
      item_code: `${P}a`,
      category: '',
      status: ' Published ',
      amount: '12.345',
      quantity: '3',
      priority: 'x',
      is_active: 'no',
      owner: '  ',
      description: 0,
    })
    expect(body).toMatchObject({
      name: '甲',
      item_code: `${P}a`,
      category: 'general',
      status: 'published',
      amount: 12.35,
      quantity: 3,
      priority: 0,
      is_active: false,
      owner: null,
      description: null,
    })
    expect(body.created_at).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d{6})?$/)
    await create({ name: '乙', item_code: `${P}b`, category: 'order', amount: 7, priority: 5, owner: '王五' })
    await create({ name: '丙', item_code: `${P}c`, category: 'risk', status: 'archived', amount: -1.5, priority: 9, is_active: '启用' })
  })

  it('新增：各校验分支', async () => {
    const post = (payload: unknown) => s.inject({ method: 'POST', url: B, payload: payload as object })
    expect((await post({ item_code: 'x' })).json()).toEqual({ error: '名称不能为空' })
    expect((await post({ name: 'x', item_code: '  ' })).json()).toEqual({ error: '编码不能为空' })
    expect((await post({ name: 'x', item_code: `${P}a` })).json()).toEqual({ error: '编码已存在' })
    const bad = await post({ name: 'x', item_code: `${P}zz`, status: 'nope' })
    expect(bad.statusCode).toBe(400)
    expect(bad.json()).toEqual({ error: '状态仅支持 draft/published/archived' })
    expect(await rowByCode(`${P}zz`)).toBeUndefined()
  })

  it('列表：形状、排序（priority desc, id desc）、分页与筛选', async () => {
    const res = await s.inject({ url: `${B}?search=${P}` })
    const body = res.json()
    expect(Object.keys(body).sort()).toEqual(['items', 'page', 'per_page', 'total'])
    expect(body.total).toBe(3)
    expect(body.items.map((i: { item_code: string }) => i.item_code)).toEqual([`${P}c`, `${P}b`, `${P}a`])
    const page2 = (await s.inject({ url: `${B}?search=${P}&page=2&per_page=2` })).json()
    expect(page2).toMatchObject({ page: 2, per_page: 2, total: 3 })
    expect(page2.items.map((i: { item_code: string }) => i.item_code)).toEqual([`${P}a`])
    const q = async (qs: string) =>
      (await s.inject({ url: `${B}?search=${P}&${qs}` })).json().items.map((i: { item_code: string }) => i.item_code)
    expect(await q('category=order')).toEqual([`${P}b`])
    expect(await q('owner=%E7%8E%8B')).toEqual([`${P}b`])
    expect(await q('is_active=%E5%81%9C%E7%94%A8')).toEqual([`${P}a`])
    expect(await q('is_active=maybe')).toHaveLength(3)
    expect(await q('status=archived')).toEqual([`${P}c`])
    const byName = (await s.inject({ url: `${B}?search=%E4%B9%99` })).json().items.map((i: { item_code: string }) => i.item_code)
    expect(byName).toContain(`${P}b`)
  })

  it('详情 / 404 先于 403 / 403 文案', async () => {
    const row = await rowByCode(`${P}a`)
    const res = await s.inject({ url: `${B}/${row!.id}` })
    expect(res.json()).toMatchObject({ id: row!.id, amount: 12.35 })
    expect((await s.inject({ url: `${B}/99999999` })).statusCode).toBe(404)
    expect((await u.inject({ url: `${B}/99999999` })).json()).toEqual({ error: '资源不存在' })
    expect((await u.inject({ url: `${B}/${row!.id}` })).json()).toEqual({ error: '无权限查看详情' })
    expect((await u.inject({ method: 'PUT', url: `${B}/${row!.id}`, payload: {} })).json()).toEqual({ error: '无权限编辑记录' })
    expect((await u.inject({ method: 'DELETE', url: `${B}/${row!.id}` })).json()).toEqual({ error: '无权限删除记录' })
    expect((await u.inject({ url: B })).json()).toEqual({ error: '无权限查看数据' })
    expect((await u.inject({ method: 'POST', url: B, payload: {} })).json()).toEqual({ error: '无权限新增记录' })
    expect((await u.inject({ url: `${B}/stats` })).json()).toEqual({ error: '无权限查看统计数据' })
    expect((await u.inject({ method: 'POST', url: `${B}/export`, payload: {} })).json()).toEqual({ error: '无权限导出数据' })
    expect((await u.inject({ url: `${B}/template` })).json()).toEqual({ error: '无权限下载模板' })
    expect((await u.inject({ method: 'POST', url: `${B}/import` })).json()).toEqual({ error: '无权限导入数据' })
    expect((await u.inject({ url: `${B}/stats` })).statusCode).toBe(403)
  })

  it('编辑：同值不写库（updated_at 不变）；float≠Decimal 视为变更；校验分支；失败不落库', async () => {
    const before = (await rowByCode(`${P}b`))!
    const same = await s.inject({
      method: 'PUT',
      url: `${B}/${before.id}`,
      payload: { name: '乙', category: 'order', amount: '7', priority: 5.9, owner: ' 王五 ', status: 'DRAFT', is_active: 'maybe' },
    })
    expect(same.statusCode).toBe(200)
    expect((await rowByCode(`${P}b`))!.updated_at).toBe(before.updated_at)
    expect((await s.inject({ method: 'PUT', url: `${B}/${before.id}`, payload: {} })).json().updated_at).toBe(
      same.json().updated_at,
    )

    const a = (await rowByCode(`${P}a`))!
    expect(a.amount).toBe('12.35')
    // 12.35 can't be represented exactly in binary floating point → treated as a value change, so an UPDATE is issued
    const bumped = await s.inject({ method: 'PUT', url: `${B}/${a.id}`, payload: { amount: 12.35 } })
    expect(bumped.json().amount).toBe(12.35)
    expect((await rowByCode(`${P}a`))!.updated_at).not.toBe(a.updated_at)

    const put = (payload: object) => s.inject({ method: 'PUT', url: `${B}/${before.id}`, payload })
    expect((await put({ name: ' ' })).json()).toEqual({ error: '名称不能为空' })
    expect((await put({ item_code: null })).json()).toEqual({ error: '编码不能为空' })
    expect((await put({ item_code: `${P}a` })).json()).toEqual({ error: '编码已存在' })
    expect((await put({ name: '改了', status: 'x' })).json()).toEqual({ error: '状态仅支持 draft/published/archived' })
    expect((await rowByCode(`${P}b`))!.name).toBe('乙')

    const changed = await put({ name: '乙2', item_code: `${P}b`, amount: 'bad', quantity: [], is_active: false })
    expect(changed.json()).toMatchObject({ name: '乙2', amount: 7, quantity: 0, is_active: false })
  })

  it('/stats：与数据库聚合一致，avg 按 Python round（银行家舍入）', async () => {
    const res = await s.inject({ url: `${B}/stats` })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    const { rows } = await handle.pool.query(
      `select count(*)::int total, count(*) filter (where is_active)::int active,
              count(*) filter (where status='published')::int published, count(*) filter (where status='draft')::int draft,
              count(*) filter (where status='archived')::int archived, sum(amount) s, avg(amount) a from stats_items`,
    )
    const e = rows[0]
    expect(body).toMatchObject({
      total: e.total,
      active_count: e.active,
      inactive_count: e.total - e.active,
      published_count: e.published,
      draft_count: e.draft,
      archived_count: e.archived,
      total_amount: Number(e.s),
      avg_amount: pyRound2(Number(e.a)),
    })
    const cats = await handle.pool.query('select category, count(id)::int c, sum(amount) s from stats_items group by category')
    expect(body.category_stats).toHaveLength(cats.rows.length)
    for (const c of cats.rows) {
      expect(body.category_stats).toContainEqual({ category: c.category || 'general', count: c.c, amount: Number(c.s) })
    }
  })

  it('pyRound2 按 round(x, 2) 语义', () => {
    expect(pyRound2(0.125)).toBe(0.12)
    expect(pyRound2(0.375)).toBe(0.38)
    expect(pyRound2(-0.125)).toBe(-0.12)
    expect(pyRound2(615500.125)).toBe(615500.12)
    expect(pyRound2(2.675)).toBe(2.67)
    expect(pyRound2(1.005)).toBe(1)
    expect(pyRound2(820667.1266666666)).toBe(820667.13)
    expect(pyRound2(0)).toBe(0)
  })

  it('导出 csv（字节精确）、xlsx 读回、GET 筛选、错误分支', async () => {
    const a = (await rowByCode(`${P}a`))!
    const b = (await rowByCode(`${P}b`))!
    const res = await s.inject({
      method: 'POST',
      url: `${B}/export`,
      payload: { ids: [b.id, String(a.id), 1.5, null], fields: ['item_code', 'amount', 'is_active', 'owner', 'bogus'] },
    })
    expect(res.headers['content-disposition']).toBe('attachment; filename=stats_list_page_export.csv')
    expect(res.headers['content-type']).toBe('text/csv; charset=utf-8')
    expect(res.body).toBe(`\ufeff编码,金额,状态,负责人\r\n${P}a,12.35,停用,\r\n${P}b,7,停用,王五\r\n`)

    const x = await s.inject({
      method: 'POST',
      url: `${B}/export`,
      payload: { export_mode: 'filtered', filters: { search: P, status: 'archived' }, file_type: 'xlsx' },
    })
    expect(x.headers['content-disposition']).toBe('attachment; filename=stats_list_page_export.xlsx')
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(x.rawPayload as unknown as ArrayBuffer)
    const values = wb.worksheets[0]!.getRow(2).values as unknown[]
    expect(values.slice(1, 7)).toEqual([String((await rowByCode(`${P}c`))!.id), '丙', `${P}c`, 'risk', 'archived', '-1.5'])

    const g = await s.inject({ url: `${B}/export?search=${P}&fields=name,%20item_code,,x&is_active=1` })
    expect(g.body).toBe(`\ufeff名称,编码\r\n丙,${P}c\r\n`)

    expect((await s.inject({ method: 'POST', url: `${B}/export`, payload: {} })).json()).toEqual({ error: '请先勾选要导出的数据' })
    expect((await s.inject({ method: 'POST', url: `${B}/export`, payload: { ids: { a: 1 } } })).statusCode).toBe(400)
    expect((await s.inject({ method: 'POST', url: `${B}/export`, payload: { ids: ['abc'] } })).statusCode).toBe(500)
    expect((await s.inject({ method: 'POST', url: `${B}/export`, payload: { ids: [1], fields: 3 } })).statusCode).toBe(500)
    const dictFields = await s.inject({ method: 'POST', url: `${B}/export`, payload: { ids: [a.id], fields: { name: 1 } } })
    expect(dictFields.body).toBe('\ufeff名称\r\n甲\r\n')
  })

  it('模板 csv 字节精确 / xlsx', async () => {
    const res = await s.inject({ url: `${B}/template` })
    expect(res.headers['content-disposition']).toBe('attachment; filename=stats_list_page_import_template.csv')
    expect(res.body).toBe(
      '\ufeff名称,编码,分类,发布状态,金额,数量,负责人,优先级,状态,描述\r\n示例商品A,item_001,order,draft,9999,100,admin,10,启用,示例描述\r\n',
    )
    const x = await s.inject({ url: `${B}/template?file_type=xlsx` })
    expect(x.headers['content-disposition']).toBe('attachment; filename=stats_list_page_import_template.xlsx')
    expect(x.rawPayload.subarray(0, 2).toString()).toBe('PK')
  })

  it('导入：成功（新增 + 文件内重复编码按更新计 + 已存在更新）', async () => {
    const csv = `名称,编码,分类,发布状态,金额,数量,负责人,优先级,状态,描述\n新1,${P}i1,order,published,1e3,2,张,1,停用,d\n新1改,${P}i1,,,abc,,,,,\n甲改,${P}a,,,0.5,,,,,\n`
    const res = await s.inject({ method: 'POST', url: `${B}/import`, ...multipartFile('s.csv', csv) })
    expect(res.json()).toEqual({ message: '导入成功', created: 1, updated: 2 })
    expect(await rowByCode(`${P}i1`)).toMatchObject({ name: '新1改', category: 'general', status: 'draft', amount: '0.00', owner: null, is_active: true })
    expect(await rowByCode(`${P}a`)).toMatchObject({ name: '甲改', amount: '0.50' })
  })

  it('导入：错误行整体回滚；状态非法直接 400 且回滚；缺列 / 无文件 / 空内容', async () => {
    const bad = `名称,编码\n好,${P}i2\n,${P}i3\n坏,\n`
    const res = await s.inject({ method: 'POST', url: `${B}/import`, ...multipartFile('s.csv', bad) })
    expect(res.statusCode).toBe(400)
    expect(res.json()).toEqual({
      error: '导入失败，存在错误数据',
      error_count: 2,
      error_rows: [
        { line: 3, reason: '名称和编码不能为空', row: { 名称: '', 编码: `${P}i3` } },
        { line: 4, reason: '名称和编码不能为空', row: { 名称: '坏', 编码: '' } },
      ],
    })
    expect(await rowByCode(`${P}i2`)).toBeUndefined()

    const badStatus = `名称,编码,发布状态\n好,${P}i4,draft\n坏,${P}i5,nope\n`
    const st = await s.inject({ method: 'POST', url: `${B}/import`, ...multipartFile('s.csv', badStatus) })
    expect(st.json()).toEqual({ error: '状态仅支持 draft/published/archived' })
    expect(await rowByCode(`${P}i4`)).toBeUndefined()

    const missing = await s.inject({ method: 'POST', url: `${B}/import`, ...multipartFile('s.csv', '名称,金额\na,1\n') })
    expect(missing.json()).toEqual({ error: '导入文件缺少"名称/编码"列' })
    expect((await s.inject({ method: 'POST', url: `${B}/import` })).json()).toEqual({ error: '请上传导入文件' })
    const headerOnly = await s.inject({ method: 'POST', url: `${B}/import`, ...multipartFile('s.csv', '名称,编码\n') })
    expect(headerOnly.json()).toEqual({ message: '导入成功', created: 0, updated: 0 })
  })

  it('删除：成功后 404', async () => {
    const row = (await rowByCode(`${P}c`))!
    expect((await s.inject({ method: 'DELETE', url: `${B}/${row.id}` })).json()).toEqual({ message: '删除成功' })
    expect((await s.inject({ method: 'DELETE', url: `${B}/${row.id}` })).statusCode).toBe(404)
  })
})
