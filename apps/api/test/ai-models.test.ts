/**
 * common/ai.ts: which provider a setting picks, when the model counts as configured, and how upstream errors are read
 */

import { APICallError } from 'ai'
import { Agent } from 'undici'
import { afterAll, describe, expect, it } from 'vitest'
import { aiConfigured, isTimeoutError, languageModelFor, upstreamStatusOf } from '@/common/ai'
import type { Settings } from '@/common/settings'

const agent = new Agent()
afterAll(() => agent.close())

const ai = (over: Partial<Settings['ai']> = {}): Settings['ai'] => ({
  provider: 'openai-compatible',
  apiBase: 'https://llm.example.com/v1',
  apiKey: 'k',
  model: 'm',
  ...over,
})

const apiError = (statusCode: number | undefined) =>
  new APICallError({ message: 'x', url: 'https://llm.example.com', requestBodyValues: {}, statusCode })

describe('common/ai', () => {
  it('每种服务类型得到对应的模型', () => {
    const provider = (over: Partial<Settings['ai']>) => {
      const model = languageModelFor(ai(over), agent)
      return typeof model === 'string' ? model : model.provider
    }
    expect(provider({})).toMatch(/^castor/)
    expect(provider({ provider: 'openai', apiBase: '' })).toMatch(/^openai/)
    expect(provider({ provider: 'anthropic', apiBase: '' })).toMatch(/^anthropic/)
    expect(provider({ provider: 'google', apiBase: '' })).toMatch(/^google/)
  })

  it('需要 Key 和模型名；OpenAI 兼容接口还需要接口地址，原生服务不需要', () => {
    expect(aiConfigured(ai())).toBe(true)
    expect(aiConfigured(ai({ apiKey: '' }))).toBe(false)
    expect(aiConfigured(ai({ model: '' }))).toBe(false)
    expect(aiConfigured(ai({ apiBase: '' }))).toBe(false)
    expect(aiConfigured(ai({ provider: 'anthropic', apiBase: '' }))).toBe(true)
  })

  it('上游状态码：只认错误状态（2xx 读取失败不算），可以包在 cause 里；超时识别 undici 错误码', () => {
    expect(upstreamStatusOf(apiError(429))).toBe(429)
    expect(upstreamStatusOf(new Error('wrapped', { cause: apiError(401) }))).toBe(401)
    expect(upstreamStatusOf(apiError(200))).toBeNull()
    expect(upstreamStatusOf(apiError(undefined))).toBeNull()
    expect(upstreamStatusOf(new Error('network'))).toBeNull()
    expect(isTimeoutError(new Error('x', { cause: Object.assign(new Error('t'), { code: 'UND_ERR_HEADERS_TIMEOUT' }) }))).toBe(true)
    expect(isTimeoutError(new Error('x'))).toBe(false)
  })
})
