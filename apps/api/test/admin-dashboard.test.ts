import { count, sql } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DbHandle } from '@/db/client'
import { admin_users, menus, operation_logs, roles } from '@/db/schema'
import {
  buildTestApp,
  cleanupFixture,
  createFixture,
  FIXTURE_PASSWORD,
  FIXTURE_USER,
  loginSession,
  openTestDb,
  scopedSession,
  type AuthedSession,
} from './helpers'

let app: FastifyInstance
let handle: DbHandle
let u: AuthedSession
const insertedLogIds: number[] = []

beforeAll(async () => {
  handle = openTestDb()
  app = await buildTestApp()
  const fx = await createFixture(handle)
  u = await loginSession(app, FIXTURE_USER, FIXTURE_PASSWORD, fx.userId)
})

afterAll(async () => {
  if (insertedLogIds.length > 0) {
    await handle.db.execute(sql`DELETE FROM operation_logs WHERE id IN (${sql.join(insertedLogIds.map((id) => sql`${id}`), sql`, `)})`)
  }
  await cleanupFixture(handle)
  await app.close()
  await handle.pool.end()
})

async function scalar(query: ReturnType<typeof sql>): Promise<string> {
  const res = await handle.db.execute<{ v: string }>(sql`SELECT (${query})::text AS v`)
  return res.rows[0]!.v
}

describe('dashboard', () => {
  it('统计：只需登录；计数与数据库一致；没有 X-Time-Zone 时近 7 天按 UTC 日期聚合', async () => {
    // Create two operation logs: today (UTC) and 6 days ago (UTC), plus one 7 days ago (not counted)
    for (const offset of [0, 6, 7]) {
      const [row] = await handle.db
        .insert(operation_logs)
        .values({
          username: 'ck_test_r2_t_dash',
          module: 'test',
          action: 'test',
          method: 'POST',
          path: '/x',
          status_code: 200,
          created_at: sql`(timezone('utc', now()))::date - ${offset}::int + time '12:00'` as unknown as string,
        })
        .returning({ id: operation_logs.id })
      insertedLogIds.push(row!.id)
    }

    const res = await u.inject({ url: '/api/admin/dashboard/stats' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(Object.keys(body).sort()).toEqual(
      ['menu_count', 'role_count', 'today_log_count', 'user_count', 'week_labels', 'week_log_counts'].sort(),
    )

    const [users] = await handle.db.select({ n: count() }).from(admin_users)
    const [roleRows] = await handle.db.select({ n: count() }).from(roles)
    const [menuRows] = await handle.db.select({ n: count() }).from(menus)
    expect(body.user_count).toBe(users!.n)
    expect(body.role_count).toBe(roleRows!.n)
    expect(body.menu_count).toBe(menuRows!.n)

    const today = await scalar(sql`to_char((timezone('utc', now()))::date, 'MM/DD')`)
    const sixAgo = await scalar(sql`to_char((timezone('utc', now()))::date - 6, 'MM/DD')`)
    expect(body.week_labels).toHaveLength(7)
    expect(body.week_labels[6]).toBe(today)
    expect(body.week_labels[0]).toBe(sixAgo)

    const todayCount = Number(await scalar(sql`(SELECT count(*) FROM operation_logs WHERE created_at >= (timezone('utc', now()))::date)`))
    const sixAgoCount = Number(
      await scalar(sql`(SELECT count(*) FROM operation_logs WHERE date(created_at) = (timezone('utc', now()))::date - 6)`),
    )
    expect(body.today_log_count).toBe(todayCount)
    expect(body.week_log_counts).toHaveLength(7)
    expect(body.week_log_counts[6]).toBe(todayCount)
    expect(body.week_log_counts[0]).toBe(sixAgoCount)
    expect(body.week_log_counts[0]).toBeGreaterThanOrEqual(1)
    for (const n of body.week_log_counts) expect(Number.isInteger(n)).toBe(true)
  })

  it('X-Time-Zone：「今天」和近 7 天按调用方时区的日期计算', async () => {
    const zone = 'Pacific/Kiritimati' // UTC+14: its date is ahead of UTC's most of the day
    const body = (await u.inject({ url: '/api/admin/dashboard/stats', headers: { 'x-time-zone': zone } })).json()
    const localToday = sql`(timezone(${zone}, now()))::date`
    expect(body.week_labels[6]).toBe(await scalar(sql`to_char(${localToday}, 'MM/DD')`))
    expect(body.week_labels[0]).toBe(await scalar(sql`to_char(${localToday} - 6, 'MM/DD')`))
    const localCount = async (daysAgo: number) =>
      Number(
        await scalar(
          sql`(SELECT count(*) FROM operation_logs WHERE (timezone(${zone}, timezone('utc', created_at)))::date = ${localToday} - ${daysAgo}::int)`,
        ),
      )
    expect(body.today_log_count).toBe(await localCount(0))
    expect(body.week_log_counts[6]).toBe(await localCount(0))
    expect(body.week_log_counts[0]).toBe(await localCount(6))
  })

  it('未登录 → 401', async () => {
    const res = await app.inject({ url: '/api/admin/dashboard/stats' })
    expect([res.statusCode, res.json()]).toEqual([401, { error: '未授权访问', redirect: '/login' }])
  })

  it('系统状态：只需登录，不需要组件示例中心的权限；未登录 → 401', async () => {
    // A role with no gallery menu (the performance monitor's cc_devtools_perf_monitor is not granted)
    const plain = await scopedSession(app, handle, { name: 'dash_system', codes: [], dataScope: 'all' })
    const res = await plain.inject({ url: '/api/admin/dashboard/system' })
    expect(res.statusCode, res.body).toBe(200)
    const body = res.json()
    for (const key of ['cpu', 'mem_used', 'mem_total', 'mem_pct', 'disk_used', 'disk_total', 'disk_pct', 'net_sent', 'net_recv', 'ts']) {
      expect(typeof body[key], key).toBe('number')
    }
    expect((await app.inject({ url: '/api/admin/dashboard/system' })).statusCode).toBe(401)
  })
})
