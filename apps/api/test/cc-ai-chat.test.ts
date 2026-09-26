/**
 * AI chat (AI SDK UI message stream): uses a local fake upstream (test/cc-ai-fake-upstream.ts) to cover streaming,
 * error branches, timeouts, no compression/buffering and aborting upstream on client disconnect; never calls a real AI.
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
const userMessage = (text: string, id = 'u1') => ({ id, role: 'user', parts: [{ type: 'text', text }] })
const say = (text: string) => ({ messages: [userMessage(text)] })

type StreamEvent = { type: string; delta?: string; errorText?: string }

/** The SSE body as UI message chunks (the final `[DONE]` is checked and dropped) */
function events(body: string): StreamEvent[] {
  const chunks = body.split('\n\n').filter(Boolean)
  expect(chunks.at(-1)).toBe('data: [DONE]')
  return chunks.slice(0, -1).map((c) => {
    expect(c.startsWith('data: ')).toBe(true)
    return JSON.parse(c.slice(6)) as StreamEvent
  })
}
const textOf = (list: StreamEvent[]) => list.filter((e) => e.type === 'text-delta').map((e) => e.delta).join('')
const errorOf = (list: StreamEvent[]) => list.find((e) => e.type === 'error')?.errorText

let app: FastifyInstance
let handle: DbHandle
let s: AuthedSession
let up: FakeUpstream

beforeAll(async () => {
  handle = openTestDb()
  up = await startFakeUpstream()
  CHAT_TIMINGS.upstreamTimeoutMs = 400
  app = await buildTestApp({ settingsEnv: { AI_API_BASE: up.url, AI_API_KEY: 'test-key', AI_MODEL: 'test-model' } })
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

  it('未配置 AI 模型 → 500（先于消息校验）', async () => {
    const bare = await buildTestApp()
    try {
      const session = await loginSession(bare, SUPER_USER, SUPER_PASSWORD)
      const res = await session.inject({ method: 'POST', url: URL_PATH, payload: {} })
      expect(res.statusCode).toBe(500)
      expect(res.json()).toEqual({ error: '未配置 AI 模型，请在「系统设置 → AI」中填写 API Key 和模型名' })
    } finally {
      await bare.close()
    }
  })

  it('消息为空 400；格式不对 400；太长 400', async () => {
    for (const payload of [{}, { messages: [] }, { messages: null }, { messages: '' }, { messages: 0 }, { messages: {} }, { messages: 'hi' }]) {
      const res = await s.inject({ method: 'POST', url: URL_PATH, payload })
      expect([res.statusCode, res.json()]).toEqual([400, { error: '消息不能为空' }])
    }
    for (const messages of [[{ role: 'user', content: 'old format' }], [{ id: '1', role: 'robot', parts: [] }], [5]]) {
      const res = await s.inject({ method: 'POST', url: URL_PATH, payload: { messages } })
      expect([res.statusCode, res.json()]).toEqual([400, { error: '消息格式不正确' }])
    }
    const long = Array.from({ length: 201 }, (_, i) => userMessage('x', String(i)))
    const res = await s.inject({ method: 'POST', url: URL_PATH, payload: { messages: long } })
    expect([res.statusCode, res.json()]).toEqual([400, { error: '对话太长，请清除上下文后再试' }])
  })
})

describe('ai chat 流', () => {
  it('正常：UI message stream 逐块输出原文；响应头与上游请求（系统提示词 + 历史）', async () => {
    const before = up.requests.length
    const messages = [
      userMessage('first', 'a'),
      { id: 'b', role: 'assistant', parts: [{ type: 'text', text: 'ok' }] },
      userMessage('hello', 'c'),
    ]
    const res = await s.inject({ method: 'POST', url: URL_PATH, payload: { messages }, headers: { 'accept-encoding': 'gzip' } })
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toBe('text/event-stream')
    expect(res.headers['x-vercel-ai-ui-message-stream']).toBe('v1')
    expect(res.headers['cache-control']).toBe('no-cache')
    expect(res.headers['x-accel-buffering']).toBe('no')
    expect(res.headers['content-encoding']).toBeUndefined()
    expect(res.headers['set-cookie']).toBeDefined()
    const list = events(res.body)
    expect(list.map((e) => e.type)).toEqual([
      'start',
      'start-step',
      'text-start',
      ...DEFAULT_PIECES.map(() => 'text-delta'),
      'text-end',
      'finish-step',
      'finish',
    ])
    expect(list.filter((e) => e.type === 'text-delta').map((e) => e.delta)).toEqual(DEFAULT_PIECES)

    const req = up.requests[before]!
    expect(req.headers.authorization).toBe('Bearer test-key')
    expect(req.body).toMatchObject({
      model: 'test-model',
      stream: true,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT.content },
        { role: 'user', content: 'first' },
        { role: 'assistant', content: 'ok' },
        { role: 'user', content: 'hello' },
      ],
    })
    expect(req.body).not.toHaveProperty('max_tokens')
    expect(SYSTEM_PROMPT.content).toContain('Fastify')
    expect(SYSTEM_PROMPT.content).toContain('Drizzle')
    expect(SYSTEM_PROMPT.content).toContain('castor-kit')
  })

  it('上游中途断开（没有结束标记）→ 已输出的文字保留，末尾给通用错误', async () => {
    const list = events((await s.inject({ method: 'POST', url: URL_PATH, payload: say('cutoff') })).body)
    expect(textOf(list)).toBe('only')
    expect(errorOf(list)).toBe('AI 响应异常，请稍后重试')
  })

  it('上游非 2xx：不透传响应体，只给状态码；按 Accept-Language 翻译', async () => {
    for (const status of [502, 401, 429]) {
      const res = await s.inject({ method: 'POST', url: URL_PATH, payload: say(`status:${status}`) })
      expect(res.statusCode).toBe(200)
      expect(errorOf(events(res.body))).toBe(`AI 服务暂时不可用（${status}），请稍后重试`)
      expect(res.body).not.toContain('secret')
    }
    const en = await s.inject({ method: 'POST', url: URL_PATH, payload: say('status:503'), headers: { 'accept-language': 'en-US' } })
    expect(errorOf(events(en.body))).toBe('The AI service is temporarily unavailable (503). Please try again later.')
  })

  it('上游 2xx 但不是事件流、上游连不上 → 通用错误', async () => {
    expect(errorOf(events((await s.inject({ method: 'POST', url: URL_PATH, payload: say('status:201') })).body))).toBe(
      'AI 响应异常，请稍后重试',
    )
    const refusedApp = await buildTestApp({ settingsEnv: { AI_API_BASE: 'http://127.0.0.1:1', AI_API_KEY: 'x', AI_MODEL: 'm' } })
    try {
      const session = await loginSession(refusedApp, SUPER_USER, SUPER_PASSWORD)
      const res = await session.inject({ method: 'POST', url: URL_PATH, payload: say('x') })
      expect(res.statusCode).toBe(200)
      expect(errorOf(events(res.body))).toBe('AI 响应异常，请稍后重试')
    } finally {
      await refusedApp.close()
    }
  })

  it('超时：等响应头、读流中途都给「请求超时」', async () => {
    const hangHeaders = events((await s.inject({ method: 'POST', url: URL_PATH, payload: say('hang-headers') })).body)
    expect(errorOf(hangHeaders)).toBe('请求超时，请重试')
    const hangBody = events((await s.inject({ method: 'POST', url: URL_PATH, payload: say('hang-body') })).body)
    expect(textOf(hangBody)).toBe('first')
    expect(errorOf(hangBody)).toBe('请求超时，请重试')
  })

  it('写操作日志（onResponse 审计 hook 照常执行，状态 200）', async () => {
    await s.inject({ method: 'POST', url: URL_PATH, payload: say('cutoff') })
    let log: typeof operation_logs.$inferSelect | undefined
    for (let i = 0; i < 50 && !log?.payload?.includes('cutoff'); i++) {
      ;[log] = await handle.db
        .select()
        .from(operation_logs)
        .where(and(eq(operation_logs.user_id, s.userId), eq(operation_logs.path, URL_PATH)))
        .orderBy(desc(operation_logs.id))
        .limit(1)
      await new Promise((r) => setTimeout(r, 20))
    }
    expect(log!.method).toBe('POST')
    expect(log!.status_code).toBe(200)
    expect(log!.payload).toContain('"text": "cutoff"')
  })
})
describe('ai chat 真实连接', () => {
  let base: string
  // The client uses its own connection pool and closes it at the end: after an aborted request undici pre-opens a new connection, which would hold up app.close() if not closed
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
    // Read until the first text arrives: the upstream is holding back the second chunk until release()
    let received = ''
    while (!received.includes('"delta":"first"')) received += decoder.decode((await reader.read()).value, { stream: true })
    expect(received).not.toContain('second')
    up.release()
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      received += decoder.decode(value, { stream: true })
    }
    expect(textOf(events(received))).toBe('firstsecond')
  })

  it('客户端断开 → 中止上游请求', async () => {
    const controller = new AbortController()
    const before = up.requests.length
    const res = await post('gate', controller.signal)
    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    let received = ''
    while (!received.includes('"delta":"first"')) received += decoder.decode((await reader.read()).value, { stream: true })
    controller.abort()
    const req = up.requests[before]!
    for (let i = 0; i < 40 && !req.aborted; i++) await new Promise((r) => setTimeout(r, 25))
    expect(req.aborted).toBe(true)
    up.release()
  })
})
