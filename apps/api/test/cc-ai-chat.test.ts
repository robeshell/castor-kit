/**
 * AI 对话 SSE：用本地假上游（test/cc-ai-fake-upstream.ts）覆盖流式转发、错误分支、超时、
 * 不被压缩/缓冲、客户端断开中止上游等行为；不调用真实 AI 服务。
 */

import type { AddressInfo } from 'node:net'
import { and, desc, eq } from 'drizzle-orm'
import { Agent, fetch } from 'undici'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DbHandle } from '@/db/client'
import { operation_logs } from '@/db/schema'
import { CHAT_TIMINGS } from '@/modules/component-center/ai-chat/routes'
import { SYSTEM_PROMPT } from '@/modules/component-center/ai-chat/service'
import { DEFAULT_PIECES, startFakeUpstream, type FakeUpstream } from './cc-ai-fake-upstream'
import {
  FIXTURE_PASSWORD,
  FIXTURE_USER,
  SUPER_PASSWORD,
  SUPER_USER,
  buildTestApp,
  cleanupFixture,
  createFixture,
  loginSession,
  openTestDb,
  superAdminSession,
  type AuthedSession,
} from './helpers'

const URL_PATH = '/api/admin/component-center/ai/chat/stream'
const DONE = 'data: [DONE]\n\n'
const INTERNAL = '服务器内部错误，请稍后重试'
const ev = (json: string) => `data: ${json}\n\n`
const say = (content: string) => ({ messages: [{ role: 'user', content }] })

let app: FastifyInstance
let handle: DbHandle
let s: AuthedSession
let up: FakeUpstream

beforeAll(async () => {
  handle = openTestDb()
  up = await startFakeUpstream()
  CHAT_TIMINGS.upstreamTimeoutMs = 400
  app = await buildTestApp({ aiApiBase: up.url, aiApiKey: 'test-key', aiModel: 'test-model' })
  CHAT_TIMINGS.upstreamTimeoutMs = 60_000
  await createFixture(handle)
  s = await superAdminSession(app, handle)
})

afterAll(async () => {
  await cleanupFixture(handle)
  await app.close()
  await up.close()
  await handle.pool.end()
})

describe('ai chat 错误分支（非流式 JSON）', () => {
  it('未登录 401；无权限 403', async () => {
    const res = await app.inject({ method: 'POST', url: URL_PATH, payload: say('x') })
    expect(res.statusCode).toBe(401)
    expect(res.json()).toEqual({ error: '未授权访问', redirect: '/admin/login' })
    const plain = await loginSession(app, FIXTURE_USER, FIXTURE_PASSWORD)
    const denied = await plain.inject({ method: 'POST', url: URL_PATH, payload: say('x') })
    expect(denied.statusCode).toBe(403)
    expect(denied.json()).toEqual({ error: '无权限' })
  })

  it('未配置 AI_API_KEY → 500（先于消息校验）', async () => {
    const bare = await buildTestApp({ aiApiKey: '' })
    try {
      const session = await loginSession(bare, SUPER_USER, SUPER_PASSWORD)
      const res = await session.inject({ method: 'POST', url: URL_PATH, payload: {} })
      expect(res.statusCode).toBe(500)
      expect(res.json()).toEqual({ error: '未配置 AI_API_KEY' })
    } finally {
      await bare.close()
    }
  })

  it('消息为空 400；非 list 的 messages 500 通用文案', async () => {
    for (const payload of [{}, { messages: [] }, { messages: null }, { messages: '' }, { messages: 0 }, { messages: {} }]) {
      const res = await s.inject({ method: 'POST', url: URL_PATH, payload })
      expect(res.statusCode).toBe(400)
      expect(res.json()).toEqual({ error: '消息不能为空' })
    }
    for (const messages of ['hi', { a: 1 }, 5, true]) {
      const res = await s.inject({ method: 'POST', url: URL_PATH, payload: { messages } })
      expect(res.statusCode).toBe(500)
      expect(res.json()).toEqual({ error: INTERNAL })
    }
  })
})

describe('ai chat SSE 流', () => {
  it('正常：逐字按 json.dumps(ensure_ascii=False) 格式，[DONE] 之后的内容被忽略；响应头与上游请求体', async () => {
    const before = up.requests.length
    const messages = [
      { role: 'user', content: 'first' },
      { role: 'assistant', content: 'ok' },
      { role: 'user', content: 'hello' },
    ]
    const res = await s.inject({ method: 'POST', url: URL_PATH, payload: { messages }, headers: { 'accept-encoding': 'gzip' } })
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toBe('text/event-stream; charset=utf-8')
    expect(res.headers['cache-control']).toBe('no-cache')
    expect(res.headers['x-accel-buffering']).toBe('no')
    expect(res.headers['content-encoding']).toBeUndefined()
    expect(res.headers['set-cookie']).toBeDefined()
    const expected = DEFAULT_PIECES.map((p) => ev(`{"content": ${JSON.stringify(p)}}`)).join('') + DONE
    expect(res.body).toBe(expected)
    // 逐字检查一段：非 ASCII 原样输出（ensure_ascii=False），键值分隔符是 ": "
    expect(res.body.startsWith('data: {"content": "你好"}\n\n')).toBe(true)

    const req = up.requests[before]!
    expect(req.headers.authorization).toBe('Bearer test-key')
    expect(req.headers['content-type']).toBe('application/json')
    expect(req.body).toEqual({ model: 'test-model', messages: [SYSTEM_PROMPT, ...messages], stream: true })
    expect(SYSTEM_PROMPT.content).toContain('Fastify')
    expect(SYSTEM_PROMPT.content).toContain('TypeScript')
    expect(SYSTEM_PROMPT.content).toContain('Drizzle')
    expect(SYSTEM_PROMPT.content).toContain('castor-kit')
  })

  it('畸形行跳过；非字符串 content 按 json.dumps 输出；data: 后无空格也解析；[DONE] 两侧空白', async () => {
    const res = await s.inject({ method: 'POST', url: URL_PATH, payload: say('garbage') })
    expect(res.body).toBe(
      ev('{"content": 42}') + ev('{"content": ["a", {"b": null}]}') + ev('{"content": "no-space"}') + DONE,
    )
  })

  it('上游没发 [DONE] 也补发；CRLF / CR 分行与多字节字符跨块', async () => {
    const nodone = await s.inject({ method: 'POST', url: URL_PATH, payload: say('nodone') })
    expect(nodone.body).toBe(ev('{"content": "only"}') + DONE)
    const crlf = await s.inject({ method: 'POST', url: URL_PATH, payload: say('crlf') })
    expect(crlf.body).toBe(ev('{"content": "中文分块😀"}') + ev('{"content": "second"}') + ev('{"content": "third"}') + DONE)
  })

  it('上游非 200：不透传响应体，只给状态码', async () => {
    for (const status of [502, 401, 201]) {
      const res = await s.inject({ method: 'POST', url: URL_PATH, payload: say(`status:${status}`) })
      expect(res.statusCode).toBe(200)
      expect(res.body).toBe(ev(`{"error": "AI 服务暂时不可用（${status}），请稍后重试"}`) + DONE)
      expect(res.body).not.toContain('secret')
    }
  })

  it('非法 UTF-8 行 → 通用错误；上游连不上 → 通用错误', async () => {
    const bad = await s.inject({ method: 'POST', url: URL_PATH, payload: say('badutf8') })
    expect(bad.body).toBe(ev('{"content": "ok"}') + ev('{"error": "AI 响应异常，请稍后重试"}') + DONE)

    const refusedApp = await buildTestApp({ aiApiBase: 'http://127.0.0.1:1', aiApiKey: 'x' })
    const badBaseApp = await buildTestApp({ aiApiBase: '', aiApiKey: 'x' })
    try {
      for (const target of [refusedApp, badBaseApp]) {
        const session = await loginSession(target, SUPER_USER, SUPER_PASSWORD)
        const res = await session.inject({ method: 'POST', url: URL_PATH, payload: say('x') })
        expect(res.statusCode).toBe(200)
        expect(res.body).toBe(ev('{"error": "AI 响应异常，请稍后重试"}') + DONE)
      }
    } finally {
      await refusedApp.close()
      await badBaseApp.close()
    }
  })

  it('超时：等响应头超时 → 请求超时；读流中途超时 → 通用错误', async () => {
    const hangHeaders = await s.inject({ method: 'POST', url: URL_PATH, payload: say('hang-headers') })
    expect(hangHeaders.body).toBe(ev('{"error": "请求超时，请重试"}') + DONE)
    const hangBody = await s.inject({ method: 'POST', url: URL_PATH, payload: say('hang-body') })
    expect(hangBody.body).toBe(ev('{"content": "first"}') + ev('{"error": "AI 响应异常，请稍后重试"}') + DONE)
  })

  it('写操作日志（onResponse 审计 hook 照常执行，状态 200）', async () => {
    await s.inject({ method: 'POST', url: URL_PATH, payload: say('nodone') })
    await new Promise((r) => setTimeout(r, 100))
    const [log] = await handle.db
      .select()
      .from(operation_logs)
      .where(and(eq(operation_logs.user_id, s.userId), eq(operation_logs.path, URL_PATH)))
      .orderBy(desc(operation_logs.id))
      .limit(1)
    expect(log).toBeDefined()
    expect(log!.method).toBe('POST')
    expect(log!.status_code).toBe(200)
    expect(log!.payload).toBe('{"messages": [{"role": "user", "content": "nodone"}]}')
  })
})

describe('ai chat 真实连接', () => {
  let base: string
  // 客户端用独立连接池并在结束时关闭：中止请求后 undici 会预建新连接，不关掉会拖住 app.close()
  const client = new Agent()

  beforeAll(async () => {
    await app.listen({ port: 0, host: '127.0.0.1' })
    base = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`
  })

  afterAll(async () => {
    await client.close()
  })

  const post = (content: string, signal?: AbortSignal) =>
    fetch(`${base}${URL_PATH}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'accept-encoding': 'gzip, br',
        cookie: `castor_session=${encodeURIComponent(s.cookie)}`,
        'x-csrf-token': s.csrf,
      },
      body: JSON.stringify(say(content)),
      signal,
      dispatcher: client,
    })

  it('不被压缩/缓冲：第一块到达客户端时上游还没发第二块', async () => {
    const res = await post('gate')
    expect(res.headers.get('content-encoding')).toBeNull()
    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    const first = await reader.read()
    expect(decoder.decode(first.value)).toBe(ev('{"content": "first"}'))
    up.release()
    let rest = ''
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      rest += decoder.decode(value, { stream: true })
    }
    expect(rest).toBe(ev('{"content": "second"}') + DONE)
  })

  it('客户端断开 → 中止上游请求', async () => {
    const controller = new AbortController()
    const before = up.requests.length
    const res = await post('gate', controller.signal)
    const reader = res.body!.getReader()
    await reader.read()
    controller.abort()
    const req = up.requests[before]!
    for (let i = 0; i < 40 && !req.aborted; i++) await new Promise((r) => setTimeout(r, 25))
    expect(req.aborted).toBe(true)
    up.release()
  })
})
