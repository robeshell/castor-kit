import ExcelJS from 'exceljs'
import { eq, like } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DbHandle } from '@/db/client'
import { dynamic_form_fields, dynamic_form_records } from '@/db/schema'
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

const P = 'ck_test_r4_vt_f_'
const B = '/api/admin/component-center/dynamic-form-page'
let app: FastifyInstance
let handle: DbHandle
let s: AuthedSession
let u: AuthedSession

async function cleanup() {
  await handle.db.delete(dynamic_form_records).where(like(dynamic_form_records.record_code, `${P}%`))
}

async function rowByCode(code: string) {
  const [row] = await handle.db.select().from(dynamic_form_records).where(eq(dynamic_form_records.record_code, code))
  return row
}

async function fieldRows(recordId: number) {
  return handle.db.select().from(dynamic_form_fields).where(eq(dynamic_form_fields.record_id, recordId))
}

beforeAll(async () => {
  handle = openTestDb()
  app = await buildTestApp()
  await cleanup()
  // createFixture cleans up all ck_test_ users (including super), so create the fixture first, then log in as super
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

describe('dynamic-form-page', () => {
  it('新增：记录 + 字段一起写入（空 field_key 跳过，sort_order 缺省取原始下标），响应带 fields', async () => {
    const res = await s.inject({
      method: 'POST',
      url: B,
      payload: {
        title: ' 表单A ',
        record_code: `${P}a`,
        category: '',
        status: 'Published',
        priority: '4',
        is_active: 'false',
        fields: [
          { field_key: ' color ', field_value: ' red ', field_type: '', remark: '' },
          { field_key: '' },
          { field_key: 'size', field_value: 0, sort_order: 'x' },
          { field_key: 'first', sort_order: -1, field_type: 'number', remark: ' r ' },
        ],
      },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body).toMatchObject({ title: '表单A', category: 'general', status: 'published', priority: 4, is_active: false, fields_count: 3 })
    expect(body.fields.map((f: Record<string, unknown>) => [f.field_key, f.field_value, f.field_type, f.sort_order, f.remark])).toEqual([
      ['first', '', 'number', -1, 'r'],
      ['color', 'red', 'text', 0, ''],
      ['size', '', 'text', 2, ''],
    ])
    expect(Object.keys(body.fields[0]).sort()).toEqual(['created_at', 'field_key', 'field_type', 'field_value', 'id', 'record_id', 'remark', 'sort_order'])
    const stored = await fieldRows(body.id)
    expect(stored.find((f) => f.field_key === 'size')!.field_value).toBeNull()

    const b = await s.inject({ method: 'POST', url: B, payload: { title: '表单B', record_code: `${P}b`, category: 'spec', priority: 9, owner: 'ow' } })
    expect(b.json()).toMatchObject({ fields_count: 0, fields: [] })
  })

  it('新增：校验分支（顺序：标题 → 编码 → 重复 → 字段数 → 状态），fields 类型异常 500 且不落库', async () => {
    const post = (payload: object) => s.inject({ method: 'POST', url: B, payload })
    const many = Array.from({ length: 21 }, (_, i) => ({ field_key: `k${i}` }))
    expect((await post({ record_code: 'x', fields: many })).json()).toEqual({ error: '标题不能为空' })
    expect((await post({ title: 'x' })).json()).toEqual({ error: '记录编码不能为空' })
    expect((await post({ title: 'x', record_code: `${P}a`, fields: many })).json()).toEqual({ error: '记录编码已存在' })
    expect((await post({ title: 'x', record_code: `${P}z`, fields: many, status: 'bad' })).json()).toEqual({ error: '动态字段最多支持 20 条' })
    expect((await post({ title: 'x', record_code: `${P}z`, fields: 'x'.repeat(21) })).json()).toEqual({ error: '动态字段最多支持 20 条' })
    expect((await post({ title: 'x', record_code: `${P}z`, status: 'bad' })).json()).toEqual({ error: '状态仅支持 draft/published/archived' })
    expect((await post({ title: 'x', record_code: `${P}z`, fields: 3 })).statusCode).toBe(500)
    const partial = await post({ title: 'x', record_code: `${P}z`, fields: [{ field_key: 'ok' }, 'bad'] })
    expect(partial.statusCode).toBe(500)
    expect(await rowByCode(`${P}z`)).toBeUndefined()
    // Empty values ('' / {} / false) are treated as []
    const empty = await post({ title: 'x', record_code: `${P}e`, fields: {} })
    expect(empty.json().fields).toEqual([])
  })

  it('列表：fields_count、排序、筛选、分页', async () => {
    const res = (await s.inject({ url: `${B}?search=${P}` })).json()
    expect(Object.keys(res).sort()).toEqual(['items', 'page', 'per_page', 'total'])
    expect(res.items.map((i: { record_code: string; fields_count: number }) => [i.record_code, i.fields_count])).toEqual([
      [`${P}b`, 0],
      [`${P}a`, 3],
      [`${P}e`, 0],
    ])
    expect(res.items[0].fields).toBeUndefined()
    const q = async (qs: string) =>
      (await s.inject({ url: `${B}?search=${P}&${qs}` })).json().items.map((i: { record_code: string }) => i.record_code)
    expect(await q('category=spec&owner=OW')).toEqual([`${P}b`])
    expect(await q('status=published&is_active=0')).toEqual([`${P}a`])
    expect((await s.inject({ url: `${B}?search=${P}&per_page=2&page=2` })).json()).toMatchObject({ total: 3, page: 2, per_page: 2 })
  })

  it('详情 / 404 先于 403 / 403 文案', async () => {
    const a = (await rowByCode(`${P}a`))!
    const detail = (await s.inject({ url: `${B}/${a.id}` })).json()
    expect(detail.fields.map((f: { field_key: string }) => f.field_key)).toEqual(['first', 'color', 'size'])
    expect((await u.inject({ url: `${B}/99999999` })).statusCode).toBe(404)
    expect((await u.inject({ url: `${B}/${a.id}` })).json()).toEqual({ error: '无权限查看记录详情' })
    expect((await u.inject({ method: 'PUT', url: `${B}/${a.id}`, payload: {} })).json()).toEqual({ error: '无权限编辑记录' })
    expect((await u.inject({ method: 'DELETE', url: `${B}/${a.id}` })).json()).toEqual({ error: '无权限删除记录' })
    expect((await u.inject({ url: B })).json()).toEqual({ error: '无权限查看动态表单页数据' })
    expect((await u.inject({ method: 'POST', url: B, payload: {} })).json()).toEqual({ error: '无权限新增记录' })
    expect((await u.inject({ method: 'POST', url: `${B}/export`, payload: {} })).json()).toEqual({ error: '无权限导出数据' })
    expect((await u.inject({ url: `${B}/template` })).json()).toEqual({ error: '无权限下载导入模板' })
    expect((await u.inject({ method: 'POST', url: `${B}/import` })).json()).toEqual({ error: '无权限导入数据' })
  })

  it('编辑：只替换字段不改记录 updated_at；fields=[] 清空；fields 缺省不动；同值不写库；失败回滚', async () => {
    const a = (await rowByCode(`${P}a`))!
    const put = (payload: object) => s.inject({ method: 'PUT', url: `${B}/${a.id}`, payload })

    const replaced = await put({ fields: [{ field_key: 'only', field_value: 'v' }] })
    expect(replaced.json()).toMatchObject({ fields_count: 1, fields: [{ field_key: 'only', field_value: 'v', sort_order: 0 }] })
    expect((await rowByCode(`${P}a`))!.updated_at).toBe(a.updated_at)

    const same = await put({ title: '表单A', category: 'general', status: 'PUBLISHED', priority: 4.2, is_active: 'no', record_code: 'ignored' })
    expect(same.json().fields_count).toBe(1)
    expect((await rowByCode(`${P}a`))!).toMatchObject({ updated_at: a.updated_at, record_code: `${P}a` })

    expect((await put({ title: ' ' })).json()).toEqual({ error: '标题不能为空' })
    expect((await put({ fields: Array.from({ length: 21 }, () => ({})) })).json()).toEqual({ error: '动态字段最多支持 20 条' })
    expect((await put({ title: '改', status: 'x' })).json()).toEqual({ error: '状态仅支持 draft/published/archived' })
    expect((await put({ fields: false })).statusCode).toBe(500)
    const rolled = await put({ title: '改', fields: [null] })
    expect(rolled.statusCode).toBe(500)
    expect((await rowByCode(`${P}a`))!.title).toBe('表单A')
    expect(await fieldRows(a.id)).toHaveLength(1)

    const changed = await put({ title: '表单A2', description: ' d ', fields: null })
    expect(changed.json()).toMatchObject({ title: '表单A2', description: 'd', fields_count: 1 })
    expect((await rowByCode(`${P}a`))!.updated_at).not.toBe(a.updated_at)

    expect((await put({ fields: [] })).json()).toMatchObject({ fields_count: 0, fields: [] })
    expect(await fieldRows(a.id)).toHaveLength(0)
    await put({ fields: [{ field_key: 'x' }, { field_key: 'y' }] })
  })

  it('导出 csv 字节精确（含字段数量）/ xlsx 读回 / GET / 错误', async () => {
    const a = (await rowByCode(`${P}a`))!
    const b = (await rowByCode(`${P}b`))!
    const res = await s.inject({
      method: 'POST',
      url: `${B}/export`,
      payload: { ids: [b.id, a.id], fields: ['record_code', 'fields_count', 'category', 'is_active', 'owner'] },
    })
    expect(res.headers['content-disposition']).toBe('attachment; filename=dynamic_form_page_export.csv')
    expect(res.body).toBe(`﻿记录编码,字段数量,分类,启用,负责人\r\n${P}a,2,general,停用,\r\n${P}b,0,spec,启用,ow\r\n`)
    const x = await s.inject({ method: 'POST', url: `${B}/export`, payload: { export_mode: 'filtered', filters: { search: P, category: 'spec' }, file_type: 'xlsx', fields: ['title', 'fields_count'] } })
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(x.rawPayload as unknown as ArrayBuffer)
    const rows: unknown[] = []
    wb.worksheets[0]!.eachRow((row) => rows.push((row.values as unknown[]).slice(1)))
    expect(rows).toEqual([['标题', '字段数量'], ['表单B', '0']])
    const g = await s.inject({ url: `${B}/export?search=${P}&status=published&fields=record_code` })
    expect(g.body).toBe(`﻿记录编码\r\n${P}a\r\n`)
    expect((await s.inject({ method: 'POST', url: `${B}/export`, payload: { ids: 'x' } })).json()).toEqual({ error: '请先勾选要导出的数据' })
  })

  it('模板 csv 字节精确', async () => {
    const res = await s.inject({ url: `${B}/template` })
    expect(res.headers['content-disposition']).toBe('attachment; filename=dynamic_form_page_import_template.csv')
    expect(res.body).toBe('﻿标题,记录编码,分类,发布状态,负责人,优先级,启用,描述\r\n示例表单A,form_001,general,draft,admin,0,启用,示例描述\r\n')
  })

  it('导入：成功（新增 + 更新，字段不受影响）/ 错误行回滚 / 状态非法回滚 / 缺列', async () => {
    const a = (await rowByCode(`${P}a`))!
    const csv = `标题,记录编码,分类,发布状态,负责人,优先级,启用,描述\n新表,${P}i1,config,archived,me,2,停用,d\n表单A3,${P}a,,,,,,\n`
    const ok = await s.inject({ method: 'POST', url: `${B}/import`, ...multipartFile('f.csv', csv) })
    expect(ok.json()).toEqual({ message: '导入成功', created: 1, updated: 1 })
    expect(await rowByCode(`${P}i1`)).toMatchObject({ title: '新表', category: 'config', status: 'archived', owner: 'me', priority: 2, is_active: false })
    expect(await rowByCode(`${P}a`)).toMatchObject({ title: '表单A3', status: 'draft', is_active: true, priority: 0 })
    expect(await fieldRows(a.id)).toHaveLength(2)

    const bad = await s.inject({ method: 'POST', url: `${B}/import`, ...multipartFile('f.csv', `标题,记录编码\n好,${P}i2\n,x\n`) })
    expect(bad.json()).toEqual({ error: '导入失败，存在错误数据', error_count: 1, error_rows: [{ line: 3, reason: '标题和记录编码不能为空', row: { 标题: '', 记录编码: 'x' } }] })
    expect(await rowByCode(`${P}i2`)).toBeUndefined()
    const st = await s.inject({ method: 'POST', url: `${B}/import`, ...multipartFile('f.csv', `标题,记录编码,发布状态\n好,${P}i3,\n坏,${P}i4,x\n`) })
    expect(st.json()).toEqual({ error: '状态仅支持 draft/published/archived' })
    expect(await rowByCode(`${P}i3`)).toBeUndefined()
    const missing = await s.inject({ method: 'POST', url: `${B}/import`, ...multipartFile('f.csv', `标题\nx\n`) })
    expect(missing.json()).toEqual({ error: '导入文件缺少"标题/记录编码"列' })
  })

  it('删除：字段级联删除', async () => {
    const a = (await rowByCode(`${P}a`))!
    expect(await fieldRows(a.id)).toHaveLength(2)
    expect((await s.inject({ method: 'DELETE', url: `${B}/${a.id}` })).json()).toEqual({ message: '删除成功' })
    expect(await rowByCode(`${P}a`)).toBeUndefined()
    expect(await fieldRows(a.id)).toHaveLength(0)
    expect((await s.inject({ method: 'DELETE', url: `${B}/${a.id}` })).statusCode).toBe(404)
  })
})
