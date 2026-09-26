import ExcelJS from 'exceljs'
import { asc, eq, like, sql } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DbHandle } from '@/db/client'
import { login_logs, menus, operation_logs } from '@/db/schema'
import { parseDatetime, pyFromIsoFormat } from '@/modules/admin/logs/schema'
import {
  buildTestApp,
  cleanupFixture,
  createFixture,
  FIXTURE_PASSWORD,
  FIXTURE_USER,
  loginSession,
  multipartFile,
  openTestDb,
  SUPER_USER,
  superAdminSession,
  type AuthedSession,
} from './helpers'

const P = 'ck_test_r1_log_'
let app: FastifyInstance
let handle: DbHandle
let s: AuthedSession
let u: AuthedSession
const loginIds: number[] = []
const opIds: number[] = []

async function cleanup() {
  await handle.db.delete(login_logs).where(like(login_logs.username, `${P}%`))
  await handle.db.delete(operation_logs).where(like(operation_logs.username, `${P}%`))
  await handle.db.delete(operation_logs).where(like(operation_logs.path, `%${P}%`))
  await handle.db.delete(menus).where(like(menus.code, `${P}%`))
}

beforeAll(async () => {
  handle = openTestDb()
  app = await buildTestApp()
  // createFixture cleans up all ck_test_-prefixed data, so it must run before this file creates its own data
  const fx = await createFixture(handle)
  u = await loginSession(app, FIXTURE_USER, FIXTURE_PASSWORD, fx.userId)
  s = await superAdminSession(app, handle)
  await cleanup()
  for (const [username, status, ip, created] of [
    [`${P}alice`, 'success', '1.1.1.1', '2026-01-01 08:00:00'],
    [`${P}alice`, 'failed', null, '2026-01-02 09:30:00.25'],
    [`${P}bob`, 'success', '2.2.2.2', '2026-01-03 10:00:00'],
  ] as const) {
    const [row] = await handle.db
      .insert(login_logs)
      .values({ username, status, ip, user_agent: 'UA', message: status === 'failed' ? '密码错误' : null, created_at: created })
      .returning()
    loginIds.push(row!.id)
  }
  for (const [username, module, action, target, status] of [
    [`${P}alice`, 'menus', 'create', null, 201],
    [`${P}alice`, 'menus', 'update', '12', 200],
    [`${P}bob`, 'roles', 'delete', '3', null],
  ] as const) {
    const [row] = await handle.db
      .insert(operation_logs)
      .values({
        username,
        module,
        action,
        method: 'POST',
        path: `/api/admin/${module}`,
        target_id: target,
        payload: '{"a":1}',
        status_code: status,
        created_at: '2026-02-01 12:00:00',
      })
      .returning()
    opIds.push(row!.id)
  }
})

afterAll(async () => {
  await cleanup()
  await cleanupFixture(handle)
  await app.close()
  await handle.pool.end()
})

describe('日志列表', () => {
  it('登录日志：分页形状、username 模糊、status 精确、倒序', async () => {
    const res = await s.inject({ url: `/api/admin/logs/login?username=${P.toUpperCase()}ALICE&per_page=999` })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(Object.keys(body).sort()).toEqual(['items', 'page', 'per_page', 'total'])
    expect(body).toMatchObject({ total: 2, page: 1, per_page: 200 })
    expect(body.items.map((i: { id: number }) => i.id)).toEqual([loginIds[1], loginIds[0]])
    expect(body.items[0]).toEqual({
      id: loginIds[1],
      username: `${P}alice`,
      user_id: null,
      status: 'failed',
      ip: null,
      user_agent: 'UA',
      message: '密码错误',
      created_at: '2026-01-02T09:30:00.250000',
    })
    const failed = (await s.inject({ url: `/api/admin/logs/login?username=${P}&status=failed` })).json()
    expect(failed.total).toBe(1)
    expect((await s.inject({ url: `/api/admin/logs/login?username=${P}&status=FAILED` })).json().total).toBe(0)
    const page2 = (await s.inject({ url: `/api/admin/logs/login?username=${P}&per_page=2&page=2` })).json()
    expect(page2).toMatchObject({ total: 3, page: 2, per_page: 2 })
    expect(page2.items.map((i: { id: number }) => i.id)).toEqual([loginIds[0]])
  })

  it('操作日志：module / action 精确筛选', async () => {
    const res = (await s.inject({ url: `/api/admin/logs/operation?username=${P}&module=menus&action=update` })).json()
    expect(res.total).toBe(1)
    expect(res.items[0]).toMatchObject({ id: opIds[1], module: 'menus', action: 'update', target_id: '12', payload: '{"a":1}', status_code: 200, created_at: '2026-02-01T12:00:00' })
    expect(Object.keys(res.items[0]).sort()).toEqual(
      ['action', 'api_token_id', 'created_at', 'id', 'ip', 'method', 'module', 'path', 'payload', 'status_code', 'target_id', 'user_agent', 'user_id', 'username'].sort(),
    )
    expect((await s.inject({ url: `/api/admin/logs/operation?username=${P}&module=MENUS` })).json().total).toBe(0)
  })
})

describe('日志导出 / 模板', () => {
  it('登录日志导出 csv 精确字节（选中模式按 id 升序）', async () => {
    const res = await s.inject({ method: 'POST', url: '/api/admin/logs/login/export', payload: { ids: [loginIds[2], String(loginIds[0])] } })
    expect(res.headers['content-disposition']).toBe('attachment; filename=login_logs_export.csv')
    expect(res.body).toBe(
      '﻿ID,用户名,状态,IP 地址,User-Agent,说明,时间\r\n' +
        `${loginIds[0]},${P}alice,success,1.1.1.1,UA,,2026-01-01 08:00:00\r\n` +
        `${loginIds[2]},${P}bob,success,2.2.2.2,UA,,2026-01-03 10:00:00\r\n`,
    )
    expect((await s.inject({ method: 'POST', url: '/api/admin/logs/login/export', payload: { ids: 5 } })).json()).toEqual({
      error: '请先勾选要导出的日志数据',
    })
  })

  it('登录日志导出 filtered + fields', async () => {
    const res = await s.inject({
      method: 'POST',
      url: '/api/admin/logs/login/export',
      payload: { export_mode: 'filtered', filters: { username: `${P}alice`, status: 'failed' }, fields: ['created_at', 'message'] },
    })
    expect(res.body).toBe('﻿时间,说明\r\n2026-01-02 09:30:00,密码错误\r\n')
  })

  it('操作日志导出 csv / xlsx', async () => {
    const csv = await s.inject({
      method: 'POST',
      url: '/api/admin/logs/operation/export',
      payload: { export_mode: 'filtered', filters: { username: P, module: 'roles' } },
    })
    expect(csv.headers['content-disposition']).toBe('attachment; filename=operation_logs_export.csv')
    expect(csv.body).toBe(
      '﻿ID,用户名,模块,操作,方法,路径,目标ID,状态码,IP 地址,User-Agent,请求体,时间\r\n' +
        `${opIds[2]},${P}bob,roles,delete,POST,/api/admin/roles,3,,,,"{""a"":1}",2026-02-01 12:00:00\r\n`,
    )
    const xlsx = await s.inject({
      method: 'POST',
      url: '/api/admin/logs/operation/export',
      payload: { ids: opIds, fields: ['id', 'status_code', 'action'], file_type: 'xlsx' },
    })
    expect(xlsx.headers['content-disposition']).toBe('attachment; filename=operation_logs_export.xlsx')
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(xlsx.rawPayload as unknown as ArrayBuffer)
    const rows: unknown[][] = []
    wb.worksheets[0]!.eachRow((row) => rows.push((row.values as unknown[]).slice(1)))
    expect(rows).toEqual([
      ['ID', '状态码', '操作'],
      [String(opIds[0]), '201', 'create'],
      [String(opIds[1]), '200', 'update'],
      // Empty-string cells match openpyxl: not written (read back as empty)
      [String(opIds[2]), undefined, 'delete'],
    ])
    expect((await s.inject({ method: 'POST', url: '/api/admin/logs/operation/export', payload: {} })).json()).toEqual({
      error: '请先勾选要导出的日志数据',
    })
  })

  it('模板 csv 精确字节', async () => {
    const login = await s.inject({ url: '/api/admin/logs/login/template' })
    expect(login.headers['content-disposition']).toBe('attachment; filename=login_logs_import_template.csv')
    expect(login.body).toBe('﻿用户名,状态,IP 地址,User-Agent,说明,时间\r\ndemo_user,success,127.0.0.1,Mozilla/5.0,导入示例,2026-01-01 10:00:00\r\n')
    const op = await s.inject({ url: '/api/admin/logs/operation/template?file_type=csv' })
    expect(op.body).toBe(
      '﻿用户名,模块,操作,方法,路径,目标ID,状态码,IP 地址,User-Agent,请求体,时间\r\n' +
        'demo_user,users,create,POST,/api/admin/users,,200,127.0.0.1,Mozilla/5.0,"{""username"":""demo""}",2026-01-01 10:00:00\r\n',
    )
    const xlsx = await s.inject({ url: '/api/admin/logs/operation/template?file_type=xlsx' })
    expect(xlsx.headers['content-disposition']).toBe('attachment; filename=operation_logs_import_template.xlsx')
  })
})

describe('日志导入', () => {
  it('登录日志导入：状态映射、user_id 关联、时间解析（naive / Z / 带时区 / 非法 → 当前时间）', async () => {
    const csv =
      '用户名,状态,IP 地址,时间\n' +
      `${P}imp_a,FAIL,9.9.9.9,2026-03-01T10:00:00Z\n` +
      `${P}imp_b,失败,,2026-03-01 10:00:00+00:00\n` +
      `${P}imp_c,whatever,,20260301T1030\n` +
      `${P}imp_d,,,not-a-date\n` +
      `${SUPER_USER},success,,\n`
    const res = await s.inject({ method: 'POST', url: '/api/admin/logs/login/import', ...multipartFile('l.csv', csv) })
    expect(res.json()).toEqual({ message: '导入成功', created: 5, updated: 0 })
    const rows = await handle.db.select().from(login_logs).where(like(login_logs.username, `${P}imp_%`)).orderBy(asc(login_logs.username))
    expect(rows.map((r) => [r.username.slice(P.length), r.status, r.ip])).toEqual([
      ['imp_a', 'failed', '9.9.9.9'],
      ['imp_b', 'failed', null],
      ['imp_c', 'success', null],
      ['imp_d', 'success', null],
    ])
    expect(rows[0]!.created_at).toBe('2026-03-01 10:00:00')
    // With time zone: written as timestamptz, PG converts by the session time zone and stores it in the timestamp column
    const [{ expected }] = (
      await handle.db.execute<{ expected: string }>(sql`SELECT ('2026-03-01 10:00:00+00:00'::timestamptz)::timestamp::text AS expected`)
    ).rows as [{ expected: string }]
    expect(rows[1]!.created_at).toBe(expected)
    expect(rows[2]!.created_at).toBe('2026-03-01 10:30:00')
    const [{ now }] = (await handle.db.execute<{ now: string }>(sql`SELECT timezone('utc', now())::text AS now`)).rows as [{ now: string }]
    expect(rows[3]!.created_at!.slice(0, 10)).toBe(now.slice(0, 10))

    const [superLog] = await handle.db
      .select()
      .from(login_logs)
      .where(eq(login_logs.user_id, s.userId))
      .orderBy(sql`${login_logs.id} DESC`)
      .limit(1)
    expect(superLog!.username).toBe(SUPER_USER)
    await handle.db.delete(login_logs).where(eq(login_logs.id, superLog!.id))
  })

  it('登录日志导入：错误行整体回滚；缺“用户名”列', async () => {
    const csv = `用户名,状态\n${P}rollback,success\n,failed\n`
    const res = await s.inject({ method: 'POST', url: '/api/admin/logs/login/import', ...multipartFile('l.csv', csv) })
    expect(res.statusCode).toBe(400)
    expect(res.json()).toEqual({
      error: '导入失败，存在错误数据',
      error_count: 1,
      error_rows: [{ line: 3, reason: '用户名不能为空', row: { 用户名: '', 状态: 'failed' } }],
    })
    expect(await handle.db.select().from(login_logs).where(eq(login_logs.username, `${P}rollback`))).toHaveLength(0)
    const noUser = multipartFile('l.csv', '状态\nsuccess\n')
    expect((await s.inject({ method: 'POST', url: '/api/admin/logs/login/import', ...noUser })).json()).toEqual({ error: '导入文件缺少“用户名”列' })
  })

  it('操作日志导入：必填列检查、状态码解析、方法大写', async () => {
    const missing = multipartFile('o.csv', '用户名,操作,方法,路径\nx,y,z,w\n')
    expect((await s.inject({ method: 'POST', url: '/api/admin/logs/operation/import', ...missing })).json()).toEqual({
      error: '导入文件缺少必填列: module',
    })

    const bad = multipartFile('o.csv', `用户名,模块,操作,方法,路径\n${P}op_x,m,a,get,/p\n${P}op_y,,a,get,/p\n`)
    const badRes = await s.inject({ method: 'POST', url: '/api/admin/logs/operation/import', ...bad })
    expect(badRes.json()).toMatchObject({ error: '导入失败，存在错误数据', error_count: 1, error_rows: [{ line: 3, reason: '必填字段不能为空' }] })
    expect(await handle.db.select().from(operation_logs).where(eq(operation_logs.username, `${P}op_x`))).toHaveLength(0)

    const good = multipartFile(
      'o.xlsx',
      await (async () => {
        const wb = new ExcelJS.Workbook()
        const ws = wb.addWorksheet('S')
        ws.addRow(['用户名', '模块', '操作', '方法', '路径', '目标ID', '状态码', '请求体', '时间'])
        ws.addRow([`${P}op_a`, 'menus', 'create', 'post', '/api/admin/menus', '', '', ' {"x":1} ', '2026-04-01 01:02:03.5'])
        ws.addRow([`${P}op_b`, 'roles', 'delete', 'Delete', '/api/admin/roles/3', 3, 404, '', 'bad'])
        ws.addRow([`${P}op_c`, 'users', 'update', 'put', '/p', null, '2_0_1', null, null])
        return Buffer.from(await wb.xlsx.writeBuffer())
      })(),
    )
    const ok = await s.inject({ method: 'POST', url: '/api/admin/logs/operation/import', ...good })
    expect(ok.json()).toEqual({ message: '导入成功', created: 3, updated: 0 })
    const rows = await handle.db.select().from(operation_logs).where(like(operation_logs.username, `${P}op_%`)).orderBy(asc(operation_logs.username))
    expect(rows.map((r) => [r.method, r.target_id, r.status_code, r.payload])).toEqual([
      ['POST', null, 200, '{"x":1}'],
      ['DELETE', '3', 404, null],
      ['PUT', null, 201, null],
    ])
    expect(rows[0]!.created_at).toBe('2026-04-01 01:02:03.5')
  })

  it('无文件 / xls', async () => {
    expect((await s.inject({ method: 'POST', url: '/api/admin/logs/operation/import' })).json()).toEqual({ error: '请上传导入文件' })
    expect((await s.inject({ method: 'POST', url: '/api/admin/logs/login/import', ...multipartFile('l.xls', 'x') })).json()).toEqual({
      error: '不支持 .xls 格式，请另存为 .xlsx 后重新上传',
    })
  })
})

describe('操作日志 hook', () => {
  it('写请求自动记录（module/action/target_id/脱敏 payload）；/api/admin/logs 下不记录', async () => {
    const res = await s.inject({ method: 'POST', url: '/api/admin/menus', payload: { name: 'x', code: `${P}hook`, password: 'secret' } })
    expect(res.statusCode).toBe(201)
    const id = res.json().id as number
    await s.inject({ method: 'PUT', url: `/api/admin/menus/${id}`, payload: { name: 'y' } })
    await s.inject({ method: 'POST', url: '/api/admin/menus/export', payload: { ids: [id] } })
    // onResponse runs after the response is sent; wait briefly for the write to finish
    await new Promise((r) => setTimeout(r, 200))
    const logs = await handle.db.select().from(operation_logs).where(eq(operation_logs.user_id, s.userId)).orderBy(asc(operation_logs.id))
    const mine = logs.filter((l) => l.path.startsWith('/api/admin/menus'))
    expect(mine.map((l) => [l.module, l.action, l.target_id, l.status_code])).toEqual([
      ['menus', 'create', null, 201],
      ['menus', 'update', String(id), 200],
      ['menus', 'export', null, 200],
    ])
    expect(mine[0]!.payload).not.toContain('secret')
    await s.inject({ method: 'POST', url: '/api/admin/logs/login/export', payload: {} })
    await new Promise((r) => setTimeout(r, 200))
    const after = await handle.db.select().from(operation_logs).where(like(operation_logs.path, '/api/admin/logs%'))
    expect(after.filter((l) => l.user_id === s.userId)).toHaveLength(0)
    await handle.db.delete(operation_logs).where(eq(operation_logs.user_id, s.userId))
  })
})

describe('parseDatetime（ISO 日期时间解析）', () => {
  it('各类输入样例', () => {
    const f = (x: string) => {
      const r = pyFromIsoFormat(x)
      return r && [r.year, r.month, r.day, r.hour, r.minute, r.second, r.microsecond, r.offsetMicros]
    }
    expect(f('2026-01-01')).toEqual([2026, 1, 1, 0, 0, 0, 0, null])
    expect(f('2026-W01-1')).toEqual([2025, 12, 29, 0, 0, 0, 0, null])
    expect(f('2026-01-01 10.5')).toEqual([2026, 1, 1, 10, 0, 0, 500000, null])
    expect(f('2026-01-01 10:30:00:5')).toEqual([2026, 1, 1, 10, 30, 0, 500000, null])
    expect(f('2026-01-01中10:30-0530')).toEqual([2026, 1, 1, 10, 30, 0, 0, -19800000000])
    expect(f('2026-01-01 ')).toBeNull()
    expect(f('2026-02-30')).toBeNull()
    expect(f('2026-01-01 24:00')).toBeNull()
    expect(f('2026-01-01 10:00+24:00')).toBeNull()
    expect(parseDatetime('  ')).toBe('default')
    expect(parseDatetime(null)).toBe('default')
    expect(parseDatetime('2026-01-01T10:00:00Z')).toMatchObject({ hour: 10, offsetMicros: null })
  })
})

describe('日志权限', () => {
  it('无权限用户 → 403 文案', async () => {
    const cases: [string, string, string][] = [
      ['GET', '/api/admin/logs/login', '无权限访问'],
      ['GET', '/api/admin/logs/operation', '无权限访问'],
      ['POST', '/api/admin/logs/login/export', '无权限导出日志'],
      ['GET', '/api/admin/logs/login/template', '无权限下载日志模板'],
      ['POST', '/api/admin/logs/login/import', '无权限导入日志'],
      ['POST', '/api/admin/logs/operation/export', '无权限导出日志'],
      ['GET', '/api/admin/logs/operation/template', '无权限下载日志模板'],
      ['POST', '/api/admin/logs/operation/import', '无权限导入日志'],
    ]
    for (const [method, url, error] of cases) {
      const res = await u.inject({ method: method as 'GET', url, ...(method === 'GET' ? {} : { payload: {} }) })
      expect(res.statusCode, url).toBe(403)
      expect(res.json()).toEqual({ error })
    }
  })
})
