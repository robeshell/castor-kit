import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DbHandle } from '@/db/client'
import { PROVINCE_DATA } from '@/modules/component-center/map-heatmap/schema'
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

const URL = '/api/admin/component-center/dataviz/map-heatmap/data'
let app: FastifyInstance
let handle: DbHandle
let s: AuthedSession

beforeAll(async () => {
  handle = openTestDb()
  app = await buildTestApp()
  s = await superAdminSession(app, handle)
})

afterAll(async () => {
  await cleanupFixture(handle)
  await app.close()
  await handle.pool.end()
})

describe('map-heatmap', () => {
  it('31 个省份，value 在基准值 ±200 内，seed ∈ [1,100]', async () => {
    for (let i = 0; i < 5; i += 1) {
      const res = await s.inject({ url: URL })
      expect(res.statusCode).toBe(200)
      const body = res.json() as { data: { name: string; value: number; lat: number; lng: number }[]; seed: number }
      expect(Object.keys(body).sort()).toEqual(['data', 'seed'])
      expect(Number.isInteger(body.seed) && body.seed >= 1 && body.seed <= 100).toBe(true)
      expect(body.data).toHaveLength(31)
      body.data.forEach((p, idx) => {
        const base = PROVINCE_DATA[idx]!
        expect(Object.keys(p)).toEqual(['name', 'value', 'lat', 'lng'])
        expect([p.name, p.lat, p.lng]).toEqual([base.name, base.lat, base.lng])
        expect(Number.isInteger(p.value) && Math.abs(p.value - base.value) <= 200).toBe(true)
      })
    }
  })

  it('逐字数据：首尾与合计', () => {
    expect(PROVINCE_DATA[0]).toEqual({ name: '广东', value: 12436, lat: 23.13, lng: 113.26 })
    expect(PROVINCE_DATA[30]).toEqual({ name: '西藏', value: 213, lat: 29.64, lng: 91.12 })
    expect(PROVINCE_DATA.reduce((a, p) => a + p.value, 0)).toBe(115409)
  })

  it('无权限 → 403；未登录 → 401', async () => {
    const fx = await createFixture(handle)
    const u = await loginSession(app, FIXTURE_USER, FIXTURE_PASSWORD, fx.userId)
    const res = await u.inject({ url: URL })
    expect(res.statusCode).toBe(403)
    expect(res.json()).toEqual({ error: '无权限' })
    expect((await app.inject({ url: URL })).statusCode).toBe(401)
  })
})
