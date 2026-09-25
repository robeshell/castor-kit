import ExcelJS from 'exceljs'
import { eq, like } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DbHandle } from '@/db/client'
import { card_items } from '@/db/schema'
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

const P = 'ck_test_r4_vt_c_'
const B = '/api/admin/component-center/card-list-page'
let app: FastifyInstance
let handle: DbHandle
let s: AuthedSession
let u: AuthedSession

async function cleanup() {
  await handle.db.delete(card_items).where(like(card_items.card_code, `${P}%`))
}

async function rowByCode(code: string) {
  const [row] = await handle.db.select().from(card_items).where(eq(card_items.card_code, code))
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

describe('card-list-page', () => {
  it('新增：201 + 字段归一化；校验分支', async () => {
    const body = await create({
      title: ' 卡A ',
      card_code: `${P}a`,
      subtitle: '',
      category: null,
      cover_url: ' http://x/y.png ',
      tag: 5,
      status: 'ARCHIVED',
      owner: 'me',
      priority: '7',
      is_active: '0',
      description: 'd',
    })
    expect(body).toMatchObject({
      title: '卡A',
      subtitle: null,
      category: 'general',
      cover_url: 'http://x/y.png',
      tag: '5',
      status: 'archived',
      owner: 'me',
      priority: 7,
      is_active: false,
      description: 'd',
    })
    expect(Object.keys(body).sort()).toEqual(
      ['card_code', 'category', 'cover_url', 'created_at', 'description', 'id', 'is_active', 'owner', 'priority', 'status', 'subtitle', 'tag', 'title', 'updated_at'],
    )
    await create({ title: '卡B', card_code: `${P}b`, category: 'product', priority: 9 })

    const post = (payload: object) => s.inject({ method: 'POST', url: B, payload })
    expect((await post({ card_code: 'x' })).json()).toEqual({ error: '标题不能为空' })
    expect((await post({ title: 'x' })).json()).toEqual({ error: '编码不能为空' })
    expect((await post({ title: 'x', card_code: ` ${P}a ` })).json()).toEqual({ error: '编码已存在' })
    expect((await post({ title: 'x', card_code: `${P}z`, status: 'x' })).json()).toEqual({ error: '状态仅支持 draft/published/archived' })
  })

  it('列表：排序、分页、筛选', async () => {
    const q = async (qs = '') =>
      (await s.inject({ url: `${B}?search=${P}${qs}` })).json().items.map((i: { card_code: string }) => i.card_code)
    expect(await q()).toEqual([`${P}b`, `${P}a`])
    expect(await q('&category=product')).toEqual([`${P}b`])
    expect(await q('&status=archived&is_active=false')).toEqual([`${P}a`])
    expect(await q('&owner=ME')).toEqual([`${P}a`])
    const paged = (await s.inject({ url: `${B}?search=${P}&per_page=1&page=2` })).json()
    expect(paged).toMatchObject({ total: 2, page: 2, per_page: 1 })
    expect(paged.items[0].card_code).toBe(`${P}a`)
  })

  it('详情 / 编辑（同值不写库、变更、校验、失败不落库）/ 404 先于 403', async () => {
    const a = (await rowByCode(`${P}a`))!
    expect((await s.inject({ url: `${B}/${a.id}` })).json()).toMatchObject({ id: a.id, title: '卡A' })
    expect((await u.inject({ url: `${B}/99999999` })).statusCode).toBe(404)
    expect((await u.inject({ url: `${B}/${a.id}` })).json()).toEqual({ error: '无权限查看记录详情' })
    expect((await u.inject({ method: 'PUT', url: `${B}/${a.id}`, payload: {} })).json()).toEqual({ error: '无权限编辑记录' })
    expect((await u.inject({ method: 'DELETE', url: `${B}/${a.id}` })).json()).toEqual({ error: '无权限删除记录' })
    expect((await u.inject({ url: B })).json()).toEqual({ error: '无权限查看卡片列表页数据' })
    expect((await u.inject({ method: 'POST', url: B, payload: {} })).json()).toEqual({ error: '无权限新增记录' })
    expect((await u.inject({ method: 'POST', url: `${B}/export`, payload: {} })).json()).toEqual({ error: '无权限导出数据' })
    expect((await u.inject({ url: `${B}/template` })).json()).toEqual({ error: '无权限下载导入模板' })
    expect((await u.inject({ method: 'POST', url: `${B}/import` })).json()).toEqual({ error: '无权限导入数据' })

    const same = await s.inject({
      method: 'PUT',
      url: `${B}/${a.id}`,
      payload: { title: '卡A', subtitle: null, tag: '5', status: 'archived', priority: 'bad', is_active: 'maybe', cover_url: 'http://x/y.png' },
    })
    expect(same.statusCode).toBe(200)
    expect((await rowByCode(`${P}a`))!.updated_at).toBe(a.updated_at)

    const put = (payload: object) => s.inject({ method: 'PUT', url: `${B}/${a.id}`, payload })
    expect((await put({ title: '' })).json()).toEqual({ error: '标题不能为空' })
    expect((await put({ card_code: '' })).json()).toEqual({ error: '编码不能为空' })
    expect((await put({ card_code: `${P}b` })).json()).toEqual({ error: '编码已存在' })
    expect((await put({ tag: 'new', status: 'bad' })).json()).toEqual({ error: '状态仅支持 draft/published/archived' })
    expect((await rowByCode(`${P}a`))!.tag).toBe('5')

    const changed = await put({ tag: '', cover_url: '', category: '', is_active: '启用', card_code: `${P}a` })
    expect(changed.json()).toMatchObject({ tag: null, cover_url: null, category: 'general', is_active: true })
    expect((await rowByCode(`${P}a`))!.updated_at).not.toBe(a.updated_at)
  })

  it('导出 csv 字节精确 / xlsx 读回 / GET / 错误', async () => {
    const a = (await rowByCode(`${P}a`))!
    const b = (await rowByCode(`${P}b`))!
    const res = await s.inject({
      method: 'POST',
      url: `${B}/export`,
      payload: { ids: [b.id, a.id], fields: ['title', 'subtitle', 'tag', 'is_active', 'cover_url', 'priority'] },
    })
    expect(res.headers['content-disposition']).toBe('attachment; filename=card_list_page_export.csv')
    expect(res.body).toBe('\ufeff标题,副标题,标签,状态,优先级\r\n卡A,,,启用,7\r\n卡B,,,启用,9\r\n')
    const x = await s.inject({ method: 'POST', url: `${B}/export`, payload: { export_mode: 'filtered', filters: { search: P }, file_type: 'xlsx', fields: ['card_code'] } })
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(x.rawPayload as unknown as ArrayBuffer)
    const col: unknown[] = []
    wb.worksheets[0]!.eachRow((row) => col.push((row.values as unknown[])[1]))
    expect(col).toEqual(['编码', `${P}a`, `${P}b`])
    const g = await s.inject({ url: `${B}/export?search=${P}&category=product&fields=card_code` })
    expect(g.body).toBe(`\ufeff编码\r\n${P}b\r\n`)
    expect((await s.inject({ method: 'POST', url: `${B}/export`, payload: { ids: [] } })).json()).toEqual({ error: '请先勾选要导出的数据' })
    expect((await s.inject({ method: 'POST', url: `${B}/export`, payload: { ids: [true] } })).statusCode).toBe(500)
  })

  it('模板 csv 字节精确', async () => {
    const res = await s.inject({ url: `${B}/template?file_type=xls` })
    expect(res.headers['content-disposition']).toBe('attachment; filename=card_list_page_import_template.csv')
    expect(res.body).toBe(
      '\ufeff标题,编码,副标题,分类,标签,发布状态,负责人,优先级,状态,描述\r\n示例卡片A,card_001,副标题示例,product,新品,draft,admin,10,启用,示例描述\r\n',
    )
  })

  it('导入：成功 / 错误行回滚 / 状态非法回滚 / 缺列', async () => {
    const csv = `标题,编码,副标题,分类,标签,发布状态,负责人,优先级,状态,描述\n新卡,${P}i1,副,event,热,published,me,3,停用,d\n卡B,${P}b,,product,,,,9,,\n`
    const ok = await s.inject({ method: 'POST', url: `${B}/import`, ...multipartFile('c.csv', csv) })
    expect(ok.json()).toEqual({ message: '导入成功', created: 1, updated: 1 })
    expect(await rowByCode(`${P}i1`)).toMatchObject({ title: '新卡', subtitle: '副', category: 'event', tag: '热', status: 'published', is_active: false })

    const bad = await s.inject({ method: 'POST', url: `${B}/import`, ...multipartFile('c.csv', `标题,编码\n好,${P}i2\n,x\n`) })
    expect(bad.json()).toMatchObject({ error: '导入失败，存在错误数据', error_count: 1, error_rows: [{ line: 3, reason: '标题和编码不能为空' }] })
    expect(await rowByCode(`${P}i2`)).toBeUndefined()

    const st = await s.inject({ method: 'POST', url: `${B}/import`, ...multipartFile('c.csv', `标题,编码,发布状态\n好,${P}i3,\n坏,${P}i4,x\n`) })
    expect(st.json()).toEqual({ error: '状态仅支持 draft/published/archived' })
    expect(await rowByCode(`${P}i3`)).toBeUndefined()

    const missing = await s.inject({ method: 'POST', url: `${B}/import`, ...multipartFile('c.csv', '编码\nx\n') })
    expect(missing.json()).toEqual({ error: '导入文件缺少"标题/编码"列' })
  })

  it('删除', async () => {
    const b = (await rowByCode(`${P}b`))!
    expect((await s.inject({ method: 'DELETE', url: `${B}/${b.id}` })).json()).toEqual({ message: '删除成功' })
    expect(await rowByCode(`${P}b`)).toBeUndefined()
  })
})
