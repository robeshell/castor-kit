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
  it('统计：只需登录；计数与数据库一致；近 7 天按 UTC 日期聚合', async () => {
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

  it('未登录 → 401', async () => {
    const res = await app.inject({ url: '/api/admin/dashboard/stats' })
    expect([res.statusCode, res.json()]).toEqual([401, { error: '未授权访问', redirect: '/admin/login' }])
  })
})
