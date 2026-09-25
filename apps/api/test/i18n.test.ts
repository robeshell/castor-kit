import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { pickLanguage, translateMessage } from '@/common/i18n'
import { buildTestApp } from './helpers'

describe('pickLanguage', () => {
  it('maps Accept-Language to zh-CN / en-US / ja-JP, honouring q-values; defaults to zh-CN', () => {
    expect(pickLanguage(undefined)).toBe('zh-CN')
    expect(pickLanguage('')).toBe('zh-CN')
    expect(pickLanguage('en-US')).toBe('en-US')
    expect(pickLanguage('en')).toBe('en-US')
    expect(pickLanguage('ja-JP,ja;q=0.9')).toBe('ja-JP')
    expect(pickLanguage('zh-TW')).toBe('zh-CN')
    expect(pickLanguage('fr-FR,ja;q=0.5,en;q=0.8')).toBe('en-US')
    expect(pickLanguage('de-DE')).toBe('zh-CN')
  })
})

describe('translateMessage', () => {
  it('exact entries, patterns, and pass-through for unknown text', () => {
    expect(translateMessage('资源不存在', 'en-US')).toBe('Resource not found')
    expect(translateMessage('资源不存在', 'ja-JP')).toBe('リソースが見つかりません')
    expect(translateMessage('资源不存在', 'zh-CN')).toBe('资源不存在')
    expect(translateMessage('缺少权限: system_users', 'en-US')).toBe('Missing permission: system_users')
    expect(translateMessage('AI 服务暂时不可用（503），请稍后重试', 'ja-JP')).toBe('AI サービスは一時的に利用できません（503）。しばらくしてから再度お試しください。')
    expect(translateMessage('没有登记的中文', 'en-US')).toBe('没有登记的中文')
  })
})

describe('response translation hook', () => {
  let app: FastifyInstance
  beforeAll(async () => {
    app = await buildTestApp()
  })
  afterAll(async () => {
    await app.close()
  })

  it('translates { error } by Accept-Language; no header keeps Chinese', async () => {
    const get = (lang?: string) =>
      app.inject({ url: '/api/admin/ck-no-such-route', headers: lang ? { 'accept-language': lang } : {} })
    expect((await get()).json()).toEqual({ error: '资源不存在' })
    expect((await get('en-US')).json()).toEqual({ error: 'Resource not found' })
    expect((await get('ja-JP')).json()).toEqual({ error: 'リソースが見つかりません' })
  })

  it('translates auth errors raised before route handlers', async () => {
    const res = await app.inject({ url: '/api/admin/users', headers: { 'accept-language': 'en' } })
    expect(res.statusCode).toBe(401)
    expect(res.json().error).toBe('Unauthorized')
  })
})
