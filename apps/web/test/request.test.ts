/** request.ts turns failures without a usable body into an `{ error }` that says what to do */
import { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios'
import { afterEach, describe, expect, it } from 'vitest'
import request from '@/shared/api/request'
import { errorMessage } from '@/lib/toast'

const original = request.defaults.adapter

function failWith(make: (config: InternalAxiosRequestConfig) => unknown): void {
  const adapter: AxiosAdapter = (config) => Promise.reject(make(config))
  request.defaults.adapter = adapter
}

afterEach(() => {
  request.defaults.adapter = original
})

describe('request error mapping', () => {
  it('no response (offline, server down) → check the connection', async () => {
    failWith((config) => new AxiosError('Network Error', AxiosError.ERR_NETWORK, config))
    const err = await request.get('/x').catch((e: unknown) => e)
    expect(err).toMatchObject({ error: '无法连接服务器，请检查网络后重试。' })
    expect(errorMessage(err)).toBe('无法连接服务器，请检查网络后重试。')
  })

  it('timeout → try again in a moment', async () => {
    failWith((config) => new AxiosError('timeout of 10000ms exceeded', AxiosError.ECONNABORTED, config))
    await expect(request.get('/x')).rejects.toMatchObject({ error: '服务器响应超时，请稍后重试。' })
  })

  it('a 5xx without our { error } body → server problem, not the raw page', async () => {
    failWith((config) => new AxiosError('Request failed', AxiosError.ERR_BAD_RESPONSE, config, null, { status: 502, statusText: 'Bad Gateway', headers: {}, config, data: '<html>bad gateway</html>' }))
    await expect(request.get('/x')).rejects.toMatchObject({ error: '服务器出错了，请稍后重试；如果一直出现，请联系管理员。', status: 502 })
  })

  it('an API error body passes through unchanged', async () => {
    failWith((config) => new AxiosError('Request failed', AxiosError.ERR_BAD_REQUEST, config, null, { status: 400, statusText: 'Bad Request', headers: {}, config, data: { error: '用户名已存在' } }))
    await expect(request.get('/x')).rejects.toEqual({ error: '用户名已存在' })
  })
})
