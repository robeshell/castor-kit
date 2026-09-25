import { eq, inArray, like } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DbHandle } from '@/db/client'
import { cc_advanced_table_rows } from '@/db/schema'
import { numericEqualsFloat, pyRound2 } from '@/modules/component-center/advanced-table/schema'
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
  // 克隆出来的测试库主键序列可能落后于 MAX(id)，先同步
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

describe('advanced-table 工具函数', () => {
  it('pyRound2 按 round(x, 2) 语义（含恰好一半取偶）', () => {
    // round(x, 2) 语义：round(0.125,2)=0.12, round(0.375,2)=0.38, round(2.675,2)=2.67, round(1.005,2)=1.0
    expect(pyRound2(0.125)).toBe(0.12)
    expect(pyRound2(0.375)).toBe(0.38)
    expect(pyRound2(-0.125)).toBe(-0.12)
    expect(pyRound2(2.675)).toBe(2.67)
    expect(pyRound2(1.005)).toBe(1)
    expect(pyRound2(33.333333333333336)).toBe(33.33)
    expect(pyRound2(0)).toBe(0)
  })

  it('numericEqualsFloat：Decimal == float 精确比较', () => {
    expect(numericEqualsFloat('82.00', 82)).toBe(true)
    expect(numericEqualsFloat('12.50', 12.5)).toBe(true)
    expect(numericEqualsFloat('0.10', 0.1)).toBe(false)
    expect(numericEqualsFloat('0.00', 0)).toBe(true)
    expect(numericEqualsFloat('-1.25', -1.25)).toBe(true)
    expect(numericEqualsFloat(null, 0)).toBe(false)
    expect(numericEqualsFloat('NaN', Number.NaN)).toBe(false)
  })
})

describe('advanced-table', () => {
  it('新建：201 + 归一化（score 输出为数字）；校验失败分支', async () => {
    const res = await s.inject({
      method: 'POST',
      url: `${B}/rows`,
      payload: {
        name: ` ${P}甲 `,
        row_code: `${P}a`,
        category: 'FINANCE',
        status: ' Published ',
        priority: '3',
        progress: 120,
        score: '12.345',
        tags: 'x,y',
        is_active: 'off',
        is_pinned: '是',
        due_date: '2025-01-02',
        sort_order: '-5',
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
    const r2 = await s.inject({ method: 'POST', url: `${B}/rows`, payload: { name: `${P}乙`, row_code: `${P}b`, category: 'weird', sort_order: 1, score: 50 } })
    expect(r2.json()).toMatchObject({ category: 'general', status: 'draft', score: 50, is_active: true, is_pinned: false, tags: '' })
    ids.b = r2.json().id
    const r3 = await s.inject({ method: 'POST', url: `${B}/rows`, payload: { name: `${P}丙`, row_code: `${P}c`, sort_order: 2, score: 'abc', progress: 30 } })
    ids.c = r3.json().id
    expect(r3.json().score).toBe(0)

    const cases: [object, string][] = [
      [{ row_code: 'x' }, '名称不能为空'],
      [{ name: 'x' }, '编码不能为空'],
      [{ name: 'x', row_code: `${P}a` }, '编码已存在'],
      [{ name: 'x', row_code: `${P}z`, status: 'bogus', sort_order: 99999999999 }, '状态仅支持 draft/published/archived'],
      [{ name: 'x', row_code: `${P}z`, sort_order: 2147483648 }, '排序值超出范围'],
    ]
    for (const [payload, error] of cases) {
      const r = await s.inject({ method: 'POST', url: `${B}/rows`, payload })
      expect(r.statusCode).toBe(400)
      expect(r.json()).toEqual({ error })
    }
    const overflow = await s.inject({ method: 'POST', url: `${B}/rows`, payload: { name: 'x', row_code: `${P}z`, score: 1e6 } })
    expect(overflow.statusCode).toBe(500)
  })

  it('列表：形状、置顶优先、排序字段、筛选、分页', async () => {
    const res = await s.inject({ url: `${B}/rows?search=${P}` })
    const body = res.json()
    expect(Object.keys(body).sort()).toEqual(['items', 'page', 'per_page', 'total'])
    expect(body.total).toBe(3)
    expect(body.items.map((r: { id: number }) => r.id)).toEqual([ids.a, ids.b, ids.c]) // a 置顶
    const byScore = (await s.inject({ url: `${B}/rows?search=${P}&sort_field=score&sort_order=DESC` })).json()
    expect(byScore.items.map((r: { id: number }) => r.id)).toEqual([ids.a, ids.b, ids.c])
    const byProgress = (await s.inject({ url: `${B}/rows?search=${P}&sort_field=progress&sort_order=asc` })).json()
    expect(byProgress.items.map((r: { id: number }) => r.id)).toEqual([ids.a, ids.b, ids.c])
    const bogus = (await s.inject({ url: `${B}/rows?search=${P}&sort_field=name&sort_order=desc` })).json()
    expect(bogus.items.map((r: { id: number }) => r.id)).toEqual([ids.a, ids.c, ids.b]) // 回落 sort_order desc

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

  it('统计：计数与平均值按 Python round 两位', async () => {
    const res = await s.inject({ url: `${B}/stats` })
    const st = res.json()
    const { rows } = await handle.pool.query(
      `SELECT count(*)::int AS total, count(*) FILTER (WHERE is_active)::int AS active, count(*) FILTER (WHERE is_pinned)::int AS pinned,
              count(*) FILTER (WHERE status='published')::int AS published, avg(progress) AS ap, avg(score) AS asc_
       FROM cc_advanced_table_rows`,
    )
    const r = rows[0]
    expect(st).toMatchObject({
      total: r.total,
      active_count: r.active,
      inactive_count: r.total - r.active,
      pinned_count: r.pinned,
      published_count: r.published,
      avg_progress: pyRound2(Number(r.ap)),
      avg_score: pyRound2(Number(r.asc_)),
    })
    expect(st.category_stats.reduce((a: number, c: { count: number }) => a + c.count, 0)).toBe(r.total)
    expect(st.category_stats.find((c: { category: string }) => c.category === 'finance').count).toBeGreaterThanOrEqual(1)
  })

  it('编辑：部分字段、默认值回落、错误优先级；无变化不刷新 updated_at', async () => {
    const res = await s.inject({
      method: 'PUT',
      url: `${B}/rows/${ids.b}`,
      payload: { score: '7.005', progress: -1, category: 'RISK', is_pinned: 'no', due_date: 'x', remark: ' r ', status: '' },
    })
    expect(res.json()).toMatchObject({ score: 7.01, progress: 0, category: 'risk', is_pinned: false, due_date: null, remark: 'r', status: 'draft' })
    const noop = await s.inject({ method: 'PUT', url: `${B}/rows/${ids.b}`, payload: { category: 'x', priority: 'x', row_code: `${P}b` } })
    expect(noop.json().updated_at).toBe(res.json().updated_at)
    expect(noop.json().category).toBe('risk')
    // Decimal('7.01') 与浮点 7.01 精确比较不相等 → 仍会发 UPDATE 刷新 updated_at
    const inexact = await s.inject({ method: 'PUT', url: `${B}/rows/${ids.b}`, payload: { score: 7.01 } })
    expect(inexact.json().score).toBe(7.01)
    expect(inexact.json().updated_at).not.toBe(res.json().updated_at)

    const errs: [object, string][] = [
      [{ name: ' ' }, '名称不能为空'],
      [{ row_code: '' }, '编码不能为空'],
      [{ row_code: `${P}a` }, '编码已存在'],
      [{ status: 'x', sort_order: -2147483649 }, '排序值超出范围'],
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

  it('排序：批量改 sort_order；非数组 400；越界 / 非对象 → 500 且回滚', async () => {
    const ok = await s.inject({
      method: 'PUT',
      url: `${B}/rows/reorder`,
      payload: [{ id: ids.b, sort_order: 20 }, { id: String(ids.c), sort_order: '10' }, { id: 99999999999, sort_order: 1 }, { id: 0 }],
    })
    expect(ok.json()).toEqual({ message: '排序已保存' })
    const rows = await handle.db.select().from(cc_advanced_table_rows).where(inArray(cc_advanced_table_rows.id, [ids.b!, ids.c!]))
    expect(Object.fromEntries(rows.map((r) => [r.id, r.sort_order]))).toEqual({ [ids.b!]: 20, [ids.c!]: 10 })

    expect((await s.inject({ method: 'PUT', url: `${B}/rows/reorder`, payload: {} })).json()).toEqual({ message: '排序已保存' })
    expect((await s.inject({ method: 'PUT', url: `${B}/rows/reorder`, payload: { a: 1 } })).json()).toEqual({ error: '参数格式错误，需要数组' })
    const bad = await s.inject({ method: 'PUT', url: `${B}/rows/reorder`, payload: [{ id: ids.b, sort_order: 1 }, { id: ids.c, sort_order: 2147483648 }] })
    expect(bad.statusCode).toBe(500)
    expect(bad.json()).toEqual({ error: '服务器内部错误，请稍后重试' })
    expect((await s.inject({ method: 'PUT', url: `${B}/rows/reorder`, payload: [{ id: ids.b, sort_order: 1 }, 'x'] })).statusCode).toBe(500)
    const [b] = await handle.db.select().from(cc_advanced_table_rows).where(eq(cc_advanced_table_rows.id, ids.b!))
    expect(b!.sort_order).toBe(20)
  })

  it('批量更新：按找到的行计数；校验；非法状态 → 500 回滚', async () => {
    const res = await s.inject({
      method: 'POST',
      url: `${B}/rows/batch-update`,
      payload: { ids: [ids.b, String(ids.c), ids.b, 99999999, null], status: 'ARCHIVED', owner: ` ${P}o `, is_active: 'false', priority: '9' },
    })
    expect(res.json()).toEqual({ message: '已更新 2 条记录' })
    const rows = await handle.db.select().from(cc_advanced_table_rows).where(inArray(cc_advanced_table_rows.id, [ids.b!, ids.c!]))
    for (const r of rows) expect([r.status, r.owner, r.is_active, r.priority]).toEqual(['archived', `${P}o`, false, 9])

    expect((await s.inject({ method: 'POST', url: `${B}/rows/batch-update`, payload: {} })).json()).toEqual({ error: '请先选择要操作的数据' })
    expect((await s.inject({ method: 'POST', url: `${B}/rows/batch-update`, payload: { ids: 'x' } })).json()).toEqual({ error: '请先选择要操作的数据' })
    expect((await s.inject({ method: 'POST', url: `${B}/rows/batch-update`, payload: { ids: [99999999] } })).json()).toEqual({ error: '未找到可更新的数据' })
    expect((await s.inject({ method: 'POST', url: `${B}/rows/batch-update`, payload: { ids: ['abc'] } })).statusCode).toBe(500)
    const bad = await s.inject({ method: 'POST', url: `${B}/rows/batch-update`, payload: { ids: [ids.b, ids.c], status: 'nope', priority: 1 } })
    expect(bad.statusCode).toBe(500)
    const [b] = await handle.db.select().from(cc_advanced_table_rows).where(eq(cc_advanced_table_rows.id, ids.b!))
    expect(b!.priority).toBe(9)
  })

  it('无权限 → 403；404 先于 403', async () => {
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
    expect((await u.inject({ method: 'DELETE', url: `${B}/rows/99999999` })).statusCode).toBe(404)
  })

  it('删除 / 批量删除', async () => {
    s = await superAdminSession(app, handle) // createFixture 会清掉 ck_test_ 前缀的用户（含 super 测试账号）
    expect((await s.inject({ method: 'DELETE', url: `${B}/rows/${ids.a}` })).json()).toEqual({ message: '删除成功' })
    expect((await s.inject({ method: 'DELETE', url: `${B}/rows/${ids.a}` })).statusCode).toBe(404)
    expect((await s.inject({ method: 'POST', url: `${B}/rows/batch-delete`, payload: { ids: [] } })).json()).toEqual({ error: '请先选择要删除的数据' })
    expect((await s.inject({ method: 'POST', url: `${B}/rows/batch-delete`, payload: { ids: [ids.a] } })).json()).toEqual({ error: '未找到可删除的数据' })
    const res = await s.inject({ method: 'POST', url: `${B}/rows/batch-delete`, payload: { ids: [ids.b, ids.c, ids.a] } })
    expect(res.json()).toEqual({ message: '已删除 2 条记录' })
    expect(await handle.db.select().from(cc_advanced_table_rows).where(like(cc_advanced_table_rows.row_code, `${P}%`))).toHaveLength(0)
  })
})
