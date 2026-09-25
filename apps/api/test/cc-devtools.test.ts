/**
 * Dev tools: perf-stats (REST) + /ws/devtools (real ws connection)
 */

import { totalmem } from 'node:os'
import type { AddressInfo } from 'node:net'
import type { FastifyInstance } from 'fastify'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import WebSocket from 'ws'
import type { DbHandle } from '@/db/client'
import { WS_TIMINGS, originAllowed, urlNetloc } from '@/modules/component-center/devtools/routes'
import { metricMessage, systemSnapshot } from '@/modules/component-center/devtools/service'
import {
  FIXTURE_PASSWORD,
  FIXTURE_USER,
  buildTestApp,
  cleanupFixture,
  createFixture,
  loginSession,
  openTestDb,
  superAdminSession,
  type AuthedSession,
} from './helpers'

const PERF = '/api/admin/component-center/devtools/perf-stats'
const METRIC_KEYS = ['cpu', 'mem_used', 'mem_total', 'mem_pct', 'disk_used', 'disk_total', 'disk_pct', 'net_sent', 'net_recv', 'ts']
const WHITELISTED = 'http://allowed.example:5173'

let app: FastifyInstance
let handle: DbHandle
let s: AuthedSession
let plain: AuthedSession
let port: number

beforeAll(async () => {
  handle = openTestDb()
  app = await buildTestApp({ corsOrigins: [WHITELISTED] })
  await createFixture(handle)
  s = await superAdminSession(app, handle)
  plain = await loginSession(app, FIXTURE_USER, FIXTURE_PASSWORD)
  await app.listen({ port: 0, host: '127.0.0.1' })
  port = (app.server.address() as AddressInfo).port
})

afterAll(async () => {
  await cleanupFixture(handle)
  await app.close()
  await handle.pool.end()
})

describe('perf-stats', () => {
  it('未登录 401；无权限 403', async () => {
    const res = await app.inject({ url: PERF })
    expect(res.statusCode).toBe(401)
    expect(res.json()).toEqual({ error: '未授权访问', redirect: '/admin/login' })
    const denied = await plain.inject({ url: PERF })
    expect(denied.statusCode).toBe(403)
    expect(denied.json()).toEqual({ error: '无权限' })
  })

  it('字段与单位（MB / GB / 百分比）', async () => {
    const res = await s.inject({ url: PERF })
    expect(res.statusCode).toBe(200)
    const body = res.json() as Record<string, number>
    expect(Object.keys(body).sort()).toEqual([...METRIC_KEYS].sort())
    for (const key of METRIC_KEYS) expect(typeof body[key]).toBe('number')
    expect(Math.abs(body.mem_total! - totalmem() / 1024 / 1024)).toBeLessThan(1)
    for (const pct of ['cpu', 'mem_pct', 'disk_pct']) {
      expect(body[pct]).toBeGreaterThanOrEqual(0)
      expect(body[pct]).toBeLessThanOrEqual(100)
    }
    expect(body.disk_total).toBeGreaterThan(body.disk_used!)
    expect(body.mem_used).toBeLessThanOrEqual(body.mem_total!)
    expect(Number.isInteger(body.ts)).toBe(true)
    expect(Math.abs(body.ts! - Date.now())).toBeLessThan(10_000)
    // Decimal places: 1 for MB, 2 for GB and network MB
    for (const key of ['mem_used', 'mem_total', 'mem_pct', 'cpu', 'disk_pct']) expect(Math.round(body[key]! * 10) / 10).toBe(body[key])
    for (const key of ['disk_used', 'disk_total', 'net_sent', 'net_recv']) expect(Math.round(body[key]! * 100) / 100).toBe(body[key])
  })

  it('metric 消息文本逐字按 json.dumps 格式（浮点整数值带 .0，type 在最后）', async () => {
    const text = metricMessage({
      cpu: 0, mem_used: 1024, mem_total: 2048.5, mem_pct: 50, disk_used: 1.25, disk_total: 10, disk_pct: 12.5,
      net_sent: 0.01, net_recv: 3, ts: 1700000000000,
    })
    expect(text).toBe(
      '{"cpu": 0.0, "mem_used": 1024.0, "mem_total": 2048.5, "mem_pct": 50.0, "disk_used": 1.25, "disk_total": 10.0, ' +
        '"disk_pct": 12.5, "net_sent": 0.01, "net_recv": 3.0, "ts": 1700000000000, "type": "metric"}',
    )
    const snap = await systemSnapshot()
    expect(Object.keys(snap)).toEqual(METRIC_KEYS)
  })
})

describe('Origin 校验（urlparse(origin).netloc == Host 或白名单）', () => {
  it('urlNetloc', () => {
    expect(urlNetloc('http://localhost:5173')).toBe('localhost:5173')
    expect(urlNetloc('https://a.b/c?d')).toBe('a.b')
    expect(urlNetloc('null')).toBe('')
    expect(urlNetloc('localhost:5173')).toBe('')
    expect(urlNetloc('//host:1/x')).toBe('host:1')
  })

  it('originAllowed', () => {
    expect(originAllowed(undefined, 'h:1', [])).toBe(true)
    expect(originAllowed('', 'h:1', [])).toBe(true)
    expect(originAllowed('http://h:1', 'h:1', [])).toBe(true)
    expect(originAllowed('http://evil:1', 'h:1', [])).toBe(false)
    expect(originAllowed('http://w:2/', 'h:1', ['http://w:2'])).toBe(true)
    expect(originAllowed('http://w:2', undefined, ['http://w:2/'])).toBe(false)
  })
})

// ---- WebSocket ----

interface WsResult {
  messages: string[]
  code: number
}

function connect(session: AuthedSession | null, origin?: string): WebSocket {
  const headers: Record<string, string> = {}
  if (session) headers.cookie = `castor_session=${encodeURIComponent(session.cookie)}`
  if (origin) headers.origin = origin
  return new WebSocket(`ws://127.0.0.1:${port}/ws/devtools`, { headers })
}

/** Collect messages until the connection closes */
function untilClosed(ws: WebSocket, timeoutMs = 5000): Promise<WsResult> {
  const messages: string[] = []
  ws.on('message', (data) => messages.push(data.toString()))
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`连接未关闭，已收到 ${messages.length} 条`)), timeoutMs)
    ws.on('close', (code) => {
      clearTimeout(timer)
      resolve({ messages, code })
    })
    ws.on('error', () => {})
  })
}

function nextMessage(ws: WebSocket, predicate: (text: string) => boolean = () => true, timeoutMs = 5000): Promise<string> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('等待消息超时')), timeoutMs)
    const onMessage = (data: WebSocket.RawData) => {
      const text = data.toString()
      if (!predicate(text)) return
      clearTimeout(timer)
      ws.off('message', onMessage)
      resolve(text)
    }
    ws.on('message', onMessage)
  })
}

const opened = (ws: WebSocket) => new Promise<void>((resolve, reject) => {
  ws.once('open', () => resolve())
  ws.once('error', reject)
})

describe('/ws/devtools', () => {
  const sockets: WebSocket[] = []
  const track = (ws: WebSocket) => (sockets.push(ws), ws)

  afterEach(() => {
    WS_TIMINGS.pushIntervalMs = 1000
    WS_TIMINGS.receiveTimeoutMs = 30_000
    for (const ws of sockets.splice(0)) ws.terminate()
  })

  it('未登录 / 无权限 / 跨站 Origin：握手后立即正常关闭（1000），不推送任何消息', async () => {
    for (const [session, origin] of [
      [null, undefined],
      [plain, undefined],
      [s, 'http://evil.example'],
      [s, `http://127.0.0.1:${port + 1}`],
    ] as const) {
      const result = await untilClosed(track(connect(session, origin)))
      expect(result.code).toBe(1000)
      expect(result.messages).toEqual([])
    }
  })

  it('同源 / 白名单 / 无 Origin 放行：立即推送 metric，之后按间隔持续推送', async () => {
    WS_TIMINGS.pushIntervalMs = 100
    for (const origin of [`http://127.0.0.1:${port}`, WHITELISTED, `${WHITELISTED}/`, undefined]) {
      const ws = track(connect(s, origin))
      const texts: string[] = []
      ws.on('message', (d) => texts.push(d.toString()))
      await opened(ws)
      // Every push samples system metrics (vm_stat can take hundreds of ms on macOS), so instead of a fixed duration, wait for 3 messages or a timeout
      const deadline = Date.now() + 5000
      while (texts.length < 3 && Date.now() < deadline) await new Promise((r) => setTimeout(r, 50))
      expect(texts.length).toBeGreaterThanOrEqual(3)
      const first = JSON.parse(texts[0]!) as Record<string, unknown>
      expect(Object.keys(first)).toEqual([...METRIC_KEYS, 'type'])
      expect(first.type).toBe('metric')
      expect(texts[0]).toMatch(/^\{"cpu": \d+(\.\d+)?, "mem_used": /)
      ws.terminate()
    }
  })

  it('echo：JSON 对象原样回显 + type/server_ts；非 JSON 文本包成 {text}；鉴权完成前的消息不丢', async () => {
    const ws = track(connect(s))
    await opened(ws)
    ws.send(JSON.stringify({ hello: '世界', type: 'mine', n: 1.5, list: [1, null] }))
    const echo = await nextMessage(ws, (t) => t.includes('"echo"'))
    const match = /^\{"hello": "世界", "type": "echo", "n": 1.5, "list": \[1, null\], "server_ts": (\d+)\}$/.exec(echo)
    expect(match).not.toBeNull()
    expect(Math.abs(Number(match![1]) - Date.now())).toBeLessThan(10_000)

    ws.send('plain text')
    const text = await nextMessage(ws, (t) => t.includes('"echo"'))
    expect(text).toMatch(/^\{"text": "plain text", "type": "echo", "server_ts": \d+\}$/)

    // Send as soon as the connection opens, while the server is still doing the permission lookup
    const early = new WebSocket(`ws://127.0.0.1:${port}/ws/devtools`, {
      headers: { cookie: `castor_session=${encodeURIComponent(s.cookie)}` },
    })
    track(early)
    early.on('open', () => early.send('{"early": true}'))
    const earlyEcho = await nextMessage(early, (t) => t.includes('"echo"'))
    expect(earlyEcho).toMatch(/^\{"early": true, "type": "echo", "server_ts": \d+\}$/)
  })

  it('JSON 但不是对象 → 连接异常中断', async () => {
    for (const payload of ['[1, 2]', '"str"', '42']) {
      const ws = track(connect(s))
      await opened(ws)
      const closed = untilClosed(ws)
      ws.send(payload)
      const result = await closed
      expect(result.code).toBe(1006)
      expect(result.messages.every((m) => m.includes('"metric"'))).toBe(true)
    }
  })

  it('距上一条消息超过接收超时 → 正常关闭（1000）；收到消息会重新计时', async () => {
    WS_TIMINGS.receiveTimeoutMs = 400
    const ws = track(connect(s))
    await opened(ws)
    const closed = untilClosed(ws)
    const started = Date.now()
    await new Promise((r) => setTimeout(r, 250))
    ws.send('{"keep": 1}')
    const result = await closed
    const elapsed = Date.now() - started
    expect(result.code).toBe(1000)
    expect(elapsed).toBeGreaterThanOrEqual(600)
    expect(result.messages.some((m) => m.startsWith('{"keep": 1, "type": "echo"'))).toBe(true)
  })

  it('非 WebSocket 的普通 GET → 404', async () => {
    const res = await s.inject({ url: '/ws/devtools' })
    expect(res.statusCode).toBe(404)
  })
})
