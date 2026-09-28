/**
 * DemoRecord API tests: the scaffold's basic tests (CRUD, list pagination and search, 404, permission before lookup,
 * export, import template, import / rollback, field rules), then the hand-written parts of the shared demo API:
 * the directory-level permission scheme, list filters and sorting, tree, stats, batch update / delete, reorder,
 * parent / cycle / date rules, delete with children, tags / extra.
 * Test data is cleaned up by id: only rows created while this file runs are deleted (children before parents).
 */

import type { FastifyInstance } from 'fastify'
import { eq, gt, inArray, max } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DbHandle } from '@/db/client'
import { demo_records } from '@/db/schema'
import { IMPORT_HEADER_MAP } from '@/modules/component-center/demo-record/schema'
import { buildTestApp, cleanupFixture, multipartFile, openTestDb, scopedSession, superAdminSession, type AuthedSession } from './helpers'

const BASE = '/api/admin/component-center/demo-records'

/** Sample value per field (the tag makes strings differ on every call) */
function sample(tag: string): Record<string, unknown> {
  return {
    name: ('ck-' + tag + '-name').slice(0, 100),
    code: ('ck-' + tag + '-code').slice(0, 50),
    category: 'product',
    status: 'todo',
    owner: ('ck-' + tag + '-owner').slice(0, 50),
    priority: 3,
    is_active: true,
    amount: '12.5',
    quantity: 3,
    progress: 3,
    start_date: '2026-01-15',
    end_date: '2026-01-15',
    parent_id: null,
    sort_order: 3,
    board_order: 3,
    cover: null,
    description: ('ck-' + tag + '-description'),
  }
}

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value)
  return /[",\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text
}

function importCsv(rows: Record<string, unknown>[]): string {
  const headers = Object.keys(IMPORT_HEADER_MAP)
  const lines = rows.map((values) => headers.map((h) => csvCell(values[IMPORT_HEADER_MAP[h]!])).join(','))
  return [headers.map(csvCell).join(','), ...lines].join('\n') + '\n'
}

let app: FastifyInstance
let handle: DbHandle
let s: AuthedSession
let baselineId = 0

async function countNew(): Promise<number> {
  return (await handle.db.select({ id: demo_records.id }).from(demo_records).where(gt(demo_records.id, baselineId))).length
}

beforeAll(async () => {
  handle = openTestDb()
  app = await buildTestApp()
  const [row] = await handle.db.select({ id: max(demo_records.id) }).from(demo_records)
  baselineId = row?.id ?? 0
  s = await superAdminSession(app, handle)
})

afterAll(async () => {
  // Children first: the parent_id foreign key has no ON DELETE action
  await handle.db.update(demo_records).set({ parent_id: null }).where(gt(demo_records.id, baselineId))
  await handle.db.delete(demo_records).where(gt(demo_records.id, baselineId))
  await cleanupFixture(handle)
  await app.close()
  await handle.pool.end()
})

describe('demo_records 接口', () => {
  it('新增 → 详情 → 编辑 → 删除', async () => {
    const created = await s.inject({ method: 'POST', url: BASE, payload: sample('a') })
    expect(created.statusCode, created.body).toBe(201)
    const item = created.json()
    expect(item.id).toBeGreaterThan(baselineId)
    expect((await s.inject({ url: BASE + '/' + item.id })).json()).toEqual(item)

    const updated = await s.inject({ method: 'PUT', url: BASE + '/' + item.id, payload: sample('b') })
    expect(updated.statusCode, updated.body).toBe(200)
    expect((await s.inject({ url: BASE + '/' + item.id })).json()).toEqual(updated.json())

    expect((await s.inject({ method: 'DELETE', url: BASE + '/' + item.id })).json()).toEqual({ message: '删除成功' })
    expect((await s.inject({ url: BASE + '/' + item.id })).statusCode).toBe(404)
  })

  it('列表：分页形状；按 name 搜索', async () => {
    const created = (await s.inject({ method: 'POST', url: BASE, payload: sample('list') })).json()
    const page = await s.inject({ url: BASE + '?page=1&per_page=5' })
    expect(page.statusCode).toBe(200)
    expect(page.json()).toMatchObject({ page: 1, per_page: 5 })
    expect(page.json().items.length).toBeLessThanOrEqual(5)
    const found = await s.inject({ url: BASE + '?search=' + encodeURIComponent(String(created.name)) })
    expect(found.json().items.map((i: { id: number }) => i.id)).toContain(created.id)
  })

  it('不存在的记录返回 404', async () => {
    expect((await s.inject({ url: BASE + '/99999999' })).statusCode).toBe(404)
  })

  it('先查权限再查记录：没有权限时不论记录是否存在都是 403', async () => {
    const viewer = await scopedSession(app, handle, { name: 'demo_record_viewer', codes: ['cc_patterns_standard_list'], dataScope: 'all' })
    const item = (await s.inject({ method: 'POST', url: BASE, payload: sample('perm') })).json()
    for (const id of [item.id, 99999999]) {
      expect((await viewer.inject({ method: 'PUT', url: BASE + '/' + id, payload: sample('perm-x') })).statusCode).toBe(403)
      expect((await viewer.inject({ method: 'DELETE', url: BASE + '/' + id })).statusCode).toBe(403)
    }
    expect((await viewer.inject({ url: BASE + '/99999999' })).statusCode).toBe(404)
  })

  it('导出 csv 与导入模板', async () => {
    const exported = await s.inject({ method: 'POST', url: BASE + '/export', payload: { file_type: 'csv' } })
    expect(exported.statusCode).toBe(200)
    expect(exported.headers['content-type']).toContain('csv')
    const template = await s.inject({ url: BASE + '/template?file_type=csv' })
    expect(template.statusCode).toBe(200)
    expect(template.body).toContain(Object.keys(IMPORT_HEADER_MAP)[0])
  })

  it('导入 csv：合法行新增；必填列为空时整批回滚', async () => {
    const ok = await s.inject({ method: 'POST', url: BASE + '/import', ...multipartFile('import.csv', importCsv([sample('imp')])) })
    expect(ok.json()).toEqual({ message: '导入成功', created: 1, updated: 0 })

    const before = await countNew()
    const requiredField = IMPORT_HEADER_MAP[Object.keys(IMPORT_HEADER_MAP)[0]!]!
    // A row whose only filled cell is the required one would be blank without it, and blank rows are skipped
    if (!Object.entries(sample('imp3')).some(([f, v]) => f !== requiredField && v !== null && v !== '')) return
    const bad = await s.inject({
      method: 'POST',
      url: BASE + '/import',
      ...multipartFile('import.csv', importCsv([sample('imp2'), { ...sample('imp3'), [requiredField]: '' }])),
    })
    expect(bad.statusCode).toBe(400)
    expect(bad.json().error_count).toBe(1)
    expect(await countNew()).toBe(before)
  })

  it('字段规则：必填、选项、唯一、默认值', async () => {
    // name: required
    const missingName = await s.inject({ method: 'POST', url: BASE, payload: { ...sample('rq-name'), name: '' } })
    expect([missingName.statusCode, missingName.json()]).toEqual([400, { error: '名称不能为空' }])
    // code: required
    const missingCode = await s.inject({ method: 'POST', url: BASE, payload: { ...sample('rq-code'), code: '' } })
    expect([missingCode.statusCode, missingCode.json()]).toEqual([400, { error: '编码不能为空' }])
    // code: unique
    const firstCode = (await s.inject({ method: 'POST', url: BASE, payload: sample('uq1-code') })).json()
    const dupCode = await s.inject({ method: 'POST', url: BASE, payload: { ...sample('uq2-code'), code: firstCode.code } })
    expect([dupCode.statusCode, dupCode.json()]).toEqual([400, { error: '字段「code」的值已被使用，请换一个值后再保存' }])
    // category: only the listed option values (import files may use the labels)
    const badCategory = await s.inject({ method: 'POST', url: BASE, payload: { ...sample('op-category'), category: 'not-an-option' } })
    expect([badCategory.statusCode, badCategory.json()]).toEqual([400, { error: '分类的值无效' }])
    // status: only the listed option values (import files may use the labels)
    const badStatus = await s.inject({ method: 'POST', url: BASE, payload: { ...sample('op-status'), status: 'not-an-option' } })
    expect([badStatus.statusCode, badStatus.json()]).toEqual([400, { error: '状态的值无效' }])
    // status: default when left empty
    const defaultedStatus = (await s.inject({ method: 'POST', url: BASE, payload: { ...sample('df-status'), status: null } })).json()
    expect(defaultedStatus.status).toEqual('todo')
    // priority: default when left empty
    const defaultedPriority = (await s.inject({ method: 'POST', url: BASE, payload: { ...sample('df-priority'), priority: null } })).json()
    expect(defaultedPriority.priority).toEqual(0)
    // is_active: default when left empty
    const defaultedIsActive = (await s.inject({ method: 'POST', url: BASE, payload: { ...sample('df-is_active'), is_active: null } })).json()
    expect(defaultedIsActive.is_active).toEqual(true)
    // progress: default when left empty
    const defaultedProgress = (await s.inject({ method: 'POST', url: BASE, payload: { ...sample('df-progress'), progress: null } })).json()
    expect(defaultedProgress.progress).toEqual(0)
    // sort_order: default when left empty
    const defaultedSortOrder = (await s.inject({ method: 'POST', url: BASE, payload: { ...sample('df-sort_order'), sort_order: null } })).json()
    expect(defaultedSortOrder.sort_order).toEqual(0)
    // board_order: default when left empty
    const defaultedBoardOrder = (await s.inject({ method: 'POST', url: BASE, payload: { ...sample('df-board_order'), board_order: null } })).json()
    expect(defaultedBoardOrder.board_order).toEqual(0)
  })
})

describe('demo_records: shared API of the page patterns', () => {
  /** Create a record from sample(tag) with overrides; returns the created dict */
  async function make(tag: string, values: Record<string, unknown> = {}) {
    const res = await s.inject({ method: 'POST', url: BASE, payload: { ...sample(tag), ...values } })
    expect(res.statusCode, res.body).toBe(201)
    return res.json() as { id: number; code: string; [key: string]: unknown }
  }
  const idsOf = (items: { id: number }[]) => items.map((i) => i.id)

  it('权限：页面模板下任一页面可读，写操作按目录的按钮权限', async () => {
    const item = await make('pm-item')
    const page = await scopedSession(app, handle, { name: 'demo_record_page', codes: ['cc_patterns_standard_list'], dataScope: 'all' })
    const dir = await scopedSession(app, handle, { name: 'demo_record_dir', codes: ['cc_patterns'], dataScope: 'all' })
    const other = await scopedSession(app, handle, { name: 'demo_record_other', codes: ['cc_components'], dataScope: 'all' })
    const editor = await scopedSession(app, handle, { name: 'demo_record_editor', codes: ['cc_patterns_edit'], dataScope: 'all' })
    for (const reader of [page, dir]) {
      for (const url of [BASE, BASE + '/tree', BASE + '/stats', BASE + '/' + item.id]) {
        expect((await reader.inject({ url })).statusCode, url).toBe(200)
      }
    }
    for (const url of [BASE, BASE + '/tree', BASE + '/stats', BASE + '/' + item.id]) {
      expect((await other.inject({ url })).statusCode, url).toBe(403)
    }
    // A page grants reads only: no create / edit / delete / batch / reorder / import / export
    expect((await page.inject({ method: 'POST', url: BASE, payload: sample('pm-x') })).statusCode).toBe(403)
    expect((await page.inject({ method: 'POST', url: BASE + '/batch-update', payload: { ids: [item.id], priority: 1 } })).statusCode).toBe(403)
    expect((await page.inject({ method: 'POST', url: BASE + '/batch-delete', payload: { ids: [item.id] } })).statusCode).toBe(403)
    expect((await page.inject({ method: 'PUT', url: BASE + '/reorder', payload: [{ id: item.id, sort_order: 1 }] })).statusCode).toBe(403)
    expect((await page.inject({ method: 'POST', url: BASE + '/export', payload: {} })).statusCode).toBe(403)
    expect((await page.inject({ url: BASE + '/template' })).statusCode).toBe(403)
    // The directory's edit button: edit, batch update and reorder, but not delete
    expect((await editor.inject({ method: 'PUT', url: BASE + '/' + item.id, payload: { priority: 2 } })).statusCode).toBe(200)
    expect((await editor.inject({ method: 'POST', url: BASE + '/batch-update', payload: { ids: [item.id], priority: 3 } })).statusCode).toBe(200)
    expect((await editor.inject({ method: 'PUT', url: BASE + '/reorder', payload: [{ id: item.id, sort_order: 4 }] })).statusCode).toBe(200)
    expect((await editor.inject({ method: 'DELETE', url: BASE + '/' + item.id })).statusCode).toBe(403)
    expect((await editor.inject({ method: 'POST', url: BASE + '/batch-delete', payload: { ids: [item.id] } })).statusCode).toBe(403)
  })

  it('列表：按分类 / 状态 / 负责人 / 启用 / 上级 / 开始日期筛选，按字段排序', async () => {
    const owner = `ck-flt-${Date.now()}`
    const root = await make('flt-root', { owner, category: 'design', status: 'done', start_date: '2026-02-01', end_date: null, amount: '10', priority: 1 })
    const child = await make('flt-child', { owner, category: 'product', status: 'todo', parent_id: root.id, start_date: '2026-02-10', end_date: null, priority: 5 })
    const off = await make('flt-off', { owner, is_active: false, status: 'in_progress', start_date: '2026-03-01', end_date: null, priority: 3 })
    const list = async (query: string) => idsOf((await s.inject({ url: `${BASE}?per_page=200&owner=${owner}&${query}` })).json().items)

    expect((await list('')).sort()).toEqual([root.id, child.id, off.id].sort())
    expect(await list('category=design')).toEqual([root.id])
    expect(await list('status=todo')).toEqual([child.id])
    expect(await list('is_active=false')).toEqual([off.id])
    expect((await list('is_active=true')).sort()).toEqual([root.id, child.id].sort())
    expect(await list(`parent_id=${root.id}`)).toEqual([child.id])
    expect((await list('parent_id=root')).sort()).toEqual([root.id, off.id].sort())
    expect(await list('start_from=2026-02-05&start_to=2026-02-20')).toEqual([child.id])
    expect(await list('search=' + encodeURIComponent(child.code))).toEqual([child.id])
    // Sorting: an allowed field and direction; anything else falls back to id descending
    expect(await list('sort_field=priority&sort_dir=asc')).toEqual([root.id, off.id, child.id])
    expect(await list('sort_field=priority&sort_dir=desc')).toEqual([child.id, off.id, root.id])
    expect(await list('sort_field=password&sort_dir=asc')).toEqual([off.id, child.id, root.id])
    // board_order (the kanban's card order) sorts on its own, whatever sort_order says
    await s.inject({ method: 'PUT', url: BASE + '/reorder', payload: [{ id: root.id, board_order: 2 }, { id: child.id, board_order: 0 }, { id: off.id, board_order: 1 }] })
    expect(await list('sort_field=board_order&sort_dir=asc')).toEqual([child.id, off.id, root.id])
    expect(await list('sort_field=board_order&sort_dir=desc')).toEqual([root.id, off.id, child.id])
  })

  it('树：按 parent_id 嵌套、sort_order 排序；筛选时保留命中项的上级', async () => {
    const owner = `ck-tree-${Date.now()}`
    const root = await make('tr-root', { owner, sort_order: 1 })
    const b = await make('tr-b', { owner, parent_id: root.id, sort_order: 2 })
    const a = await make('tr-a', { owner, parent_id: root.id, sort_order: 1, status: 'done' })
    const leaf = await make('tr-leaf', { owner, parent_id: a.id, sort_order: 1 })
    type Node = { id: number; children: Node[] }
    const find = (nodes: Node[], id: number): Node | undefined => {
      for (const n of nodes) {
        if (n.id === id) return n
        const hit = find(n.children, id)
        if (hit) return hit
      }
    }

    const tree = (await s.inject({ url: BASE + '/tree' })).json() as Node[]
    const node = find(tree, root.id)!
    expect(tree.map((n) => n.id)).toContain(root.id)
    expect(node.children.map((n) => n.id)).toEqual([a.id, b.id])
    expect(node.children[0]!.children.map((n) => n.id)).toEqual([leaf.id])
    expect(node.children[1]!.children).toEqual([])

    // Only the done record matches: it comes back under its parent, without the other branches
    const filtered = (await s.inject({ url: `${BASE}/tree?owner=${owner}&status=done` })).json() as Node[]
    expect(filtered.map((n) => n.id)).toEqual([root.id])
    expect(filtered[0]!.children.map((n) => n.id)).toEqual([a.id])
    expect(filtered[0]!.children[0]!.children).toEqual([])
  })

  it('统计：总数、金额与数量合计、按状态与分类计数，和列表同样的筛选', async () => {
    const owner = `ck-stats-${Date.now()}`
    await make('st-1', { owner, status: 'todo', category: 'design', amount: '10.50', quantity: 2 })
    await make('st-2', { owner, status: 'done', category: 'design', amount: 20, quantity: 3 })
    await make('st-3', { owner, status: 'done', category: null, amount: null, quantity: null })
    const stats = (await s.inject({ url: `${BASE}/stats?owner=${owner}` })).json()
    expect(stats).toMatchObject({ total: 3, amount_sum: '30.50', quantity_sum: 5 })
    expect(stats.by_status).toEqual([
      { status: 'todo', count: 1 },
      { status: 'in_progress', count: 0 },
      { status: 'done', count: 2 },
      { status: 'archived', count: 0 },
    ])
    expect(stats.by_category).toContainEqual({ category: 'design', count: 2 })
    expect(stats.by_category).toContainEqual({ category: 'product', count: 0 })
    expect(stats.by_category.at(-1)).toEqual({ category: null, count: 1 })
    const done = (await s.inject({ url: `${BASE}/stats?owner=${owner}&status=done` })).json()
    expect(done).toMatchObject({ total: 2, amount_sum: '20.00', quantity_sum: 3 })
    const none = (await s.inject({ url: `${BASE}/stats?owner=${owner}-none` })).json()
    expect(none).toMatchObject({ total: 0, amount_sum: '0.00', quantity_sum: 0 })
  })

  it('上级记录、日期、进度、标签与扩展字段的规则', async () => {
    const parent = await make('rule-parent')
    const child = await make('rule-child', { parent_id: parent.id, tags: [' a ', '', 'b'], extra: { 客户: '市场部', 预算: 12 } })
    expect(child).toMatchObject({ parent_id: parent.id, tags: ['a', 'b'], extra: { 客户: '市场部', 预算: 12 } })
    expect((await make('rule-defaults', { tags: null, extra: null }))).toMatchObject({ tags: [], extra: {} })

    const post = (values: Record<string, unknown>) => s.inject({ method: 'POST', url: BASE, payload: { ...sample('rule-x' + Math.random()), ...values } })
    const put = (id: number, values: Record<string, unknown>) => s.inject({ method: 'PUT', url: BASE + '/' + id, payload: values })
    const error = async (res: Promise<{ statusCode: number; json: () => unknown }>) => {
      const r = await res
      return [r.statusCode, r.json()]
    }
    expect(await error(post({ parent_id: 99999999 }))).toEqual([400, { error: '上级记录不存在' }])
    expect(await error(post({ start_date: '2026-03-10', end_date: '2026-03-01' }))).toEqual([400, { error: '开始日期不能晚于结束日期' }])
    expect(await error(post({ progress: 101 }))).toEqual([400, { error: '进度的值无效' }])
    expect(await error(post({ tags: 'a,b' }))).toEqual([400, { error: '标签的值无效' }])
    expect(await error(post({ extra: [1] }))).toEqual([400, { error: '扩展字段的值无效' }])
    // No cycles: not itself, not a descendant
    expect(await error(put(parent.id, { parent_id: parent.id }))).toEqual([400, { error: '上级记录不能是自身或其下级记录' }])
    expect(await error(put(parent.id, { parent_id: child.id }))).toEqual([400, { error: '上级记录不能是自身或其下级记录' }])
    // An update checks dates against the stored ones
    await put(child.id, { start_date: '2026-03-01', end_date: '2026-03-31' })
    expect(await error(put(child.id, { end_date: '2026-02-01' }))).toEqual([400, { error: '开始日期不能晚于结束日期' }])
    expect((await put(child.id, { parent_id: null })).json().parent_id).toBeNull()
  })

  it('删除：有下级时 400；批量删除可连同全部下级，不能留下未选中的下级', async () => {
    const parent = await make('del-parent')
    const child = await make('del-child', { parent_id: parent.id })
    const grandchild = await make('del-grandchild', { parent_id: child.id })
    const del = await s.inject({ method: 'DELETE', url: BASE + '/' + parent.id })
    expect([del.statusCode, del.json()]).toEqual([400, { error: '存在下级记录，不能删除' }])

    const partial = await s.inject({ method: 'POST', url: BASE + '/batch-delete', payload: { ids: [parent.id, child.id] } })
    expect([partial.statusCode, partial.json()]).toEqual([400, { error: '所选记录包含未选中的下级记录，不能删除' }])
    const empty = await s.inject({ method: 'POST', url: BASE + '/batch-delete', payload: { ids: [] } })
    expect([empty.statusCode, empty.json()]).toEqual([400, { error: '请选择要操作的记录' }])
    const missing = await s.inject({ method: 'POST', url: BASE + '/batch-delete', payload: { ids: [parent.id, 99999999] } })
    expect([missing.statusCode, missing.json()]).toEqual([400, { error: '记录不存在或已删除' }])

    const all = await s.inject({ method: 'POST', url: BASE + '/batch-delete', payload: { ids: [parent.id, child.id, grandchild.id] } })
    expect([all.statusCode, all.json()]).toEqual([200, { message: '已删除 3 条记录' }])
    expect(await handle.db.select().from(demo_records).where(inArray(demo_records.id, [parent.id, child.id, grandchild.id]))).toEqual([])
  })

  it('批量修改：只改出现的字段；NOT NULL 字段的 null 视为不改，owner 的 null 清空', async () => {
    const a = await make('bu-a', { status: 'todo', priority: 1, owner: '甲' })
    const b = await make('bu-b', { status: 'done', priority: 2, owner: '乙' })
    const res = await s.inject({ method: 'POST', url: BASE + '/batch-update', payload: { ids: [a.id, b.id], status: 'in_progress', priority: null, owner: null } })
    expect([res.statusCode, res.json()]).toEqual([200, { message: '已更新 2 条记录' }])
    const rows = await handle.db.select().from(demo_records).where(inArray(demo_records.id, [a.id, b.id])).orderBy(demo_records.id)
    expect(rows.map((r) => [r.status, r.priority, r.owner, r.is_active])).toEqual([
      ['in_progress', 1, null, true],
      ['in_progress', 2, null, true],
    ])
    const nothing = await s.inject({ method: 'POST', url: BASE + '/batch-update', payload: { ids: [a.id], status: null } })
    expect([nothing.statusCode, nothing.json()]).toEqual([400, { error: '请至少修改一个字段' }])
    const noIds = await s.inject({ method: 'POST', url: BASE + '/batch-update', payload: { status: 'done' } })
    expect([noIds.statusCode, noIds.json()]).toEqual([400, { error: '请选择要操作的记录' }])
    const badStatus = await s.inject({ method: 'POST', url: BASE + '/batch-update', payload: { ids: [a.id], status: 'x' } })
    expect([badStatus.statusCode, badStatus.json()]).toEqual([400, { error: '状态的值无效' }])
  })

  it('调整顺序：看板换列、树拖动换上级（null 为顶级），不能成环', async () => {
    const root = await make('ro-root')
    const a = await make('ro-a', { parent_id: root.id, sort_order: 1, board_order: 1, status: 'todo' })
    const b = await make('ro-b', { parent_id: root.id, sort_order: 2, board_order: 2, status: 'todo' })
    const reorder = (payload: object) => s.inject({ method: 'PUT', url: BASE + '/reorder', payload })
    const get = async (id: number) => (await s.inject({ url: BASE + '/' + id })).json()

    // Kanban: b moves to the in-progress column, first place; the tree (sort_order, parent) is untouched
    const board = await reorder([{ id: b.id, board_order: 0, status: 'in_progress' }, { id: a.id, board_order: 3 }])
    expect([board.statusCode, board.json()]).toEqual([200, { message: '排序成功', updated: 2 }])
    expect(await get(b.id)).toMatchObject({ status: 'in_progress', board_order: 0, sort_order: 2, parent_id: root.id })
    expect(await get(a.id)).toMatchObject({ status: 'todo', board_order: 3, sort_order: 1, parent_id: root.id })
    // Nothing changes: nothing is written
    expect((await reorder([{ id: a.id, board_order: 3 }])).json()).toEqual({ message: '排序成功', updated: 0 })
    // null means "not changed" for the NOT NULL columns
    expect((await reorder([{ id: a.id, board_order: 4, sort_order: null, status: null }])).json()).toEqual({ message: '排序成功', updated: 1 })
    expect(await get(a.id)).toMatchObject({ status: 'todo', board_order: 4, sort_order: 1 })

    // Tree: siblings swap places; the kanban order (board_order, status) is untouched
    const tree = await reorder([{ id: a.id, sort_order: 2 }, { id: b.id, sort_order: 1 }])
    expect([tree.statusCode, tree.json()]).toEqual([200, { message: '排序成功', updated: 2 }])
    expect(await get(a.id)).toMatchObject({ sort_order: 2, board_order: 4, status: 'todo' })
    expect(await get(b.id)).toMatchObject({ sort_order: 1, board_order: 0, status: 'in_progress' })

    // Tree drag: b under a, then a to the root
    expect((await reorder([{ id: b.id, sort_order: 1, parent_id: a.id }])).statusCode).toBe(200)
    expect((await reorder([{ id: a.id, sort_order: 5, parent_id: null }])).statusCode).toBe(200)
    expect(await get(a.id)).toMatchObject({ parent_id: null, sort_order: 5, board_order: 4 })
    expect(await get(b.id)).toMatchObject({ parent_id: a.id, board_order: 0 })
    // parent_id alone is a change (null = move to the root)
    expect((await reorder([{ id: b.id, parent_id: null }])).json()).toEqual({ message: '排序成功', updated: 1 })
    expect(await get(b.id)).toMatchObject({ parent_id: null, sort_order: 1 })
    expect((await reorder([{ id: b.id, parent_id: a.id }])).statusCode).toBe(200)

    // Cycles are checked after every move of the request is applied
    const cycle = await reorder([{ id: a.id, sort_order: 1, parent_id: b.id }])
    expect([cycle.statusCode, cycle.json()]).toEqual([400, { error: '上级记录不能是自身或其下级记录' }])
    const swap = await reorder([{ id: b.id, sort_order: 1, parent_id: null }, { id: a.id, sort_order: 2, parent_id: b.id }])
    expect(swap.statusCode, swap.body).toBe(200)
    expect(await get(a.id)).toMatchObject({ parent_id: b.id })

    const nothing = '排序项至少要指定一个要调整的字段'
    const errors: [object, string][] = [
      [[{ id: a.id, sort_order: 1 }, { id: a.id, board_order: 2 }], '排序列表中有重复的记录'],
      [[{ id: 99999999, sort_order: 1 }], '记录不存在或已删除'],
      [[{ id: a.id, sort_order: 1, parent_id: 99999999 }], '上级记录不存在'],
      [[{ sort_order: 1 }], '记录不能为空'],
      [{ id: a.id }, '参数格式错误，需要数组'],
      // Every field besides id is optional, but an entry must carry at least one change
      [[{ id: a.id }], nothing],
      [[{ id: a.id, board_order: null, sort_order: null, status: null }], nothing],
      [[{ id: b.id, board_order: 1 }, { id: a.id }], nothing],
      [[{ id: a.id, board_order: 'x' }], '看板顺序的值无效'],
      [[{ id: a.id, sort_order: 1.5 }], '排序的值无效'],
      [[{ id: a.id, status: 'x' }], '状态的值无效'],
    ]
    for (const [payload, error] of errors) {
      const res = await reorder(payload)
      expect([res.statusCode, res.json()], JSON.stringify(payload)).toEqual([400, { error }])
    }
    // A rejected request writes nothing
    expect(await get(b.id)).toMatchObject({ board_order: 0 })
  })

  it('导入：标签按逗号拆分，带排序与看板顺序；上级记录必须已存在；导出带标签与看板顺序列', async () => {
    const parent = await make('imp-parent')
    const row: Record<string, unknown> = { ...sample('imp-tags'), parent_id: parent.id, tags: '甲,乙、丙' }
    const ok = await s.inject({ method: 'POST', url: BASE + '/import', ...multipartFile('import.csv', importCsv([row])) })
    expect(ok.json()).toEqual({ message: '导入成功', created: 1, updated: 0 })
    const [created] = await handle.db.select().from(demo_records).where(eq(demo_records.code, String(row.code)))
    expect(created).toMatchObject({ parent_id: parent.id, tags: ['甲', '乙', '丙'], sort_order: 3, board_order: 3 })

    const bad = await s.inject({
      method: 'POST',
      url: BASE + '/import',
      ...multipartFile('import.csv', importCsv([{ ...sample('imp-bad'), parent_id: 99999999 }])),
    })
    expect(bad.statusCode).toBe(400)
    expect(bad.json().error_rows[0].reason).toBe('上级记录不存在')

    const exported = await s.inject({ method: 'POST', url: BASE + '/export', payload: { ids: [created!.id], fields: ['code', 'tags', 'board_order'], file_type: 'csv' } })
    expect(exported.body.replace(/^\uFEFF/, '').trim().split('\r\n')).toEqual(['编码,标签,看板顺序', `${row.code},"甲,乙,丙",3`])
  })
})
