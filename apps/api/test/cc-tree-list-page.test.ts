import { eq, like } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DbHandle } from '@/db/client'
import { tree_nodes } from '@/db/schema'
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

const P = 'ck_test_r4_vt_t_'
const B = '/api/admin/component-center/tree-list-page'
let app: FastifyInstance
let handle: DbHandle
let s: AuthedSession
let u: AuthedSession
const ids: Record<string, number> = {}

async function cleanup() {
  await handle.db.delete(tree_nodes).where(like(tree_nodes.node_code, `${P}%`))
}

async function rowByCode(code: string) {
  const [row] = await handle.db.select().from(tree_nodes).where(eq(tree_nodes.node_code, code))
  return row
}

interface TreeDictNode {
  node_code: string
  children: TreeDictNode[]
  children_count: number
}

/** 只保留本测试前缀的根（及其子树），转成 code → children codes 的简表 */
function shape(nodes: TreeDictNode[]): unknown[] {
  return nodes
    .filter((n) => n.node_code.startsWith(P))
    .map((n) => ({ code: n.node_code.slice(P.length), count: n.children_count, children: shape(n.children) }))
}

beforeAll(async () => {
  handle = openTestDb()
  app = await buildTestApp()
  await cleanup()
  // createFixture 会清理所有 ck_test_ 用户（含 super），所以先建夹具再登录 super
  const fx = await createFixture(handle)
  u = await loginSession(app, FIXTURE_USER, FIXTURE_PASSWORD, fx.userId)
  s = await superAdminSession(app, handle)
})

afterAll(async () => {
  await handle.db.update(tree_nodes).set({ parent_id: null }).where(like(tree_nodes.node_code, `${P}%`))
  await cleanup()
  await cleanupFixture(handle)
  await app.close()
  await handle.pool.end()
})

describe('tree-list-page', () => {
  it('新增：根 / 子节点 / 归一化；各校验分支', async () => {
    const post = (payload: object) => s.inject({ method: 'POST', url: B, payload })
    const root = await post({ name: ' 根 ', node_code: `${P}root`, sort_order: '2', node_type: '', icon: ' ', status: 'Inactive' })
    expect(root.statusCode).toBe(201)
    expect(root.json()).toMatchObject({ name: '根', parent_id: null, node_type: 'category', icon: null, sort_order: 2, status: 'inactive', is_active: true })
    ids.root = root.json().id
    for (const [code, extra] of [
      ['c1', { sort_order: 5 }],
      ['c2', { sort_order: 1, is_active: false, owner: 'ow' }],
      ['c3', { sort_order: 1, node_type: 'item' }],
    ] as const) {
      const res = await post({ name: code, node_code: `${P}${code}`, parent_id: String(ids.root), ...extra })
      expect(res.json().parent_id).toBe(ids.root)
      ids[code] = res.json().id
    }
    const gc = await post({ name: 'gc', node_code: `${P}gc`, parent_id: ids.c2, is_active: 'no' })
    ids.gc = gc.json().id
    // parent_id 非法字符串 → None
    ids.solo = (await post({ name: 'solo', node_code: `${P}solo`, parent_id: 'abc', sort_order: 1 })).json().id
    expect((await rowByCode(`${P}solo`))!.parent_id).toBeNull()

    expect((await post({ node_code: 'x' })).json()).toEqual({ error: '节点名称不能为空' })
    expect((await post({ name: 'x' })).json()).toEqual({ error: '节点编码不能为空' })
    expect((await post({ name: 'x', node_code: `${P}root` })).json()).toEqual({ error: '节点编码已存在' })
    expect((await post({ name: 'x', node_code: `${P}zz`, parent_id: 99999999 })).json()).toEqual({ error: '父节点不存在' })
    expect((await post({ name: 'x', node_code: `${P}zz`, parent_id: '99999999999' })).json()).toEqual({ error: '父节点不存在' })
    expect((await post({ name: 'x', node_code: `${P}zz`, status: 'draft' })).json()).toEqual({ error: '状态仅支持 active/inactive/archived' })
    // parent_id=0 跳过存在性校验，外键失败 → 500 通用文案
    const zero = await post({ name: 'x', node_code: `${P}zz`, parent_id: 0 })
    expect(zero.statusCode).toBe(500)
    expect(zero.json()).toEqual({ error: '服务器内部错误，请稍后重试' })
    expect(await rowByCode(`${P}zz`)).toBeUndefined()
  })

  it('/tree：递归组装、children_count、根按 (sort_order, id) 排序、父节点被过滤时子节点成为根', async () => {
    const full = (await s.inject({ url: `${B}/tree?search=${P}` })).json()
    expect(shape(full)).toEqual([
      { code: 'solo', count: 0, children: [] },
      {
        code: 'root',
        count: 3,
        children: [
          { code: 'c2', count: 1, children: [{ code: 'gc', count: 0, children: [] }] },
          { code: 'c3', count: 0, children: [] },
          { code: 'c1', count: 0, children: [] },
        ],
      },
    ])
    const active = (await s.inject({ url: `${B}/tree?search=${P}&is_active=true` })).json()
    expect(shape(active).map((n) => (n as { code: string }).code)).toEqual(['solo', 'root'])
    const filtered = (await s.inject({ url: `${B}/tree?search=${P}&status=active` })).json()
    expect(shape(filtered).map((n) => (n as { code: string }).code)).toEqual(['c2', 'c3', 'solo', 'c1'])
    const leaf = full.find((n: TreeDictNode) => n.node_code === `${P}solo`)
    expect(Object.keys(leaf).sort()).toEqual(
      ['children', 'children_count', 'created_at', 'description', 'icon', 'id', 'is_active', 'name', 'node_code', 'node_type', 'owner', 'parent_id', 'sort_order', 'status', 'updated_at'],
    )
  })

  it('列表：parent_id=root / 数字 / 非法 / 超大；分页形状', async () => {
    const codes = async (qs: string) =>
      (await s.inject({ url: `${B}?search=${P}&${qs}` })).json().items.map((i: { node_code: string }) => i.node_code.slice(P.length))
    expect(await codes('parent_id=root')).toEqual(['solo', 'root'])
    expect(await codes(`parent_id=${ids.root}`)).toEqual(['c2', 'c3', 'c1'])
    expect(await codes('parent_id=abc')).toHaveLength(6)
    expect(await codes('parent_id=99999999999')).toEqual([])
    expect(await codes('owner=OW')).toEqual(['c2'])
    expect(await codes('node_type=item')).toEqual(['c3'])
    const body = (await s.inject({ url: `${B}?search=${P}&page=2&per_page=4` })).json()
    expect(body).toMatchObject({ total: 6, page: 2, per_page: 4 })
    expect(body.items).toHaveLength(2)
  })

  it('权限：404 先于 403；各路由 403 文案', async () => {
    expect((await u.inject({ url: `${B}/99999999` })).statusCode).toBe(404)
    expect((await u.inject({ url: `${B}/${ids.root}` })).json()).toEqual({ error: '无权限查看节点详情' })
    expect((await u.inject({ method: 'PUT', url: `${B}/${ids.root}`, payload: {} })).json()).toEqual({ error: '无权限编辑节点' })
    expect((await u.inject({ method: 'DELETE', url: `${B}/${ids.root}` })).json()).toEqual({ error: '无权限删除节点' })
    expect((await u.inject({ url: `${B}/tree` })).json()).toEqual({ error: '无权限查看树形数据' })
    expect((await u.inject({ url: B })).json()).toEqual({ error: '无权限查看树形列表页数据' })
    expect((await u.inject({ method: 'POST', url: B, payload: {} })).json()).toEqual({ error: '无权限新增节点' })
    expect((await u.inject({ url: `${B}/export` })).json()).toEqual({ error: '无权限导出数据' })
    expect((await u.inject({ url: `${B}/template` })).json()).toEqual({ error: '无权限下载导入模板' })
    expect((await u.inject({ method: 'POST', url: `${B}/import` })).json()).toEqual({ error: '无权限导入数据' })
  })

  it('编辑：parent_id 语义、node_code 只校验不修改、同值不写库、失败回滚', async () => {
    const put = (id: number, payload: object) => s.inject({ method: 'PUT', url: `${B}/${id}`, payload })
    const c1 = (await rowByCode(`${P}c1`))!
    // 同值（含 parent_id 字符串形式、sort_order 浮点截断）→ 不写库
    const same = await put(c1.id, { name: 'c1', parent_id: String(ids.root), sort_order: 5.7, status: 'ACTIVE', icon: '' })
    expect(same.statusCode).toBe(200)
    expect((await rowByCode(`${P}c1`))!.updated_at).toBe(c1.updated_at)
    // 自身 / 非法值忽略
    expect((await put(c1.id, { parent_id: c1.id })).json().parent_id).toBe(ids.root)
    expect((await put(c1.id, { parent_id: [1] })).json().parent_id).toBe(ids.root)
    // '0' → int 0 → 不存在
    expect((await put(c1.id, { parent_id: '0' })).json()).toEqual({ error: '父节点不存在' })
    expect((await put(c1.id, { name: '改名', parent_id: 99999999 })).json()).toEqual({ error: '父节点不存在' })
    expect((await rowByCode(`${P}c1`))!.name).toBe('c1')
    // node_code 改成新值：只校验，不修改
    expect((await put(c1.id, { node_code: `${P}renamed` })).json().node_code).toBe(`${P}c1`)
    expect((await put(c1.id, { node_code: `${P}c2` })).json()).toEqual({ error: '节点编码已存在' })
    expect((await put(c1.id, { node_code: ' ' })).json()).toEqual({ error: '节点编码不能为空' })
    expect((await put(c1.id, { name: null })).json()).toEqual({ error: '节点名称不能为空' })
    expect((await put(c1.id, { status: 'draft' })).json()).toEqual({ error: '状态仅支持 active/inactive/archived' })
    // 移动到别的父节点，再用 false / 0 / '' 置空
    expect((await put(c1.id, { parent_id: ids.c2, name: 'c1x' })).json()).toMatchObject({ parent_id: ids.c2, name: 'c1x' })
    expect((await put(c1.id, { parent_id: false })).json().parent_id).toBeNull()
    expect((await put(c1.id, { parent_id: ids.root })).json().parent_id).toBe(ids.root)
    expect((await put(c1.id, { parent_id: '' })).json().parent_id).toBeNull()
    expect((await put(c1.id, { parent_id: ids.root, name: 'c1' })).json().parent_id).toBe(ids.root)
    expect((await rowByCode(`${P}c1`))!.updated_at).not.toBe(c1.updated_at)
  })

  it('导出 csv 字节精确 / GET 筛选 / 模板', async () => {
    const res = await s.inject({
      method: 'POST',
      url: `${B}/export`,
      payload: { ids: [ids.gc, ids.solo], fields: ['node_code', 'parent_id', 'sort_order', 'is_active', 'status', 'icon'] },
    })
    expect(res.headers['content-disposition']).toBe('attachment; filename=tree_list_page_export.csv')
    expect(res.body).toBe(
      `\ufeff节点编码,父节点ID,排序,启用,状态,图标\r\n${P}gc,${ids.c2},0,停用,active,\r\n${P}solo,,1,启用,active,\r\n`,
    )
    const g = await s.inject({ url: `${B}/export?search=${P}&node_type=item&fields=node_code` })
    expect(g.body).toBe(`\ufeff节点编码\r\n${P}c3\r\n`)
    const t = await s.inject({ url: `${B}/template` })
    expect(t.body).toBe('\ufeff节点名称,节点编码,父节点ID,节点类型,图标,状态,负责人,排序,启用,描述\r\n根节点示例,root_001,,category,,active,admin,0,启用,示例描述\r\n')
    expect((await s.inject({ method: 'POST', url: `${B}/export`, payload: { ids: 1 } })).json()).toEqual({ error: '请先勾选要导出的数据' })
  })

  it('导入：成功（父节点 ID、已存在更新）/ 外键失败 500 回滚 / 错误行 / 缺列', async () => {
    const csv = `节点名称,节点编码,父节点ID,节点类型,图标,状态,负责人,排序,启用,描述\n导入,${P}i1,${ids.root},item,ic,ARCHIVED,me,3,停用,d\nsolo,${P}solo,${ids.root},,,,,,,\n`
    const ok = await s.inject({ method: 'POST', url: `${B}/import`, ...multipartFile('t.csv', csv) })
    expect(ok.json()).toEqual({ message: '导入成功', created: 1, updated: 1 })
    expect(await rowByCode(`${P}i1`)).toMatchObject({ parent_id: ids.root, node_type: 'item', icon: 'ic', status: 'archived', sort_order: 3, is_active: false })
    expect((await rowByCode(`${P}solo`))!.parent_id).toBe(ids.root)

    const fk = await s.inject({ method: 'POST', url: `${B}/import`, ...multipartFile('t.csv', `节点名称,节点编码,父节点ID\na,${P}i2,\nb,${P}i3,0\n`) })
    expect(fk.statusCode).toBe(500)
    expect(await rowByCode(`${P}i2`)).toBeUndefined()

    const bad = await s.inject({ method: 'POST', url: `${B}/import`, ...multipartFile('t.csv', `节点名称,节点编码\na,\n`) })
    expect(bad.json()).toEqual({ error: '导入失败，存在错误数据', error_count: 1, error_rows: [{ line: 2, reason: '节点名称和编码不能为空', row: { 节点名称: 'a', 节点编码: '' } }] })
    const missing = await s.inject({ method: 'POST', url: `${B}/import`, ...multipartFile('t.csv', `节点名称\na\n`) })
    expect(missing.json()).toEqual({ error: '导入文件缺少"节点名称/节点编码"列' })
  })

  it('删除：子节点 parent_id 置空且 updated_at 刷新（SQLAlchemy 先 UPDATE 子节点）', async () => {
    const c2Before = (await rowByCode(`${P}c2`))!
    const gcBefore = (await rowByCode(`${P}gc`))!
    const res = await s.inject({ method: 'DELETE', url: `${B}/${ids.root}` })
    expect(res.json()).toEqual({ message: '删除成功' })
    expect(await rowByCode(`${P}root`)).toBeUndefined()
    const c2 = (await rowByCode(`${P}c2`))!
    expect(c2.parent_id).toBeNull()
    expect(c2.updated_at).not.toBe(c2Before.updated_at)
    // 孙节点不受影响
    expect((await rowByCode(`${P}gc`))!).toMatchObject({ parent_id: ids.c2, updated_at: gcBefore.updated_at })
    expect((await s.inject({ method: 'DELETE', url: `${B}/${ids.root}` })).statusCode).toBe(404)
  })
})
