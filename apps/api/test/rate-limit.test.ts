import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DbHandle } from '@/db/client'
import { system_settings } from '@/db/schema'
import { buildTestApp, openTestDb } from './helpers'

// The rest of the suite runs with RATE_LIMIT_ENABLED=false; this file turns it on with the lowest limits
let app: FastifyInstance
let handle: DbHandle

beforeAll(async () => {
  handle = openTestDb()
  await handle.db.delete(system_settings)
  await handle.db.insert(system_settings).values([
    { key: 'security.rate_limit_per_minute', value: 60 },
    { key: 'security.auth_rate_limit_per_minute', value: 3 },
  ])
  app = await buildTestApp({ rateLimitEnabled: true })
  await app.settings.get()
})

afterAll(async () => {
  await handle.db.delete(system_settings)
  await app.close()
  await handle.pool.end()
})

const login = (lang?: string) =>
  app.inject({
    method: 'POST',
    url: '/api/admin/login',
    payload: { username: 'ck_test_nobody', password: 'x' },
    remoteAddress: '10.0.0.1',
    headers: lang ? { 'accept-language': lang } : {},
  })

describe('rate limit', () => {
  it('登录类接口共用更严格的额度：超过后 429 + Retry-After，报错按语言翻译', async () => {
    for (let i = 0; i < 3; i++) expect((await login()).statusCode).not.toBe(429)
    const res = await login()
    expect(res.statusCode).toBe(429)
    expect(res.json()).toEqual({ error: '请求过于频繁，请稍后再试' })
    expect(Number(res.headers['retry-after'])).toBeGreaterThan(0)
    expect((await login('en-US')).json()).toEqual({ error: 'Too many requests. Please try again later.' })
    // Login, 2FA code and password reset share the same counter
    const reset = await app.inject({ method: 'POST', url: '/api/admin/password-reset/request', payload: {}, remoteAddress: '10.0.0.1' })
    expect(reset.statusCode).toBe(429)
    const twoFactor = await app.inject({ method: 'POST', url: '/api/admin/login/two-factor', payload: {}, remoteAddress: '10.0.0.1' })
    expect(twoFactor.statusCode).toBe(429)
    // Other IPs are counted separately
    const other = await app.inject({ method: 'POST', url: '/api/admin/login', payload: {}, remoteAddress: '10.0.0.2' })
    expect(other.statusCode).not.toBe(429)
  })

  it('全局额度按 IP 计数；/health 与非 /api 路径不计', async () => {
    const get = (url: string) => app.inject({ url, remoteAddress: '10.0.0.3' })
    for (let i = 0; i < 60; i++) expect((await get('/api/admin/app-info')).statusCode).toBe(200)
    const limited = await get('/api/admin/app-info')
    expect(limited.statusCode).toBe(429)
    expect(limited.json()).toEqual({ error: '请求过于频繁，请稍后再试' })
    expect(limited.headers['x-ratelimit-limit']).toBe('60')
    expect((await get('/health')).statusCode).toBe(200)
    expect((await get('/some/spa/page')).statusCode).not.toBe(429)
    expect((await app.inject({ url: '/api/admin/app-info', remoteAddress: '10.0.0.4' })).statusCode).toBe(200)
  })
})
