/**
 * Public demo mode (DEMO_MODE): config, write guard, app-info, lockout rule and the data reset.
 */
import type { FastifyInstance } from 'fastify'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { DemoAiQuota, isDemoWritable } from '@/common/demo'
import { deriveReadonlyUrl, loadConfig } from '@/config'
import type { DbHandle } from '@/db/client'
import { login_logs } from '@/db/schema'
import { DEMO_FIXTURES } from '@/demo/fixtures'
import { resetDemoData, resetDemoIfDue, shiftDate } from '@/demo/reset'
import { startFakeUpstream, type FakeUpstream } from './cc-ai-fake-upstream'
import {
  buildTestApp,
  cleanupFixture,
  createFixture,
  FIXTURE_PASSWORD,
  FIXTURE_USER,
  openTestDb,
  superAdminSession,
  TEST_DATABASE_URL,
  type AuthedSession,
} from './helpers'

describe('demo config', () => {
  it('reads DEMO_MODE and DEMO_RESET_HOURS', () => {
    const config = loadConfig({ NODE_ENV: 'development', DEMO_MODE: 'true', DEMO_RESET_HOURS: '6' })
    expect(config.demoMode).toBe(true)
    expect(config.demoResetHours).toBe(6)
    expect(loadConfig({ NODE_ENV: 'development' }).demoMode).toBe(false)
  })

  it('derives the AI SQL read-only URL from DATABASE_URL + POSTGRES_RO_PASSWORD in production', () => {
    const config = loadConfig({
      NODE_ENV: 'production',
      SECRET_KEY: 's',
      ADMIN_PASSWORD: 'p',
      DATABASE_URL: 'postgresql://owner:secret@ep-x.neon.tech/neondb?sslmode=require',
      POSTGRES_RO_PASSWORD: 'ro pass',
    })
    const url = new URL(config.aiSqlDatabaseUrl)
    expect(url.username).toBe('castor_kit_ro')
    expect(decodeURIComponent(url.password)).toBe('ro pass')
    expect(url.host).toBe('ep-x.neon.tech')
    expect(url.pathname).toBe('/neondb')
    expect(url.searchParams.get('sslmode')).toBe('require')
    expect(deriveReadonlyUrl('postgresql://a:b@db/castor_kit', 'x')).toBe('postgresql://castor_kit_ro:x@db/castor_kit')
  })
})

describe('demo write guard', () => {
  it('keeps sign-in, the component gallery and notification reads writable', () => {
    for (const path of [
      '/api/admin/login',
      '/api/admin/logout',
      '/api/admin/component-center/kanban/cards',
      '/api/admin/notifications/12/read',
      '/api/admin/notifications/read-all',
    ]) {
      expect(isDemoWritable(path), path).toBe(true)
    }
    for (const path of ['/api/admin/users', '/api/admin/roles/1', '/api/admin/change-password', '/api/admin/notifications', '/api/admin/scheduled-tasks']) {
      expect(isDemoWritable(path), path).toBe(false)
    }
  })
})

describe('demo mode app', () => {
  let app: FastifyInstance
  let normal: FastifyInstance
  let handle: DbHandle
  let s: AuthedSession

  beforeAll(async () => {
    handle = openTestDb()
    await createFixture(handle)
    app = await buildTestApp({ demoMode: true, demoResetHours: 24, adminPassword: 'demo-pass' })
    normal = await buildTestApp()
    s = await superAdminSession(app, handle)
  })

  afterAll(async () => {
    await cleanupFixture(handle)
    await app.close()
    await normal.close()
    await handle.pool.end()
  })

  it('app-info exposes the demo account only in demo mode', async () => {
    const demo = await app.inject({ method: 'GET', url: '/api/admin/app-info' })
    expect(demo.json()).toEqual({ demo_mode: true, demo_reset_hours: 24, demo_account: { username: 'admin', password: 'demo-pass' } })
    const off = await normal.inject({ method: 'GET', url: '/api/admin/app-info' })
    expect(off.json()).toEqual({ demo_mode: false })
  })

  it('rejects writes to system management with a translated 403', async () => {
    const res = await s.inject({ method: 'POST', url: '/api/admin/users', payload: { username: 'ck_test_demo_x', password: 'x' } })
    expect(res.statusCode).toBe(403)
    expect(res.json()).toEqual({ error: '演示环境不允许此操作' })
    const en = await s.inject({ method: 'PUT', url: '/api/admin/change-password', headers: { 'accept-language': 'en-US' }, payload: {} })
    expect(en.statusCode).toBe(403)
    expect(en.json()).toEqual({ error: 'This action is disabled in the demo.' })
  })

  it('lets reads and gallery writes through', async () => {
    expect((await s.inject({ method: 'GET', url: '/api/admin/users' })).statusCode).toBe(200)
    const res = await s.inject({ method: 'POST', url: '/api/admin/component-center/kanban/boards', payload: {} })
    expect(res.statusCode).not.toBe(403)
  })

  it('does not lock the shared account by username in demo mode', async () => {
    await handle.db.insert(login_logs).values(
      Array.from({ length: 12 }, () => ({ username: FIXTURE_USER, status: 'failed', ip: '10.99.0.1', message: 'x' })),
    )
    // Normal mode: the username alone is locked out, even from a new IP
    const locked = await normal.inject({
      method: 'POST',
      url: '/api/admin/login',
      remoteAddress: '10.99.0.2',
      payload: { username: FIXTURE_USER, password: FIXTURE_PASSWORD },
    })
    expect(locked.statusCode).toBe(429)
    // Demo mode: only the IP dimension counts, so the shared account still signs in from another IP
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/login',
      remoteAddress: '10.99.0.2',
      payload: { username: FIXTURE_USER, password: FIXTURE_PASSWORD },
    })
    expect(res.statusCode).toBe(200)
  })
})

describe('demo data reset', () => {
  it('shifts fixture dates relative to today', () => {
    expect(shiftDate('2026-03-28', 10)).toBe('2026-04-07')
    expect(shiftDate('2026-03-21T09:00:00', -1)).toBe('2026-03-20T09:00:00')
    expect(shiftDate(null, 5)).toBe(null)
  })

  it('restores every fixture table and only resets again when due', async () => {
    const client = new pg.Client({ connectionString: TEST_DATABASE_URL })
    await client.connect()
    try {
      const now = new Date(Date.UTC(2026, 3, 1, 8, 0, 0))
      await resetDemoData(client, now)
      for (const [table, rows] of DEMO_FIXTURES) {
        const { rows: count } = await client.query<{ n: string }>(`SELECT count(*) AS n FROM ${client.escapeIdentifier(table)}`)
        expect(Number(count[0]!.n), table).toBe(rows.length)
      }
      // Sequences continue after the fixture ids
      const { rows: next } = await client.query<{ id: number }>(
        "INSERT INTO kanban_boards (title, board_code) VALUES ('x', 'ck_test_seq') RETURNING id",
      )
      expect(next[0]!.id).toBeGreaterThan(DEMO_FIXTURES.find(([t]) => t === 'kanban_boards')![1].length)
      await client.query("DELETE FROM kanban_boards WHERE board_code = 'ck_test_seq'")

      const later = new Date(now.getTime() + 3_600_000)
      expect(await resetDemoIfDue({ databaseUrl: TEST_DATABASE_URL, resetHours: 24, now: later, log: () => {} })).toBe(false)
      const dayLater = new Date(now.getTime() + 25 * 3_600_000)
      expect(await resetDemoIfDue({ databaseUrl: TEST_DATABASE_URL, resetHours: 24, now: dayLater, log: () => {} })).toBe(true)
    } finally {
      await client.end()
    }
  })
})

describe('demo AI quota', () => {
  it('limits calls per IP per hour and per day for the whole site', () => {
    const quota = new DemoAiQuota({ hourlyPerIp: 2, daily: 3 })
    const t0 = Date.UTC(2026, 3, 1, 8, 10)
    expect(quota.take('a', t0)).toEqual({ ok: true })
    expect(quota.take('a', t0)).toEqual({ ok: true })
    expect(quota.take('a', t0)).toEqual({ ok: false, reason: 'ip' })
    expect(quota.take('b', t0)).toEqual({ ok: true })
    expect(quota.take('c', t0)).toEqual({ ok: false, reason: 'day' })
    // Next hour the per-IP window resets, but the day is still used up
    expect(quota.take('a', t0 + 3_600_000)).toEqual({ ok: false, reason: 'day' })
    // Next day both reset
    expect(quota.take('a', t0 + 86_400_000)).toEqual({ ok: true })
  })

  describe('on the AI endpoints', () => {
    let up: FakeUpstream
    let app: FastifyInstance
    let handle: DbHandle
    let s: AuthedSession
    const GENERATE = '/api/admin/component-center/ai/sql/generate'

    beforeAll(async () => {
      handle = openTestDb()
      up = await startFakeUpstream()
      app = await buildTestApp({
        aiApiBase: up.url,
        aiApiKey: 'x',
        aiModel: 'm',
        demoMode: true,
        demoAiHourlyPerIp: 2,
        demoAiDaily: 100,
        demoAiMaxInputChars: 200,
      })
      s = await superAdminSession(app, handle)
    })

    afterAll(async () => {
      await app.close()
      await up.close()
      await handle.pool.end()
    })

    it('does not count signed-out requests', async () => {
      const res = await app.inject({ method: 'POST', url: GENERATE, payload: { question: 'x' } })
      expect(res.statusCode).toBe(401)
    })

    it('rejects oversized input without using quota', async () => {
      const res = await s.inject({ method: 'POST', url: GENERATE, payload: { question: 'x'.repeat(300) } })
      expect(res.statusCode).toBe(400)
      expect(res.json()).toEqual({ error: '演示环境单次输入过长，请精简后再试' })
    })

    it('caps the reply length upstream and returns a translated 429 once the hourly quota is used', async () => {
      const before = up.requests.length
      expect((await s.inject({ method: 'POST', url: GENERATE, payload: { question: '列出看板' } })).statusCode).not.toBe(429)
      expect(up.requests[before]!.body).toMatchObject({ max_tokens: 2048 })
      expect((await s.inject({ method: 'POST', url: GENERATE, payload: { question: '列出看板' } })).statusCode).not.toBe(429)
      const limited = await s.inject({
        method: 'POST',
        url: GENERATE,
        headers: { 'accept-language': 'en-US' },
        payload: { question: '列出看板' },
      })
      expect(limited.statusCode).toBe(429)
      expect(limited.json()).toEqual({ error: 'Too many AI requests in the demo. Please try again later.' })
    })
  })
})
