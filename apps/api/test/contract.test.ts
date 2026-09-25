/**
 * HTTP contract snapshots (see "Cross-cutting conventions" in docs/architecture.md): response shape, error structure, csrf_token, time format, session cookie.
 * Uses a real PostgreSQL (TEST_DATABASE_URL) + app.inject(); fixture data is created and deleted by the tests themselves.
 */

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { and, desc, eq } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { checkPasswordHash } from '@/common/password'
import type { DbHandle } from '@/db/client'
import { admin_users, login_logs, operation_logs } from '@/db/schema'
import {
  FIXTURE_PASSWORD,
  FIXTURE_USER,
  buildTestApp,
  cleanupFixture,
  createFixture,
  openTestDb,
  sessionCookie,
  type Fixture,
} from './helpers'

/** Python isoformat(): no Z, and no fractional part when microseconds are 0 */
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{6})?$/

let app: FastifyInstance
let handle: DbHandle
let fx: Fixture

async function login(username = FIXTURE_USER, password = FIXTURE_PASSWORD, remoteAddress?: string) {
  return app.inject({
    method: 'POST',
    url: '/api/admin/login',
    payload: { username, password },
    ...(remoteAddress ? { remoteAddress } : {}),
  })
}

async function loggedIn() {
  const res = await login()
  expect(res.statusCode).toBe(200)
  return { cookie: sessionCookie(res)!, csrf: res.json().csrf_token as string }
}

beforeAll(async () => {
  handle = openTestDb()
  fx = await createFixture(handle)
  app = await buildTestApp()
})

afterAll(async () => {
  await app?.close()
  await cleanupFixture(handle)
  await handle.pool.end()
})

describe('内置路由与错误形状', () => {
  it('/health', async () => {
    const res = await app.inject('/health')
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(Object.keys(body).sort()).toEqual(['database', 'status', 'timestamp'])
    expect(body.status).toBe('healthy')
    expect(body.database).toBe('connected')
    expect(body.timestamp).toMatch(ISO_RE)
  })

  it('/api 未知路径 → 404 JSON', async () => {
    const res = await app.inject('/api/admin/definitely-not-here')
    expect(res.statusCode).toBe(404)
    expect(res.json()).toEqual({ error: '资源不存在' })
  })

  it('未命中路由的非 GET 方法一律 405；GET 只注册了 POST 的路径是 404', async () => {
    const del = await app.inject({ method: 'DELETE', url: '/api/admin/my-menus' })
    expect(del.statusCode).toBe(405)
    expect(del.json()).toEqual({ error: '请求方法不允许' })
    const postUnknown = await app.inject({ method: 'POST', url: '/api/admin/definitely-not-here' })
    expect(postUnknown.statusCode).toBe(405)
    const getPostOnly = await app.inject('/api/admin/login')
    expect(getPostOnly.statusCode).toBe(404)
    expect(getPostOnly.json()).toEqual({ error: '资源不存在' })
  })

  it('未登录访问受保护接口 → 401 带 redirect', async () => {
    const res = await app.inject('/api/admin/me')
    expect(res.statusCode).toBe(401)
    expect(res.json()).toEqual({ error: '未授权访问', redirect: '/admin/login' })
  })

  it('/admin/login 页面路由按登录态重定向', async () => {
    const anon = await app.inject('/admin/login')
    expect(anon.statusCode).toBe(302)
    expect(anon.headers.location).toBe('/')
    const { cookie } = await loggedIn()
    const authed = await app.inject({ url: '/admin/login', cookies: { castor_session: cookie } })
    expect(authed.headers.location).toBe('/admin')
  })
})

describe('登录 / 会话', () => {
  it('密码错误 → 401，写失败登录日志', async () => {
    const res = await login(FIXTURE_USER, 'wrong-password')
    expect(res.statusCode).toBe(401)
    expect(res.json()).toEqual({ error: '用户名或密码错误' })
    const [log] = await handle.db
      .select()
      .from(login_logs)
      .where(eq(login_logs.username, FIXTURE_USER))
      .orderBy(desc(login_logs.id))
      .limit(1)
    expect(log).toMatchObject({ status: 'failed', user_id: fx.userId, message: '用户名或密码错误' })
    expect(log!.created_at).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{1,6}$/)
  })

  it('登录成功：形状、csrf_token、cookie 属性，并清零失败计数', async () => {
    const res = await login()
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(Object.keys(body).sort()).toEqual(['csrf_token', 'message', 'user'])
    expect(body.message).toBe('登录成功')
    expect(body.csrf_token).toMatch(/^[0-9a-f]{32}$/)

    const user = body.user
    expect(Object.keys(user).sort()).toEqual(['created_at', 'id', 'menu_codes', 'roles', 'username'])
    expect(user).toMatchObject({ id: fx.userId, username: FIXTURE_USER })
    expect(user.created_at).toMatch(ISO_RE)
    expect(user.roles).toHaveLength(1)
    expect(Object.keys(user.roles[0]).sort()).toEqual(['code', 'created_at', 'description', 'id', 'name'])
    expect(user.roles[0].created_at).toMatch(ISO_RE)
    // Order not guaranteed → compare as sets
    expect([...user.menu_codes].sort()).toEqual([...fx.assignedCodes].sort())

    const cookie = res.cookies.find((c) => c.name === 'castor_session')!
    expect(cookie.httpOnly).toBe(true)
    expect(cookie.sameSite).toBe('Lax')
    expect(cookie.secure).toBeFalsy()
    expect(cookie.path).toBe('/')
    expect(cookie.maxAge).toBe(8 * 3600)

    const failed = await handle.db
      .select()
      .from(login_logs)
      .where(and(eq(login_logs.username, FIXTURE_USER), eq(login_logs.status, 'failed')))
    expect(failed).toHaveLength(0)
  })

  it('反代声明 https 时 cookie 带 Secure（auto 策略）', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/login',
      headers: { 'x-forwarded-proto': 'https' },
      payload: { username: FIXTURE_USER, password: FIXTURE_PASSWORD },
    })
    expect(res.cookies.find((c) => c.name === 'castor_session')!.secure).toBe(true)
  })

  it('me / csrf-token 返回同一个 csrf_token', async () => {
    const { cookie, csrf } = await loggedIn()
    const me = await app.inject({ url: '/api/admin/me', cookies: { castor_session: cookie } })
    expect(me.statusCode).toBe(200)
    expect(Object.keys(me.json()).sort()).toEqual(['csrf_token', 'user'])
    expect(me.json().csrf_token).toBe(csrf)
    expect(me.json().user.username).toBe(FIXTURE_USER)
    // Sliding expiration: authenticated requests re-issue the cookie
    expect(sessionCookie(me)).toBeTruthy()

    const token = await app.inject({ url: '/api/admin/csrf-token', cookies: { castor_session: cookie } })
    expect(token.json()).toEqual({ csrf_token: csrf })
  })

  it('篡改的 cookie 视为未登录', async () => {
    const res = await app.inject({ url: '/api/admin/me', cookies: { castor_session: 'garbage;data' } })
    expect(res.statusCode).toBe(401)
  })

  it('同一 IP 失败次数达到阈值 → 429', async () => {
    const strict = await buildTestApp({ loginMaxFailures: 3 })
    try {
      const attempt = () =>
        strict.inject({
          method: 'POST',
          url: '/api/admin/login',
          remoteAddress: '10.99.0.1',
          payload: { username: `ck_test_nobody`, password: 'x' },
        })
      for (let i = 0; i < 3; i += 1) expect((await attempt()).statusCode).toBe(401)
      const blocked = await attempt()
      expect(blocked.statusCode).toBe(429)
      expect(blocked.json()).toEqual({ error: '登录失败次数过多，请稍后再试' })
    } finally {
      await strict.close()
    }
  })
})

describe('my-menus', () => {
  it('只含启用且可见的已分配菜单 + 其祖先；叶子没有 children 键', async () => {
    const { cookie } = await loggedIn()
    const res = await app.inject({ url: '/api/admin/my-menus', cookies: { castor_session: cookie } })
    expect(res.statusCode).toBe(200)
    const tree = res.json()
    expect(tree).toHaveLength(1)
    const root = tree[0]
    expect(root.id).toBe(fx.rootId)
    expect(Object.keys(root).sort()).toEqual(
      [
        'children', 'code', 'component', 'created_at', 'description', 'icon', 'id', 'is_active',
        'is_visible', 'menu_type', 'name', 'parent_id', 'path', 'sort_order', 'updated_at',
      ].sort(),
    )
    expect(root.created_at).toMatch(ISO_RE)
    expect(root.updated_at).toMatch(ISO_RE)
    expect(root.children.map((m: { id: number }) => m.id)).toEqual([fx.childId])
    expect('children' in root.children[0]).toBe(false)
  })
})

describe('CSRF', () => {
  it('已登录的状态变更请求缺少/错误 token → 403', async () => {
    const { cookie } = await loggedIn()
    const missing = await app.inject({
      method: 'POST',
      url: '/api/admin/change-password',
      cookies: { castor_session: cookie },
      payload: {},
    })
    expect(missing.statusCode).toBe(403)
    expect(missing.json()).toEqual({ error: 'CSRF 校验失败，请刷新页面后重试' })

    const wrong = await app.inject({
      method: 'POST',
      url: '/api/admin/change-password',
      cookies: { castor_session: cookie },
      headers: { 'x-csrf-token': 'deadbeef' },
      payload: {},
    })
    expect(wrong.statusCode).toBe(403)
  })

  it('登录接口豁免；未登录请求跳过 CSRF（交给 loginRequired）', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/admin/change-password', payload: {} })
    expect(res.statusCode).toBe(401)
  })
})

describe('改密 / 登出', () => {
  it('校验、旧密码错误、成功后写 pbkdf2:sha256 格式哈希并记操作日志', async () => {
    const { cookie, csrf } = await loggedIn()
    const post = (payload: unknown) =>
      app.inject({
        method: 'POST',
        url: '/api/admin/change-password',
        cookies: { castor_session: cookie },
        headers: { 'x-csrf-token': csrf },
        payload: payload as object,
      })

    expect((await post({})).json()).toEqual({ error: '请填写完整信息' })
    expect((await post({ old_password: 'a', new_password: '12345' })).json()).toEqual({ error: '新密码长度至少6位' })
    const wrongOld = await post({ old_password: 'nope', new_password: '123456' })
    expect(wrongOld.statusCode).toBe(400)
    expect(wrongOld.json()).toEqual({ error: '旧密码错误' })

    const ok = await post({ old_password: FIXTURE_PASSWORD, new_password: 'changed-pass-2' })
    expect(ok.statusCode).toBe(200)
    expect(ok.json()).toEqual({ message: '密码修改成功' })

    const [row] = await handle.db.select().from(admin_users).where(eq(admin_users.id, fx.userId))
    expect(row!.password_hash).toMatch(/^pbkdf2:sha256:1000000\$[A-Za-z0-9]{16}\$[0-9a-f]{64}$/)
    expect(await checkPasswordHash(row!.password_hash, 'changed-pass-2')).toBe(true)

    // The onResponse audit hook persists asynchronously; wait a bit before querying
    await new Promise((r) => setTimeout(r, 100))
    const [log] = await handle.db
      .select()
      .from(operation_logs)
      .where(and(eq(operation_logs.user_id, fx.userId), eq(operation_logs.status_code, 200)))
      .orderBy(desc(operation_logs.id))
      .limit(1)
    expect(log).toMatchObject({
      module: 'auth',
      action: 'change_password',
      method: 'POST',
      path: '/api/admin/change-password',
      target_id: null,
      payload: '{"old_password": "***", "new_password": "***"}',
    })

    // Restore the fixture password so later cases can keep using it
    await handle.db.delete(admin_users).where(eq(admin_users.id, fx.userId))
    fx = await createFixture(handle)
  })

  it('登出：清 cookie、只记一条 logout 操作日志、之后 me 为 401', async () => {
    const { cookie, csrf } = await loggedIn()
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/logout',
      cookies: { castor_session: cookie },
      headers: { 'x-csrf-token': csrf },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ message: '已退出登录' })
    const cleared = res.cookies.find((c) => c.name === 'castor_session')!
    expect(cleared.value).toBe('')
    expect(cleared.maxAge).toBe(0)

    await new Promise((r) => setTimeout(r, 100))
    const logs = await handle.db
      .select()
      .from(operation_logs)
      .where(and(eq(operation_logs.user_id, fx.userId), eq(operation_logs.path, '/api/admin/logout')))
    expect(logs).toHaveLength(1)
    expect(logs[0]).toMatchObject({ module: 'auth', action: 'logout', status_code: 200, payload: null })

    const me = await app.inject({ url: '/api/admin/me', cookies: { castor_session: cleared.value } })
    expect(me.statusCode).toBe(401)
  })
})

describe('SPA fallback', () => {
  it('无前端产物时非 /api 路径返回 JSON 提示', async () => {
    const res = await app.inject('/admin/users')
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ message: 'castor-kit API', status: 'running' })
  })

  it('有前端产物时非 /api 路径落到 index.html，/api 仍为 JSON，静态资源带长缓存', async () => {
    const dist = mkdtempSync(join(tmpdir(), 'castor-kit-dist-'))
    writeFileSync(join(dist, 'index.html'), '<!doctype html><title>castor-kit</title>')
    writeFileSync(join(dist, 'app.js'), 'console.log(1)')
    const spa = await buildTestApp({ webDistDir: dist })
    try {
      const page = await spa.inject('/admin/users')
      expect(page.statusCode).toBe(200)
      expect(page.headers['content-type']).toContain('text/html')
      expect(page.body).toContain('castor-kit')

      const asset = await spa.inject('/app.js')
      expect(asset.headers['cache-control']).toBe('public, max-age=604800')

      const api = await spa.inject('/api/admin/unknown')
      expect(api.statusCode).toBe(404)
      expect(api.json()).toEqual({ error: '资源不存在' })
    } finally {
      await spa.close()
      rmSync(dist, { recursive: true, force: true })
    }
  })
})
