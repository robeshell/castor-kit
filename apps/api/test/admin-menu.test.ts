import ExcelJS from 'exceljs'
import { eq, like, sql } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DbHandle } from '@/db/client'
import { menus, role_menus, roles } from '@/db/schema'
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
  type Fixture,
} from './helpers'

const P = 'ck_test_r1_menu_'
let app: FastifyInstance
let handle: DbHandle
let s: AuthedSession
let u: AuthedSession
let fx: Fixture
let rootId: number

async function cleanup() {
  // 先删子节点再删父节点（FK 为 CASCADE，这里只是为了不依赖删除顺序）
  await handle.db.delete(menus).where(like(menus.code, `${P}%`))
  await handle.db.delete(roles).where(like(roles.code, `${P}%`))
}

async function menuByCode(code: string) {
  const [row] = await handle.db.select().from(menus).where(eq(menus.code, code))
  return row
}

const post = (url: string, payload: unknown) => s.inject({ method: 'POST', url, payload: payload as object })
const put = (url: string, payload: unknown) => s.inject({ method: 'PUT', url, payload: payload as object })

beforeAll(async () => {
  handle = openTestDb()
  app = await buildTestApp()
  // createFixture 会清理所有 ck_test_ 前缀数据，必须先于本文件自己的数据创建
  fx = await createFixture(handle)
  u = await loginSession(app, FIXTURE_USER, FIXTURE_PASSWORD, fx.userId)
  s = await superAdminSession(app, handle)
  await cleanup()
})

/** 本文件会把 menus 序列拨回去测试 sync_id_sequence；无论成败都恢复到 MAX(id)+1，避免影响其他测试文件 */
async function restoreSequence() {
  await handle.db.execute(sql`SELECT setval(pg_get_serial_sequence('menus', 'id'), COALESCE((SELECT MAX(id) FROM menus), 0) + 1, false)`)
}

afterAll(async () => {
  await restoreSequence()
  await cleanup()
  await cleanupFixture(handle)
  await app.close()
  await handle.pool.end()
})

describe('menus 新增', () => {
  it('201：None 值走模型默认；响应没有 children 键；ID 序列先同步', async () => {
    // 把序列拨回去，模拟显式 ID 插入后序列落后：create 前的 setval 让插入仍然成功
    await handle.db.execute(sql`SELECT setval(pg_get_serial_sequence('menus', 'id'), 1, false)`)
    const res = await post('/api/admin/menus', {
      name: '测试根',
      code: `${P}root`,
      path: '/ck-r1',
      sort_order: null,
      is_visible: null,
      is_active: 1,
      menu_type: null,
      parent_id: null,
    })
    await restoreSequence()
    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body).toMatchObject({ name: '测试根', code: `${P}root`, sort_order: 0, is_visible: true, is_active: true, menu_type: 'menu', icon: null })
    expect('children' in body).toBe(false)
    expect(Object.keys(body).sort()).toEqual(
      ['code', 'component', 'created_at', 'description', 'icon', 'id', 'is_active', 'is_visible', 'menu_type', 'name', 'parent_id', 'path', 'sort_order', 'updated_at'].sort(),
    )
    const [{ max }] = (await handle.db.execute<{ max: number }>(sql`SELECT MAX(id) AS max FROM menus`)).rows as [{ max: number }]
    expect(body.id).toBe(max)
    rootId = body.id
  })

  it('字段转换与 SQLAlchemy/psycopg2 一致：float 四舍五入、数字字符串、list → PG 数组文本、raw code 不 strip', async () => {
    const res = await post('/api/admin/menus', {
      name: ['a b', null, ''],
      code: `${P}c1`,
      parent_id: String(rootId),
      sort_order: 5.5,
      is_visible: 0,
      menu_type: 5,
      description: true,
    })
    expect(res.statusCode).toBe(201)
    expect(res.json()).toMatchObject({ name: '{"a b",NULL,""}', parent_id: rootId, sort_order: 6, is_visible: false, menu_type: '5', description: 'true' })

    const neg = await post('/api/admin/menus', { name: ' x ', code: `${P}c2`, parent_id: rootId, sort_order: ' -2 ' })
    expect(neg.json()).toMatchObject({ name: ' x ', sort_order: -2 })
    const half = await post('/api/admin/menus', { name: 'x', code: `${P}c3`, parent_id: rootId, sort_order: -2.5 })
    expect(half.json().sort_order).toBe(-3)
  })

  it('校验：名称/编码为空、编码重复、非法值 → 500 且不落库', async () => {
    expect((await post('/api/admin/menus', { name: ' ', code: 'x' })).json()).toEqual({ error: '菜单名称和编码不能为空' })
    expect((await post('/api/admin/menus', { name: 'x', code: [] })).json()).toEqual({ error: '菜单名称和编码不能为空' })
    expect((await post('/api/admin/menus', {})).json()).toEqual({ error: '菜单名称和编码不能为空' })
    const dup = await post('/api/admin/menus', { name: 'x', code: `${P}root` })
    expect(dup.statusCode).toBe(400)
    expect(dup.json()).toEqual({ error: `菜单编码 ${P}root 已存在` })

    for (const extra of [
      { code: 5 },
      { code: true },
      { parent_id: '' },
      { parent_id: 99999999 },
      { sort_order: true },
      { sort_order: '1.5' },
      { sort_order: [1] },
      { is_visible: 'yes' },
      { is_visible: 2 },
      { description: { a: 1 } },
    ]) {
      const res = await post('/api/admin/menus', { name: 'x', code: `${P}bad`, ...extra })
      expect(res.statusCode, JSON.stringify(extra)).toBe(500)
      expect(res.json()).toEqual({ error: '服务器内部错误，请稍后重试' })
    }
    expect(await menuByCode(`${P}bad`)).toBeUndefined()
    // 请求体为真值非对象 → 500；假值当作 {}
    expect((await post('/api/admin/menus', [1])).statusCode).toBe(500)
    expect((await post('/api/admin/menus', [])).json()).toEqual({ error: '菜单名称和编码不能为空' })
    expect((await post(`/api/admin/menus/${rootId}/sort`, [1])).statusCode).toBe(500)
    expect((await put(`/api/admin/menus/${rootId}`, ['name'])).statusCode).toBe(500)
    expect((await post('/api/admin/menus/export', [1])).statusCode).toBe(500)
  })
})

describe('menus 列表 / 详情', () => {
  it('详情：递归 children，按 sort_order 排序，叶子 children=[]', async () => {
    const res = await s.inject({ url: `/api/admin/menus/${rootId}` })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.children.map((c: { code: string }) => c.code)).toEqual([`${P}c3`, `${P}c2`, `${P}c1`])
    expect(body.children[0].children).toEqual([])
  })

  it('tree：search 只过滤根节点，子节点完整；flat：平铺且没有 children 键', async () => {
    const tree = (await s.inject({ url: `/api/admin/menus?search=${P}ROOT` })).json()
    expect(tree).toHaveLength(1)
    expect(tree[0].children).toHaveLength(3)
    // 子节点匹配 search 但不是根 → tree 里不出现
    expect((await s.inject({ url: `/api/admin/menus?search=${P}c1` })).json()).toEqual([])

    const flat = (await s.inject({ url: `/api/admin/menus?format=flat&search=${P}` })).json()
    expect(flat.map((m: { code: string }) => m.code)).toEqual([`${P}c3`, `${P}c2`, `${P}root`, `${P}c1`])
    expect(flat.every((m: object) => !('children' in m))).toBe(true)
    // format 为空字符串也按 flat 处理
    expect((await s.inject({ url: `/api/admin/menus?format=&search=${P}c1` })).json()).toHaveLength(1)
  })

  it('全量 tree：根节点按 (sort_order, id)，每个节点都有 children', async () => {
    const tree = (await s.inject({ url: '/api/admin/menus' })).json()
    const [{ n }] = (await handle.db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM menus WHERE parent_id IS NULL`)).rows as [{ n: number }]
    expect(tree).toHaveLength(n)
    const walk = (nodes: { children: unknown[] }[]): boolean => nodes.every((x) => Array.isArray(x.children) && walk(x.children as never))
    expect(walk(tree)).toBe(true)
  })

  it('404 / 非数字 id / 成环 → 500', async () => {
    expect((await s.inject({ url: '/api/admin/menus/99999999' })).json()).toEqual({ error: '资源不存在' })
    expect((await s.inject({ url: '/api/admin/menus/99999999999' })).statusCode).toBe(404)
    expect((await s.inject({ url: '/api/admin/menus/abc' })).statusCode).toBe(404)
    const c1 = (await menuByCode(`${P}c1`))!
    // parent_id 指向自身：Python 递归 to_dict 抛 RecursionError → 500
    await handle.db.update(menus).set({ parent_id: c1.id }).where(eq(menus.id, c1.id))
    expect((await s.inject({ url: `/api/admin/menus/${c1.id}` })).statusCode).toBe(500)
    await handle.db.update(menus).set({ parent_id: rootId }).where(eq(menus.id, c1.id))
  })
})

describe('menus 编辑 / 删除 / 排序', () => {
  it('编辑：值未变化时不 UPDATE（updated_at 不变）；变化时刷新', async () => {
    const before = (await menuByCode(`${P}c2`))!
    const same = await put(`/api/admin/menus/${before.id}`, { name: ' x ', sort_order: -2, is_active: 1, code: `${P}c2` })
    expect(same.statusCode).toBe(200)
    expect(same.json().updated_at).toBe((await s.inject({ url: `/api/admin/menus/${before.id}` })).json().updated_at)
    expect((await menuByCode(`${P}c2`))!.updated_at).toBe(before.updated_at)

    const changed = await put(`/api/admin/menus/${before.id}`, { name: 'c2', sort_order: '-2', icon: 'IconX', unknown: 1 })
    expect(changed.json()).toMatchObject({ name: 'c2', sort_order: -2, icon: 'IconX' })
    expect((await menuByCode(`${P}c2`))!.updated_at).not.toBe(before.updated_at)
  })

  it('编辑校验：空名称/空编码、编码冲突、非法值 → 500；404 先于权限；非数字 405', async () => {
    const c2 = (await menuByCode(`${P}c2`))!
    expect((await put(`/api/admin/menus/${c2.id}`, { name: '' })).json()).toEqual({ error: '菜单名称不能为空' })
    expect((await put(`/api/admin/menus/${c2.id}`, { code: null })).json()).toEqual({ error: '菜单编码不能为空' })
    expect((await put(`/api/admin/menus/${c2.id}`, { code: `${P}c1` })).json()).toEqual({ error: `菜单编码 ${P}c1 已存在` })
    expect((await put(`/api/admin/menus/${c2.id}`, { code: 5 })).statusCode).toBe(500)
    expect((await put(`/api/admin/menus/${c2.id}`, { is_visible: 'no', name: 'zz' })).statusCode).toBe(500)
    expect((await menuByCode(`${P}c2`))!.name).toBe('c2')
    expect((await u.inject({ method: 'PUT', url: '/api/admin/menus/99999999', payload: {} })).statusCode).toBe(404)
    expect((await put('/api/admin/menus/abc', {})).statusCode).toBe(405)
  })

  it('排序：上下移动并按 10,20,30 重排；边界与校验分支', async () => {
    const [c3, c2, c1] = [(await menuByCode(`${P}c3`))!, (await menuByCode(`${P}c2`))!, (await menuByCode(`${P}c1`))!]
    const sort = (id: number, direction: unknown) => post(`/api/admin/menus/${id}/sort`, { direction })
    expect((await sort(c3.id, 'up')).json()).toEqual({ message: '当前菜单已在最前', changed: false })
    expect((await sort(c1.id, 'down')).json()).toEqual({ message: '当前菜单已在最后', changed: false })
    expect((await sort(rootId, 'sideways')).json()).toEqual({ error: 'direction 参数必须是 up 或 down' })
    expect((await s.inject({ method: 'POST', url: `/api/admin/menus/${c1.id}/sort` })).json()).toEqual({ error: 'direction 参数必须是 up 或 down' })

    expect((await sort(c1.id, ' UP ')).json()).toEqual({ message: '排序成功', changed: true })
    const detail = (await s.inject({ url: `/api/admin/menus/${rootId}` })).json()
    expect(detail.children.map((c: { code: string; sort_order: number }) => [c.code, c.sort_order])).toEqual([
      [`${P}c3`, 10],
      [`${P}c1`, 20],
      [`${P}c2`, 30],
    ])
    expect((await sort(c2.id, 'down')).json()).toEqual({ message: '当前菜单已在最后', changed: false })

    const leaf = await post('/api/admin/menus', { name: '孙', code: `${P}g1`, parent_id: c3.id })
    expect((await sort(leaf.json().id, 'down')).json()).toEqual({ message: '当前层级只有一个菜单，无需排序', changed: false })
    expect((await sort(99999999, 'up')).json()).toEqual({ error: '资源不存在' })
    // 排序接口先检查权限再 404
    expect((await u.inject({ method: 'POST', url: '/api/admin/menus/99999999/sort', payload: { direction: 'up' } })).json()).toEqual({
      error: '无权限排序菜单',
    })
  })

  it('删除：有子菜单 400；叶子删除并级联 role_menus', async () => {
    expect((await s.inject({ method: 'DELETE', url: `/api/admin/menus/${rootId}` })).json()).toEqual({ error: '该菜单下还有子菜单，无法删除' })
    const g1 = (await menuByCode(`${P}g1`))!
    const [role] = await handle.db.insert(roles).values({ name: 'r', code: `${P}role` }).returning()
    await handle.db.insert(role_menus).values({ role_id: role!.id, menu_id: g1.id })
    expect((await s.inject({ method: 'DELETE', url: `/api/admin/menus/${g1.id}` })).json()).toEqual({ message: '删除成功' })
    expect(await menuByCode(`${P}g1`)).toBeUndefined()
    expect(await handle.db.select().from(role_menus).where(eq(role_menus.role_id, role!.id))).toHaveLength(0)
    expect((await s.inject({ method: 'DELETE', url: '/api/admin/menus/99999999' })).statusCode).toBe(404)
  })
})

describe('menus 导出 / 模板 / 导入', () => {
  it('导出 csv 精确字节：filtered 按 (sort_order, id)，含 parent_code / 是否', async () => {
    await put(`/api/admin/menus/${(await menuByCode(`${P}c3`))!.id}`, { is_visible: false, path: '/p,"q"' })
    const res = await post('/api/admin/menus/export', {
      export_mode: 'filtered',
      filters: { search: `${P}c` },
      fields: ['code', 'parent_code', 'sort_order', 'is_visible', 'is_active', 'path'],
    })
    expect(res.headers['content-disposition']).toBe('attachment; filename=menus_export.csv')
    expect(res.body).toBe(
      '﻿菜单编码,父级编码,排序,是否显示,是否启用,路径\r\n' +
        `${P}c3,${P}root,10,否,是,"/p,""q"""\r\n` +
        `${P}c1,${P}root,20,否,是,\r\n` +
        `${P}c2,${P}root,30,是,是,\r\n`,
    )
  })

  it('导出选中 xlsx；未勾选 400', async () => {
    expect((await post('/api/admin/menus/export', { ids: [] })).json()).toEqual({ error: '请先勾选要导出的菜单数据' })
    const res = await post('/api/admin/menus/export', { ids: [rootId], file_type: 'xlsx' })
    expect(res.headers['content-disposition']).toBe('attachment; filename=menus_export.xlsx')
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(res.rawPayload as unknown as ArrayBuffer)
    const rows: unknown[][] = []
    wb.worksheets[0]!.eachRow((row) => rows.push((row.values as unknown[]).slice(1)))
    expect(rows[0]).toEqual(['ID', '菜单名称', '菜单编码', '类型', '路径', '组件', '图标', '父级编码', '排序', '是否显示', '是否启用', '描述'])
    expect(rows[1]!.slice(0, 5)).toEqual([String(rootId), '测试根', `${P}root`, 'menu', '/ck-r1'])
  })

  it('模板 csv 精确字节', async () => {
    const res = await s.inject({ url: '/api/admin/menus/template' })
    expect(res.headers['content-disposition']).toBe('attachment; filename=menus_import_template.csv')
    expect(res.body).toBe(
      '﻿菜单名称,菜单编码,类型,路径,组件,图标,父级编码,排序,是否显示,是否启用,描述\r\n示例菜单,demo_menu,menu,/demo/menu,DemoMenu,IconApps,,99,是,是,示例描述\r\n',
    )
  })

  it('导入：有错误整体回滚（第一轮校验错误在前，父级错误在后）', async () => {
    const csv =
      '菜单名称,菜单编码,类型,父级编码\n' +
      `新,${P}i1,menu,${P}missing\n` +
      `,${P}i2,menu,\n` +
      `坏,${P}i3,page,\n` +
      `自,${P}i4,button,${P}i4\n`
    const res = await s.inject({ method: 'POST', url: '/api/admin/menus/import', ...multipartFile('m.csv', csv) })
    expect(res.statusCode).toBe(400)
    const body = res.json()
    expect(body.error_count).toBe(4)
    expect(body.error_rows.map((r: { line: number; reason: string }) => [r.line, r.reason])).toEqual([
      [3, '菜单名称和编码不能为空'],
      [4, '类型无效: page'],
      [2, `父级编码不存在: ${P}missing`],
      [5, '父级编码不能等于自身编码'],
    ])
    expect(await menuByCode(`${P}i1`)).toBeUndefined()
  })

  it('导入成功：父级可在同一文件后面定义；更新已有菜单（空父级 → 移到根，空排序 → 0）', async () => {
    const csv =
      '菜单名称,菜单编码,类型,路径,父级编码,排序,是否显示,是否启用,描述\n' +
      `子,${P}i1,menu,/i1,${P}i2,5,否,停用,d\n` +
      `父,${P}i2,directory,,,x,maybe,,\n` +
      `改,${P}c2,button,,,,,,\n`
    const res = await s.inject({ method: 'POST', url: '/api/admin/menus/import', ...multipartFile('m.csv', csv) })
    expect(res.json()).toEqual({ message: '导入成功', created: 2, updated: 1 })
    const i1 = (await menuByCode(`${P}i1`))!
    const i2 = (await menuByCode(`${P}i2`))!
    expect(i1).toMatchObject({ parent_id: i2.id, sort_order: 5, is_visible: false, is_active: false, path: '/i1', description: 'd' })
    expect(i2).toMatchObject({ parent_id: null, sort_order: 0, is_visible: true, is_active: true, menu_type: 'directory', path: null })
    expect(i1.id).toBeLessThan(i2.id)
    expect(await menuByCode(`${P}c2`)).toMatchObject({ name: '改', menu_type: 'button', parent_id: null, sort_order: 0, icon: null })
  })

  it('导入：缺列 / 无文件 / xls', async () => {
    const noName = multipartFile('m.csv', '菜单编码,类型\nx,menu\n')
    expect((await s.inject({ method: 'POST', url: '/api/admin/menus/import', ...noName })).json()).toEqual({ error: '导入文件缺少“菜单名称/菜单编码”列' })
    expect((await s.inject({ method: 'POST', url: '/api/admin/menus/import' })).json()).toEqual({ error: '请上传导入文件' })
    expect((await s.inject({ method: 'POST', url: '/api/admin/menus/import', ...multipartFile('m.xls', 'x') })).statusCode).toBe(400)
  })
})

describe('menus 权限 / my-menus', () => {
  it('my-menus：夹具用户只看到启用且可见菜单及其祖先，叶子无 children 键', async () => {
    const res = await u.inject({ url: '/api/admin/my-menus' })
    expect(res.statusCode).toBe(200)
    const tree = res.json()
    const root = tree.find((m: { id: number }) => m.id === fx.rootId)
    expect(root.children.map((c: { id: number }) => c.id)).toEqual([fx.childId])
    expect('children' in root.children[0]).toBe(false)
  })

  it('无权限用户 → 403 文案（GET/PUT/DELETE 先 404 再 403）', async () => {
    const cases: [string, string, string][] = [
      ['GET', '/api/admin/menus', '无权限查看菜单列表'],
      ['POST', '/api/admin/menus', '无权限新增菜单'],
      ['GET', `/api/admin/menus/${rootId}`, '无权限查看菜单'],
      ['PUT', `/api/admin/menus/${rootId}`, '无权限编辑菜单'],
      ['DELETE', `/api/admin/menus/${rootId}`, '无权限删除菜单'],
      ['POST', `/api/admin/menus/${rootId}/sort`, '无权限排序菜单'],
      ['POST', '/api/admin/menus/export', '无权限导出菜单'],
      ['GET', '/api/admin/menus/template', '无权限下载菜单导入模板'],
      ['POST', '/api/admin/menus/import', '无权限导入菜单'],
    ]
    for (const [method, url, error] of cases) {
      const res = await u.inject({ method: method as 'GET', url, ...(method === 'GET' || method === 'DELETE' ? {} : { payload: {} }) })
      expect(res.statusCode, url).toBe(403)
      expect(res.json()).toEqual({ error })
    }
    expect((await u.inject({ url: '/api/admin/menus/99999999' })).statusCode).toBe(404)
  })
})
