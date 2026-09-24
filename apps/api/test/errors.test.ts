import Fastify from 'fastify'
import { describe, expect, it } from 'vitest'
import { registerErrorHandler, ServiceError } from '@/common/errors'

describe('统一错误处理', () => {
  it('ServiceError → {error, ...payload}；5xx 不透传内部信息；未知异常 → 500 通用文案', async () => {
    const app = Fastify()
    registerErrorHandler(app)
    app.get('/biz', async () => {
      throw new ServiceError('名称已存在', 409, { field: 'name' })
    })
    app.get('/biz500', async () => {
      throw new ServiceError('duplicate key value violates unique constraint', 500)
    })
    app.get('/boom', async () => {
      throw new Error('connection refused at 10.0.0.1')
    })
    app.post('/json', async () => ({}))

    const biz = await app.inject('/biz')
    expect(biz.statusCode).toBe(409)
    expect(biz.json()).toEqual({ error: '名称已存在', field: 'name' })

    for (const url of ['/biz500', '/boom']) {
      const res = await app.inject(url)
      expect(res.statusCode).toBe(500)
      expect(res.json()).toEqual({ error: '服务器内部错误，请稍后重试' })
    }

    const bad = await app.inject({ method: 'POST', url: '/json', headers: { 'content-type': 'application/json' }, payload: '{bad' })
    expect(bad.statusCode).toBe(400)
    expect(bad.json()).toEqual({ error: '请求体格式错误' })
    await app.close()
  })
})
