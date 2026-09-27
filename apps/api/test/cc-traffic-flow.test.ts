import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DbHandle } from '@/db/client'
import { SOURCE_LINKS } from '@/modules/component-center/traffic-flow/schema'
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

const URL = '/api/admin/component-center/dataviz/traffic-flow/data'
let app: FastifyInstance
let handle: DbHandle
let s: AuthedSession

type Link = { source: string; target: string; value: number }
type Body = { links: Link[]; funnel: { stage: string; value: number }[] }

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

describe('traffic-flow', () => {
  it('来源 → 页面在基准值 ±5% 内；每个页面流入等于流出；漏斗逐级递减且起点是总访问量', async () => {
    for (let i = 0; i < 5; i += 1) {
      const res = await s.inject({ url: URL })
      expect(res.statusCode).toBe(200)
      const body = res.json() as Body
      expect(Object.keys(body).sort()).toEqual(['funnel', 'links'])

      const sourceLinks = body.links.slice(0, SOURCE_LINKS.length)
      sourceLinks.forEach((l, idx) => {
        const base = SOURCE_LINKS[idx]!
        expect([l.source, l.target]).toEqual([base.source, base.target])
        expect(Number.isInteger(l.value) && Math.abs(l.value - base.value) <= Math.ceil(base.value * 0.05)).toBe(true)
      })

      const sum = (links: Link[]) => links.reduce((a, l) => a + l.value, 0)
      for (const page of ['home', 'product', 'campaign']) {
        const inflow = sum(body.links.filter((l) => l.target === page))
        const outflow = sum(body.links.filter((l) => l.source === page))
        expect(outflow, page).toBe(inflow)
      }

      expect(body.funnel.map((f) => f.stage)).toEqual(['visit', 'view', 'cart', 'order', 'pay'])
      expect(body.funnel[0]!.value).toBe(sum(sourceLinks))
      body.funnel.slice(1).forEach((f, idx) => expect(f.value).toBeLessThan(body.funnel[idx]!.value))
    }
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
