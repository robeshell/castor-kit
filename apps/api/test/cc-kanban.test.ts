import { eq, inArray, like } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DbHandle } from '@/db/client'
import { kanban_boards, kanban_cards } from '@/db/schema'
import { pyDateFromIsoformat, parseLooseDate } from '@/common/py-date'
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
const B = '/api/admin/component-center/kanban'
let app: FastifyInstance
let handle: DbHandle
let s: AuthedSession

async function cleanup() {
  await handle.db.delete(kanban_cards).where(like(kanban_cards.card_code, `${P}%`))
  await handle.db.delete(kanban_boards).where(like(kanban_boards.board_code, `${P}%`))
}

beforeAll(async () => {
  handle = openTestDb()
  app = await buildTestApp()
  s = await superAdminSession(app, handle)
  await cleanup()
})

afterAll(async () => {
  await cleanup()
  await cleanupFixture(handle)
  await app.close()
  await handle.pool.end()
})

describe('py-date：date.fromisoformat(str(v)[:10])', () => {
  it.each([
    ['2024-01-01', '2024-01-01'],
    ['20240101', '2024-01-01'],
    ['20240101ab', '2024-01-01'],
    ['2024-W01', '2024-01-01'],
    ['2024W01', '2024-01-01'],
    ['2024W011', '2024-01-01'],
    ['2024-W01-1', '2024-01-01'],
    ['2024-W011x', null],
    ['2024W53', null],
    ['2020W53', '2020-12-28'],
    ['2024-01', null],
    ['2024-1-01', null],
    ['2024-13-01', null],
    ['0000-01-01', null],
    ['2024-02-30', null],
    ['20240101T1', '2024-01-01'],
    ['2024/01/01', null],
    ['2024-01-0１', null],
    ['１２３４-01-01', null],
    ['2024W011ab', '2024-01-01'],
    ['2024-W0', null],
    ['2024-W01-', null],
  ])('%s → %s', (input, expected) => {
    expect(pyDateFromIsoformat(input)).toBe(expected)
  })

  it('parseLooseDate：假值 → null；str() 后截取前 10 个字符；UTF-8 字节长度', () => {
    expect(parseLooseDate(null)).toBeNull()
    expect(parseLooseDate('')).toBeNull()
    expect(parseLooseDate(0)).toBeNull()
    expect(parseLooseDate(20240315)).toBe('2024-03-15')
    expect(parseLooseDate('2024-05-06T12:00:00Z')).toBe('2024-05-06')
    expect(parseLooseDate('20240101é')).toBe('2024-01-01') // 9 字符 = 10 字节
    expect(parseLooseDate(true)).toBeNull()
  })
})

describe('kanban', () => {
  let boardA: number
  let boardB: number

  it('新建列：201 + cards/cards_count；校验失败分支', async () => {
    const res = await s.inject({
      method: 'POST',
      url: `${B}/boards`,
      payload: { title: ' 列A ', board_code: ` ${P}a `, color: '', sort_order: '9000', wip_limit: 'x', is_active: 'no' },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    boardA = body.id
    expect(body).toMatchObject({
      title: '列A',
      board_code: `${P}a`,
      color: '#4080FF',
      sort_order: 9000,
      wip_limit: 0,
      is_active: false,
      cards_count: 0,
      cards: [],
    })
    expect(body.created_at).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d{6})?$/)

    const b2 = await s.inject({ method: 'POST', url: `${B}/boards`, payload: { title: '列B', board_code: `${P}b`, sort_order: 9001 } })
    boardB = b2.json().id
    expect(b2.json().is_active).toBe(true)

    const cases: [unknown, string][] = [
      [{}, '列标题不能为空'],
      [{ title: 'x' }, '列编码不能为空'],
      [{ title: 'x', board_code: `${P}a` }, '列编码已存在'],
    ]
    for (const [payload, error] of cases) {
      const r = await s.inject({ method: 'POST', url: `${B}/boards`, payload: payload as object })
      expect(r.statusCode).toBe(400)
      expect(r.json()).toEqual({ error })
    }
  })

  it('新建卡片：自动编码、日期/优先级归一化；列不存在 404；缺列 400', async () => {
    const res = await s.inject({
      method: 'POST',
      url: `${B}/cards`,
      payload: { title: '卡1', board_id: String(boardA), priority: 'nope', due_date: '2024-03-05xx', tags: ' ', sort_order: 5 },
    })
    expect(res.statusCode).toBe(201)
    const card = res.json()
    expect(card.card_code).toMatch(/^card_[0-9a-f]{8}$/)
    expect(card).toMatchObject({ board_id: boardA, priority: 'medium', due_date: '2024-03-05', tags: '', description: null, is_active: true })
    // 改成带前缀的编码便于清理
    await handle.db.update(kanban_cards).set({ card_code: `${P}c1` }).where(eq(kanban_cards.id, card.id))

    const c2 = await s.inject({ method: 'POST', url: `${B}/cards`, payload: { title: '卡2', board_id: boardA, card_code: `${P}c2`, priority: 'urgent' } })
    expect(c2.json()).toMatchObject({ card_code: `${P}c2`, priority: 'urgent', sort_order: 0 })
    // 编码冲突 → 重新生成 10 位
    const c3 = await s.inject({ method: 'POST', url: `${B}/cards`, payload: { title: '卡3', board_id: boardA, card_code: `${P}c2`, sort_order: 2 } })
    expect(c3.json().card_code).toMatch(/^card_[0-9a-f]{10}$/)
    await handle.db.update(kanban_cards).set({ card_code: `${P}c3` }).where(eq(kanban_cards.id, c3.json().id))

    expect((await s.inject({ method: 'POST', url: `${B}/cards`, payload: { board_id: boardA } })).json()).toEqual({ error: '卡片标题不能为空' })
    expect((await s.inject({ method: 'POST', url: `${B}/cards`, payload: { title: 'x', board_id: 'abc' } })).json()).toEqual({ error: '所属列不存在' })
    const nf = await s.inject({ method: 'POST', url: `${B}/cards`, payload: { title: 'x', board_id: 99999999999 } })
    expect(nf.statusCode).toBe(404)
    expect(nf.json()).toEqual({ error: '资源不存在' })
  })

  it('列列表：按 sort_order，卡片按 sort_order 嵌套', async () => {
    const res = await s.inject({ url: `${B}/boards` })
    expect(res.statusCode).toBe(200)
    const boards = res.json() as { id: number; sort_order: number; cards: { title: string }[]; cards_count: number }[]
    const orders = boards.map((b) => b.sort_order)
    expect(orders).toEqual([...orders].sort((a, b) => a - b))
    const a = boards.find((b) => b.id === boardA)!
    expect(a.cards_count).toBe(3)
    expect(a.cards.map((c) => c.title)).toEqual(['卡2', '卡3', '卡1'])
  })

  it('编辑列 / 卡片：部分字段；无变化不刷新 updated_at；404 / 405', async () => {
    const before = (await handle.db.select().from(kanban_boards).where(eq(kanban_boards.id, boardA)))[0]!
    const same = await s.inject({ method: 'PUT', url: `${B}/boards/${boardA}`, payload: { title: '列A', is_active: false } })
    expect(same.json().updated_at).toBe(before.updated_at!.replace(' ', 'T').replace(/\.(\d+)$/, (_, f: string) => `.${f.padEnd(6, '0')}`))

    const upd = await s.inject({ method: 'PUT', url: `${B}/boards/${boardA}`, payload: { title: '列A2', wip_limit: '3', color: null } })
    expect(upd.json()).toMatchObject({ title: '列A2', wip_limit: 3, color: '#4080FF' })
    expect(upd.json().updated_at).not.toBe(same.json().updated_at)
    expect((await s.inject({ method: 'PUT', url: `${B}/boards/${boardA}`, payload: { title: ' ' } })).json()).toEqual({ error: '列标题不能为空' })
    expect((await s.inject({ method: 'PUT', url: `${B}/boards/99999999`, payload: {} })).statusCode).toBe(404)
    expect((await s.inject({ method: 'PUT', url: `${B}/boards/abc`, payload: {} })).statusCode).toBe(405)

    const [card] = await handle.db.select().from(kanban_cards).where(eq(kanban_cards.card_code, `${P}c1`))
    const moved = await s.inject({
      method: 'PUT',
      url: `${B}/cards/${card!.id}`,
      payload: { board_id: boardB, priority: 'HIGH', due_date: '', description: ' d ', is_active: '启用' },
    })
    expect(moved.json()).toMatchObject({ board_id: boardB, priority: 'medium', due_date: null, description: 'd', is_active: true })
    const noBoard = await s.inject({ method: 'PUT', url: `${B}/cards/${card!.id}`, payload: { board_id: 0 } })
    expect(noBoard.json().board_id).toBe(boardB)
    expect((await s.inject({ method: 'PUT', url: `${B}/cards/${card!.id}`, payload: { board_id: 99999999 } })).statusCode).toBe(404)
    expect((await s.inject({ method: 'PUT', url: `${B}/cards/${card!.id}`, payload: { title: '' } })).json()).toEqual({ error: '卡片标题不能为空' })
    expect((await s.inject({ method: 'DELETE', url: `${B}/cards/99999999` })).statusCode).toBe(404)
  })

  it('排序：批量改列与顺序；校验；事务回滚', async () => {
    const cards = await handle.db.select().from(kanban_cards).where(like(kanban_cards.card_code, `${P}%`))
    const byCode = Object.fromEntries(cards.map((c) => [c.card_code, c]))
    const c2 = byCode[`${P}c2`]!
    const c3 = byCode[`${P}c3`]!

    const ok = await s.inject({
      method: 'PUT',
      url: `${B}/cards/reorder`,
      payload: [{ id: c2.id, board_id: boardB, sort_order: 5 }, { id: c3.id, sort_order: '7' }, { id: 99999999, board_id: boardA }],
    })
    expect(ok.json()).toEqual({ message: '排序已保存' })
    const after = await handle.db.select().from(kanban_cards).where(inArray(kanban_cards.id, [c2.id, c3.id]))
    const m = Object.fromEntries(after.map((c) => [c.id, c]))
    expect([m[c2.id]!.board_id, m[c2.id]!.sort_order]).toEqual([boardB, 5])
    expect([m[c3.id]!.board_id, m[c3.id]!.sort_order]).toEqual([boardA, 7])

    expect((await s.inject({ method: 'PUT', url: `${B}/cards/reorder`, payload: {} })).json()).toEqual({ message: '排序已保存' })
    expect((await s.inject({ method: 'PUT', url: `${B}/cards/reorder`, payload: { a: 1 } })).json()).toEqual({ error: '参数格式错误，需要数组' })
    const missing = await s.inject({ method: 'PUT', url: `${B}/cards/reorder`, payload: [{ id: c2.id, board_id: 99999999 }] })
    expect(missing.statusCode).toBe(400)
    expect(missing.json()).toEqual({ error: '目标列不存在' })
    expect((await s.inject({ method: 'PUT', url: `${B}/cards/reorder`, payload: [1] })).statusCode).toBe(500)

    // 第二条写入越界 → 整体回滚，第一条也不生效
    const bad = await s.inject({
      method: 'PUT',
      url: `${B}/cards/reorder`,
      payload: [{ id: c2.id, sort_order: 42 }, { id: c3.id, sort_order: 99999999999 }],
    })
    expect(bad.statusCode).toBe(500)
    expect(bad.json()).toEqual({ error: '服务器内部错误，请稍后重试' })
    const [c2After] = await handle.db.select().from(kanban_cards).where(eq(kanban_cards.id, c2.id))
    expect(c2After!.sort_order).toBe(5)
  })

  it('删除卡片 / 删除列（级联删除卡片）', async () => {
    const [c3] = await handle.db.select().from(kanban_cards).where(eq(kanban_cards.card_code, `${P}c3`))
    expect((await s.inject({ method: 'DELETE', url: `${B}/cards/${c3!.id}` })).json()).toEqual({ message: '删除成功' })
    expect((await s.inject({ method: 'DELETE', url: `${B}/boards/${boardB}` })).json()).toEqual({ message: '删除成功' })
    const left = await handle.db.select().from(kanban_cards).where(eq(kanban_cards.board_id, boardB))
    expect(left).toHaveLength(0)
    expect((await s.inject({ method: 'DELETE', url: `${B}/boards/${boardB}` })).statusCode).toBe(404)
  })

  it('主键序列落后：同步序列后重试成功', async () => {
    // 把序列拨回到一个已被占用的 id，确保下一次插入必然主键冲突（不依赖库里是否有 id=1 的种子数据）
    await handle.pool.query(
      "SELECT setval(pg_get_serial_sequence('kanban_boards', 'id'), (SELECT MIN(id) FROM kanban_boards), false)",
    )
    const res = await s.inject({ method: 'POST', url: `${B}/boards`, payload: { title: '序列', board_code: `${P}seq` } })
    expect(res.statusCode).toBe(201)
    const { rows } = await handle.pool.query('SELECT MAX(id) AS m FROM kanban_boards')
    expect(res.json().id).toBe(rows[0].m)
  })

  it('无权限 → 403；404 先于 403', async () => {
    const fx = await createFixture(handle)
    const u = await loginSession(app, FIXTURE_USER, FIXTURE_PASSWORD, fx.userId)
    expect((await u.inject({ url: `${B}/boards` })).json()).toEqual({ error: '无权限' })
    expect((await u.inject({ method: 'POST', url: `${B}/boards`, payload: {} })).json()).toEqual({ error: '无权限新建列' })
    expect((await u.inject({ method: 'PUT', url: `${B}/boards/${boardA}`, payload: {} })).json()).toEqual({ error: '无权限编辑列' })
    expect((await u.inject({ method: 'DELETE', url: `${B}/boards/${boardA}` })).json()).toEqual({ error: '无权限删除列' })
    expect((await u.inject({ method: 'PUT', url: `${B}/cards/reorder`, payload: [] })).json()).toEqual({ error: '无权限' })
    expect((await u.inject({ method: 'POST', url: `${B}/cards`, payload: {} })).json()).toEqual({ error: '无权限新建卡片' })
    const [c2] = await handle.db.insert(kanban_cards).values({ board_id: boardA, title: 'x', card_code: `${P}c9` }).returning()
    const put = await u.inject({ method: 'PUT', url: `${B}/cards/${c2!.id}`, payload: {} })
    expect(put.statusCode).toBe(403)
    expect(put.json()).toEqual({ error: '无权限编辑卡片' })
    expect((await u.inject({ method: 'DELETE', url: `${B}/cards/${c2!.id}` })).json()).toEqual({ error: '无权限删除卡片' })
    expect((await u.inject({ method: 'PUT', url: `${B}/cards/99999999`, payload: {} })).statusCode).toBe(404)
    expect((await app.inject({ url: `${B}/boards` })).statusCode).toBe(401)
  })
})
