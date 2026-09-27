import { eq, inArray, like } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DbHandle } from '@/db/client'
import { cc_advanced_table_rows } from '@/db/schema'
import {
  buildTestApp,
  cleanupFixture,
  createFixture,
  FIXTURE_PASSWORD,
  FIXTURE_USER,
  loginSession,
  openTestDb,
  superAdminSession,
  type AuthedSession,
} from './helpers'

const P = 'ck_test_r5_'
const B = '/api/admin/component-center/advanced-table'
let app: FastifyInstance
let handle: DbHandle
let s: AuthedSession
const ids: Record<string, number> = {}

async function cleanup() {
  await handle.db.delete(cc_advanced_table_rows).where(like(cc_advanced_table_rows.row_code, `${P}%`))
}

beforeAll(async () => {
  handle = openTestDb()
  app = await buildTestApp()
  s = await superAdminSession(app, handle)
  await cleanup()
  // Primary-key sequences in the cloned test database may lag behind MAX(id), so sync them first
  await handle.pool.query(
    "SELECT setval(pg_get_serial_sequence('cc_advanced_table_rows', 'id'), COALESCE((SELECT MAX(id) FROM cc_advanced_table_rows), 0) + 1, false)",
  )
})

afterAll(async () => {
  await cleanup()
  await cleanupFixture(handle)
  await app.close()
  await handle.pool.end()
})

describe('advanced-table', () => {
  it('新建：201 + 进度钳制、score 按两位小数存储；校验失败分支', async () => {
    const res = await s.inject({
      method: 'POST',
      url: `${B}/rows`,
      payload: {
        name: ` ${P}甲 `,
        row_code: `${P}a`,
        category: 'finance',
        status: 'published',
        priority: 3,
        progress: 120,
        score: 12.345,
        tags: 'x,y',
        is_active: false,
        is_pinned: true,
        due_date: '2025-01-02',
        sort_order: -5,
        owner: `${P}owner`,
      },
    })
    expect(res.statusCode).toBe(201)
    const row = res.json()
    ids.a = row.id
    expect(row).toMatchObject({
      name: `${P}甲`,
      row_code: `${P}a`,
      category: 'finance',
      status: 'published',
      priority: 3,
      progress: 100,
      score: 12.35,
      tags: 'x,y',
      is_active: false,
      is_pinned: true,
      due_date: '2025-01-02',
      sort_order: -5,
      remark: null,
    })
    const r2 = await s.inject({ method: 'POST', url: `${B}/rows`, payload: { name: `${P}乙`, row_code: `${P}b`, category: '', sort_order: 1, score: 50 } })
    expect(r2.json()).toMatchObject({ category: 'general', status: 'draft', score: 50, is_active: true, is_pinned: false, tags: '' })
    ids.b = r2.json().id
    const r3 = await s.inject({ method: 'POST', url: `${B}/rows`, payload: { name: `${P}丙`, row_code: `${P}c`, sort_order: 2, score: null, progress: 30 } })
    ids.c = r3.json().id
    expect(r3.json().score).toBe(0)

    const cases: [object, string][] = [
      [{ row_code: 'x' }, '名称不能为空'],
      [{ name: 'x' }, '编码不能为空'],
      [{ name: 'x', row_code: `${P}a` }, '编码已存在'],
      [{ name: 'x', row_code: `${P}z`, status: 'bogus' }, '状态仅支持 draft/published/archived'],
      [{ name: 'x', row_code: `${P}z`, status: 'Published' }, '状态仅支持 draft/published/archived'],
      [{ name: 'x', row_code: `${P}z`, sort_order: 2147483648 }, '排序的值无效'],
      [{ name: 'x', row_code: `${P}z`, category: 'weird' }, '分类的值无效'],
      [{ name: 'x', row_code: `${P}z`, score: 'abc' }, '评分的值无效'],
      [{ name: 'x', row_code: `${P}z`, priority: '3' }, '优先级的值无效'],
      [{ name: 'x', row_code: `${P}z`, is_pinned: '是' }, '置顶的值无效'],
      [{ name: 'x', row_code: `${P}z`, due_date: '2025/01/02' }, '截止日期的值无效'],
    ]
    for (const [payload, error] of cases) {
      const r = await s.inject({ method: 'POST', url: `${B}/rows`, payload })
      expect(r.statusCode).toBe(400)
      expect(r.json()).toEqual({ error })
    }
    const overflow = await s.inject({ method: 'POST', url: `${B}/rows`, payload: { name: 'x', row_code: `${P}z`, score: 1e6 } })
    expect(overflow.json()).toEqual({ error: '数值超出范围' })
  })

  it('列表：形状、置顶优先、排序字段、筛选、分页', async () => {
    const res = await s.inject({ url: `${B}/rows?search=${P}` })
    const body = res.json()
    expect(Object.keys(body).sort()).toEqual(['items', 'page', 'per_page', 'total'])
    expect(body.total).toBe(3)
    expect(body.items.map((r: { id: number }) => r.id)).toEqual([ids.a, ids.b, ids.c]) // a pinned to top
    const byScore = (await s.inject({ url: `${B}/rows?search=${P}&sort_field=score&sort_order=DESC` })).json()
    expect(byScore.items.map((r: { id: number }) => r.id)).toEqual([ids.a, ids.b, ids.c])
    const byProgress = (await s.inject({ url: `${B}/rows?search=${P}&sort_field=progress&sort_order=asc` })).json()
    expect(byProgress.items.map((r: { id: number }) => r.id)).toEqual([ids.a, ids.b, ids.c])
    const bogus = (await s.inject({ url: `${B}/rows?search=${P}&sort_field=name&sort_order=desc` })).json()
    expect(bogus.items.map((r: { id: number }) => r.id)).toEqual([ids.a, ids.c, ids.b]) // Falls back to sort_order desc

    const page2 = (await s.inject({ url: `${B}/rows?search=${P}&page=2&per_page=2` })).json()
    expect([page2.page, page2.per_page, page2.total, page2.items.length]).toEqual([2, 2, 3, 1])
    const q = async (qs: string) => ((await s.inject({ url: `${B}/rows?search=${P}&${qs}` })).json().items as { id: number }[]).map((r) => r.id)
    expect(await q('is_active=false')).toEqual([ids.a])
    expect(await q('is_active=%E5%90%AF%E7%94%A8')).toEqual([ids.b, ids.c])
    expect(await q('is_active=maybe')).toHaveLength(3)
    expect(await q('pinned_only=1')).toEqual([ids.a])
    expect(await q('pinned_only=maybe')).toHaveLength(3)
    expect(await q('status=published')).toEqual([ids.a])
    expect(await q('category=general')).toEqual([ids.b, ids.c])
    expect(await q(`owner=${P}OWN`)).toEqual([ids.a])
    const tagSearch = (await s.inject({ url: `${B}/rows?search=x,y` })).json().items.map((r: { id: number }) => r.id)
    expect(tagSearch).toContain(ids.a)
  })

  it('统计：计数与平均值（两位小数）', async () => {
    const res = await s.inject({ url: `${B}/stats` })
    const st = res.json()
    const { rows } = await handle.pool.query(
      `SELECT count(*)::int AS total, count(*) FILTER (WHERE is_active)::int AS active, count(*) FILTER (WHERE is_pinned)::int AS pinned,
              count(*) FILTER (WHERE status='published')::int AS published, round(avg(progress), 2) AS ap, round(avg(score), 2) AS asc_
       FROM cc_advanced_table_rows`,
    )
    const r = rows[0]
    expect(st).toMatchObject({
      total: r.total,
      active_count: r.active,
      inactive_count: r.total - r.active,
      pinned_count: r.pinned,
      published_count: r.published,
      avg_progress: Number(r.ap),
      avg_score: Number(r.asc_),
    })
    expect(st.category_stats.reduce((a: number, c: { count: number }) => a + c.count, 0)).toBe(r.total)
    expect(st.category_stats.find((c: { category: string }) => c.category === 'finance').count).toBeGreaterThanOrEqual(1)
  })

  it('编辑：部分字段、空值取默认；类型不符 400；无变化不刷新 updated_at（score 按数值比较）', async () => {
    const res = await s.inject({
      method: 'PUT',
      url: `${B}/rows/${ids.b}`,
      payload: { score: 7.005, progress: -1, category: 'risk', is_pinned: false, due_date: '', remark: ' r ', status: '' },
    })
    expect(res.json()).toMatchObject({ score: 7.01, progress: 0, category: 'risk', is_pinned: false, due_date: null, remark: 'r', status: 'draft' })
    const noop = await s.inject({ method: 'PUT', url: `${B}/rows/${ids.b}`, payload: { category: 'risk', score: 7.01, row_code: `${P}b` } })
    expect(noop.json().updated_at).toBe(res.json().updated_at)
    expect((await s.inject({ method: 'PUT', url: `${B}/rows/${ids.b}`, payload: { category: 'RISK' } })).json()).toEqual({ error: '分类的值无效' })
    expect((await s.inject({ method: 'PUT', url: `${B}/rows/${ids.b}`, payload: { due_date: 'x' } })).json()).toEqual({ error: '截止日期的值无效' })

    const errs: [object, string][] = [
      [{ name: ' ' }, '名称不能为空'],
      [{ row_code: '' }, '编码不能为空'],
      [{ row_code: `${P}a` }, '编码已存在'],
      [{ sort_order: -2147483649 }, '排序的值无效'],
      [{ status: 'x' }, '状态仅支持 draft/published/archived'],
    ]
    for (const [payload, error] of errs) {
      const r = await s.inject({ method: 'PUT', url: `${B}/rows/${ids.b}`, payload })
      expect(r.statusCode).toBe(400)
      expect(r.json()).toEqual({ error })
    }
    expect((await s.inject({ method: 'PUT', url: `${B}/rows/99999999`, payload: {} })).statusCode).toBe(404)
    expect((await s.inject({ method: 'PUT', url: `${B}/rows/abc`, payload: {} })).statusCode).toBe(405)
  })

  it('排序：批量改 sort_order；非数组 400；类型不符 / 越界 / 非对象 → 400', async () => {
    const ok = await s.inject({
      method: 'PUT',
      url: `${B}/rows/reorder`,
      payload: [{ id: ids.b, sort_order: 20 }, { id: ids.c, sort_order: 10 }, { id: 99999999, sort_order: 1 }, { sort_order: 5 }],
    })
    expect(ok.json()).toEqual({ message: '排序已保存' })
    const rows = await handle.db.select().from(cc_advanced_table_rows).where(inArray(cc_advanced_table_rows.id, [ids.b!, ids.c!]))
    expect(Object.fromEntries(rows.map((r) => [r.id, r.sort_order]))).toEqual({ [ids.b!]: 20, [ids.c!]: 10 })

    expect((await s.inject({ method: 'PUT', url: `${B}/rows/reorder`, payload: [] })).json()).toEqual({ message: '排序已保存' })
    expect((await s.inject({ method: 'PUT', url: `${B}/rows/reorder`, payload: [{ id: String(ids.c), sort_order: 1 }] })).json()).toEqual({ error: '记录的值无效' })
    expect((await s.inject({ method: 'PUT', url: `${B}/rows/reorder`, payload: { a: 1 } })).json()).toEqual({ error: '参数格式错误，需要数组' })
    const bad = await s.inject({ method: 'PUT', url: `${B}/rows/reorder`, payload: [{ id: ids.b, sort_order: 1 }, { id: ids.c, sort_order: 2147483648 }] })
    expect(bad.json()).toEqual({ error: '排序的值无效' })
    expect((await s.inject({ method: 'PUT', url: `${B}/rows/reorder`, payload: [{ id: ids.b, sort_order: 1 }, 'x'] })).json()).toEqual({ error: '请求参数格式不正确' })
    const [b] = await handle.db.select().from(cc_advanced_table_rows).where(eq(cc_advanced_table_rows.id, ids.b!))
    expect(b!.sort_order).toBe(20)
  })

  it('批量更新：按找到的行计数；校验；非法状态 → 400 回滚', async () => {
    const res = await s.inject({
      method: 'POST',
      url: `${B}/rows/batch-update`,
      payload: { ids: [ids.b, ids.c, ids.b, 99999999], status: 'archived', owner: ` ${P}o `, is_active: false, priority: 9 },
    })
    expect(res.json()).toEqual({ message: '已更新 2 条记录' })
    const rows = await handle.db.select().from(cc_advanced_table_rows).where(inArray(cc_advanced_table_rows.id, [ids.b!, ids.c!]))
    for (const r of rows) expect([r.status, r.owner, r.is_active, r.priority]).toEqual(['archived', `${P}o`, false, 9])

    expect((await s.inject({ method: 'POST', url: `${B}/rows/batch-update`, payload: {} })).json()).toEqual({ error: '请先选择要操作的数据' })
    expect((await s.inject({ method: 'POST', url: `${B}/rows/batch-update`, payload: { ids: 'x' } })).json()).toEqual({ error: '记录的值无效' })
    expect((await s.inject({ method: 'POST', url: `${B}/rows/batch-update`, payload: { ids: [99999999] } })).json()).toEqual({ error: '未找到可更新的数据' })
    expect((await s.inject({ method: 'POST', url: `${B}/rows/batch-update`, payload: { ids: ['abc'] } })).json()).toEqual({ error: '记录的值无效' })
    const bad = await s.inject({ method: 'POST', url: `${B}/rows/batch-update`, payload: { ids: [ids.b, ids.c], status: 'nope', priority: 1 } })
    expect(bad.json()).toEqual({ error: '状态仅支持 draft/published/archived' })
    const [b] = await handle.db.select().from(cc_advanced_table_rows).where(eq(cc_advanced_table_rows.id, ids.b!))
    expect(b!.priority).toBe(9)
  })

  it('无权限 → 403；403 先于 404', async () => {
    const fx = await createFixture(handle)
    const u = await loginSession(app, FIXTURE_USER, FIXTURE_PASSWORD, fx.userId)
    const expectErr = async (opts: Parameters<typeof u.inject>[0], error: string) => {
      const r = await u.inject(opts)
      expect(r.statusCode).toBe(403)
      expect(r.json()).toEqual({ error })
    }
    await expectErr({ url: `${B}/stats` }, '无权限查看统计数据')
    await expectErr({ url: `${B}/rows` }, '无权限查看数据')
    await expectErr({ method: 'POST', url: `${B}/rows`, payload: {} }, '无权限新增记录')
    await expectErr({ method: 'PUT', url: `${B}/rows/${ids.a}`, payload: {} }, '无权限编辑记录')
    await expectErr({ method: 'DELETE', url: `${B}/rows/${ids.a}` }, '无权限删除记录')
    await expectErr({ method: 'PUT', url: `${B}/rows/reorder`, payload: [] }, '无权限排序')
    await expectErr({ method: 'POST', url: `${B}/rows/batch-update`, payload: {} }, '无权限批量更新')
    await expectErr({ method: 'POST', url: `${B}/rows/batch-delete`, payload: {} }, '无权限批量删除')
    expect((await u.inject({ method: 'DELETE', url: `${B}/rows/99999999` })).statusCode).toBe(403)
  })

  it('删除 / 批量删除', async () => {
    s = await superAdminSession(app, handle) // createFixture clears users with the ck_test_ prefix (including the super test account)
    expect((await s.inject({ method: 'DELETE', url: `${B}/rows/${ids.a}` })).json()).toEqual({ message: '删除成功' })
    expect((await s.inject({ method: 'DELETE', url: `${B}/rows/${ids.a}` })).statusCode).toBe(404)
    expect((await s.inject({ method: 'POST', url: `${B}/rows/batch-delete`, payload: { ids: [] } })).json()).toEqual({ error: '请先选择要删除的数据' })
    expect((await s.inject({ method: 'POST', url: `${B}/rows/batch-delete`, payload: { ids: [ids.a] } })).json()).toEqual({ error: '未找到可删除的数据' })
    const res = await s.inject({ method: 'POST', url: `${B}/rows/batch-delete`, payload: { ids: [ids.b, ids.c, ids.a] } })
    expect(res.json()).toEqual({ message: '已删除 2 条记录' })
    expect(await handle.db.select().from(cc_advanced_table_rows).where(like(cc_advanced_table_rows.row_code, `${P}%`))).toHaveLength(0)
  })
})
