import { createServer, type IncomingHttpHeaders, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import type { FastifyInstance } from 'fastify'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { EventBus, signatureOf } from '@/common/webhooks'
import type { DbHandle } from '@/db/client'
import { notifications, sessions, webhook_deliveries, webhooks } from '@/db/schema'
import {
  buildTestApp,
  cleanupFixture,
  createFixture,
  FIXTURE_PREFIX,
  openTestDb,
  scopedSession,
  superAdminSession,
  testConfig,
  type AuthedSession,
} from './helpers'

interface Received {
  headers: IncomingHttpHeaders
  body: string
}

/** A local receiver; `status` decides what it answers */
let receiver: Server
let receiverUrl: string
let received: Received[] = []
let status = 200

let app: FastifyInstance
let handle: DbHandle
let admin: AuthedSession

beforeAll(async () => {
  handle = openTestDb()
  receiver = createServer((req, res) => {
    let body = ''
    req.on('data', (c) => (body += c))
    req.on('end', () => {
      received.push({ headers: req.headers, body })
      res.writeHead(status, status >= 300 && status < 400 ? { location: 'http://169.254.169.254/' } : {})
      res.end(status === 200 ? 'ok' : 'nope')
    })
  })
  await new Promise<void>((r) => receiver.listen(0, '127.0.0.1', r))
  receiverUrl = `http://127.0.0.1:${(receiver.address() as AddressInfo).port}/hook`
  app = await buildTestApp()
})

beforeEach(async () => {
  await handle.db.delete(webhooks)
  await createFixture(handle)
  admin = await superAdminSession(app, handle)
  received = []
  status = 200
})

afterAll(async () => {
  await handle.db.delete(webhooks)
  await handle.db.delete(notifications).where(eq(notifications.link, '/system/webhooks'))
  await cleanupFixture(handle)
  await app.close()
  await new Promise((r) => receiver.close(r))
  await handle.pool.end()
})

async function createHook(events: string[] = ['user.*'], url = receiverUrl) {
  const res = await admin.inject({ method: 'POST', url: '/api/admin/webhooks', payload: { name: 'ci', url, events } })
  return res
}

/** Wait until the background delivery arrived */
async function waitFor(check: () => boolean | Promise<boolean>, ms = 3000) {
  const end = Date.now() + ms
  while (Date.now() < end) {
    if (await check()) return
    await new Promise((r) => setTimeout(r, 20))
  }
  throw new Error('timed out')
}

describe('webhooks', () => {
  it('新增：返回密钥（之后需验证身份才能查看）；校验地址、事件；通知超级管理员', async () => {
    const created = await createHook()
    expect(created.statusCode).toBe(201)
    const { item, secret } = created.json()
    expect(secret).toMatch(/^whsec_/)
    expect(item).toMatchObject({ name: 'ci', url: receiverUrl, events: ['user.*'], is_active: true })
    const [row] = await handle.db.select().from(webhooks).where(eq(webhooks.id, item.id))
    expect(row!.secret).not.toContain(secret)
    expect((await admin.inject({ url: `/api/admin/webhooks/${item.id}/secret` })).json()).toEqual({ secret })

    expect((await createHook(['nope.happened'])).json()).toEqual({ error: '未知的事件：nope.happened' })
    expect((await createHook([])).json()).toEqual({ error: '请至少订阅一个事件' })
    expect((await createHook(['*'], 'ftp://x')).json()).toEqual({ error: '请填写正确的地址（http:// 或 https://）' })
    expect((await createHook(['*'], 'http://169.254.169.254/latest')).json()).toEqual({
      error: '不允许访问保留地址（169.254.169.254 解析为 169.254.169.254）',
    })
    const [note] = await handle.db.select().from(notifications).where(eq(notifications.link, '/system/webhooks'))
    expect(note!.title).toContain('新增了 Webhook：ci')

    // Secrets need a recent identity check
    await handle.db.update(sessions).set({ verified_at: '2000-01-01 00:00:00' }).where(eq(sessions.user_id, admin.userId))
    expect((await admin.inject({ url: `/api/admin/webhooks/${item.id}/secret` })).json()).toMatchObject({ reauth_required: true })
  })

  it('用户变更发出事件：签名可验证、带事件 ID；只推给订阅了的 Webhook', async () => {
    const { item, secret } = (await createHook(['user.created'])).json()
    await admin.inject({ method: 'POST', url: '/api/admin/webhooks', payload: { name: 'roles only', url: receiverUrl, events: ['role.*'] } })
    const res = await admin.inject({ method: 'POST', url: '/api/admin/users', payload: { username: `${FIXTURE_PREFIX}hooked`, password: 'hooked-pass-1' } })
    expect(res.statusCode).toBe(201)
    await waitFor(() => received.length === 1)
    const [hit] = received
    const body = JSON.parse(hit!.body)
    expect(body).toMatchObject({ event: 'user.created', data: { username: `${FIXTURE_PREFIX}hooked` } })
    expect(body.data).not.toHaveProperty('password_hash')
    expect(hit!.headers['x-castor-event']).toBe('user.created')
    expect(hit!.headers['x-castor-delivery']).toBe(body.id)
    expect(hit!.headers['x-castor-signature']).toBe(signatureOf(secret, hit!.headers['x-castor-timestamp'] as string, hit!.body))

    const deliveries = (await admin.inject({ url: `/api/admin/webhooks/${item.id}/deliveries` })).json()
    expect(deliveries.items[0]).toMatchObject({ event: 'user.created', status: 'success', response_code: 200, attempts: 1 })
    // The other webhook only wants role events
    await new Promise((r) => setTimeout(r, 100))
    expect(received).toHaveLength(1)
  })

  it('失败：记录响应并按退避时间重试；不跟随重定向；重试到期后由调度器补发；手动重发用同一个事件 ID', async () => {
    const { item } = (await createHook(['*'])).json()
    status = 500
    const test = (await admin.inject({ method: 'POST', url: `/api/admin/webhooks/${item.id}/test` })).json()
    expect(test).toMatchObject({ event: 'ping', status: 'pending', response_code: 500, response_body: 'nope', attempts: 1 })
    expect(test.next_retry_at).toBeTruthy()

    status = 302
    const redirected = (await admin.inject({ method: 'POST', url: `/api/admin/webhooks/${item.id}/test` })).json()
    expect(redirected).toMatchObject({ status: 'pending', response_code: 302 })
    expect(received).toHaveLength(2)

    // Make the first one due: the scheduler's retry picks it up
    status = 200
    await handle.db.update(webhook_deliveries).set({ next_retry_at: '2000-01-01 00:00:00' }).where(eq(webhook_deliveries.id, test.id))
    const bus = new EventBus(handle.db, testConfig(), { warn: () => {} })
    const retried = await bus.deliverDue()
    expect(retried.find((d) => d.id === test.id)).toMatchObject({ status: 'success', attempts: 2 })

    const again = (await admin.inject({ method: 'POST', url: `/api/admin/webhooks/deliveries/${test.id}/redeliver` })).json()
    expect(again).toMatchObject({ status: 'success', event_id: test.event_id })
  })

  it('用尽重试次数后记为失败；停用的 Webhook 不再推送', async () => {
    const { item } = (await createHook(['*'])).json()
    status = 500
    const first = (await admin.inject({ method: 'POST', url: `/api/admin/webhooks/${item.id}/test` })).json()
    await handle.db.update(webhook_deliveries).set({ attempts: 5, next_retry_at: '2000-01-01 00:00:00' }).where(eq(webhook_deliveries.id, first.id))
    const bus = new EventBus(handle.db, testConfig(), { warn: () => {} })
    expect((await bus.deliverDue()).find((d) => d.id === first.id)).toMatchObject({ status: 'failed', attempts: 6, next_retry_at: null })

    await admin.inject({ method: 'PUT', url: `/api/admin/webhooks/${item.id}`, payload: { is_active: false } })
    received = []
    await admin.inject({ method: 'POST', url: '/api/admin/users', payload: { username: `${FIXTURE_PREFIX}quiet`, password: 'quiet-pass-1' } })
    await new Promise((r) => setTimeout(r, 150))
    expect(received).toHaveLength(0)
  })

  it('两个进程同时补发也只发一次（原子认领）', async () => {
    const { item } = (await createHook(['*'])).json()
    status = 500
    const first = (await admin.inject({ method: 'POST', url: `/api/admin/webhooks/${item.id}/test` })).json()
    status = 200
    received = []
    await handle.db.update(webhook_deliveries).set({ next_retry_at: '2000-01-01 00:00:00' }).where(eq(webhook_deliveries.id, first.id))
    const other = openTestDb()
    try {
      const a = new EventBus(handle.db, testConfig(), { warn: () => {} })
      const b = new EventBus(other.db, testConfig(), { warn: () => {} })
      await Promise.all([a.deliverDue(), b.deliverDue()])
    } finally {
      await other.pool.end()
    }
    expect(received).toHaveLength(1)
  })

  it('权限：查看需要 system_webhooks，改动需要对应按钮；事件列表包含内置事件', async () => {
    const viewer = await scopedSession(app, handle, { name: 'hook_viewer', codes: ['system_webhooks'], dataScope: 'all' })
    const events = (await viewer.inject({ url: '/api/admin/webhooks/events' })).json().items.map((e: { event: string }) => e.event)
    expect(events).toEqual(expect.arrayContaining(['ping', 'user.created', 'role.deleted', 'department.updated']))
    expect((await viewer.inject({ method: 'POST', url: '/api/admin/webhooks', payload: {} })).json()).toEqual({ error: '无权限新增 Webhook' })
    const none = await scopedSession(app, handle, { name: 'hook_none', codes: [], dataScope: 'all' })
    expect((await none.inject({ url: '/api/admin/webhooks' })).json()).toEqual({ error: '无权限查看 Webhook' })
  })
})
