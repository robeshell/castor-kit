/**
 * Scheduled-task URL SSRF protection: basic cases + additional hardening
 */

import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PyUncaughtError, ScheduledTaskSchemaError } from '@/common/scheduler/errors'
import { executeHttpRequest } from '@/common/scheduler/http'
import { isBlockedIp, pyUrlSplit, validateRequestUrl } from '@/common/scheduler/ssrf'

/** Stubs DNS resolution: returns the given IP / fails to resolve */
const resolvesTo = (...ips: string[]) => async () => ips
const failsToResolve = async (): Promise<string[]> => {
  throw new Error('ENOTFOUND')
}

async function expectSchemaError(promise: Promise<unknown>, match?: string | RegExp) {
  const err = await promise.then(
    () => null,
    (e: unknown) => e,
  )
  expect(err).toBeInstanceOf(ScheduledTaskSchemaError)
  if (match) expect((err as Error).message).toMatch(match)
}

describe('validateRequestUrl（基础用例）', () => {
  it('test_allows_public_https', async () => {
    await expect(validateRequestUrl('https://api.example.com/v1/data', { lookup: resolvesTo('93.184.216.34') })).resolves.toBe(
      'https://api.example.com/v1/data',
    )
  })

  it('test_allows_public_http', async () => {
    await expect(validateRequestUrl('http://8.8.8.8/x')).resolves.toBe('http://8.8.8.8/x')
  })

  it('test_blocks_non_http_scheme', async () => {
    await expectSchemaError(validateRequestUrl('file:///etc/passwd'))
    await expectSchemaError(validateRequestUrl('ftp://example.com/x'))
  })

  it('test_blocks_localhost', async () => {
    await expectSchemaError(validateRequestUrl('http://localhost:8000/x'), /内网/)
    await expectSchemaError(validateRequestUrl('http://127.0.0.1/x'), /内网/)
  })

  it('test_blocks_private_ip', async () => {
    for (const url of [
      'http://10.0.0.1/x',
      'http://192.168.1.1/x',
      'http://172.16.0.1/x',
      'http://169.254.169.254/latest/meta-data/',
      'http://0.0.0.0/x',
    ]) {
      await expectSchemaError(validateRequestUrl(url), /内网/)
    }
  })

  it('test_blocks_missing_host', async () => {
    await expectSchemaError(validateRequestUrl('http:///path'))
  })

  it('test_blocks_bad_port', async () => {
    await expectSchemaError(validateRequestUrl('http://example.com:99999/x'), /端口/)
  })
})

describe('validateRequestUrl（补充分支与错误文案）', () => {
  it('空值 / 协议 / 主机 / 端口文案', async () => {
    await expectSchemaError(validateRequestUrl(null), '请求地址不能为空')
    await expectSchemaError(validateRequestUrl('   '), '请求地址不能为空')
    await expectSchemaError(validateRequestUrl('example.com/x'), '请求地址仅支持 http/https 协议')
    await expectSchemaError(validateRequestUrl('http://'), '请求地址缺少主机名')
    await expectSchemaError(validateRequestUrl('http://1.1.1.1:0/x'), '请求地址端口不合法')
    await expectSchemaError(validateRequestUrl('http://1.1.1.1:8a/x'), '请求地址端口不合法')
    await expectSchemaError(validateRequestUrl('http://1.1.1.1:８０/x'), '请求地址端口不合法')
  })

  it('返回 strip 后的原文；协议大小写不敏感', async () => {
    await expect(validateRequestUrl('  HTTPS://1.1.1.1/A  ')).resolves.toBe('HTTPS://1.1.1.1/A')
  })

  it('主机名解析结果任一在内网即拒绝；解析失败', async () => {
    await expectSchemaError(validateRequestUrl('https://mixed.example/x', { lookup: resolvesTo('93.184.216.34', '10.1.2.3') }), '不允许访问内网地址')
    await expectSchemaError(validateRequestUrl('https://nx.example/x', { lookup: failsToResolve }), '请求地址无法解析')
  })

  it('其余保留网段：100.64/10、198.18/15、组播、IPv6 ULA / 链路本地', async () => {
    for (const url of ['http://100.64.0.1/', 'http://198.19.255.255/', 'http://224.0.0.1/', 'http://[fd00::1]/', 'http://[fe80::1%25en0]/']) {
      await expectSchemaError(validateRequestUrl(url), '不允许访问内网地址')
    }
  })

  it('userinfo 不影响主机判定（取 @ 之后）', async () => {
    await expectSchemaError(validateRequestUrl('http://1.1.1.1@127.0.0.1/x'), '不允许访问内网地址')
  })

  it('加固：IPv4 映射的 IPv6 与 :: 同样拦截', async () => {
    await expectSchemaError(validateRequestUrl('http://[::ffff:127.0.0.1]/x'), '不允许访问内网地址')
    await expectSchemaError(validateRequestUrl('http://[::ffff:a00:1]/x'), '不允许访问内网地址')
    await expectSchemaError(validateRequestUrl('http://[::]/x'), '不允许访问内网地址')
    expect(isBlockedIp('::ffff:169.254.169.254')).toBe(true)
    expect(isBlockedIp('2606:4700:4700::1111')).toBe(false)
  })

  it('urlsplit 自身抛 ValueError 的输入（未捕获 → 500）', () => {
    expect(() => pyUrlSplit('http://[::1/x')).toThrow(PyUncaughtError)
    expect(() => pyUrlSplit('http://::1]/x')).toThrow('Invalid IPv6 URL')
    expect(() => pyUrlSplit('http://a[::1]/x')).toThrow('Invalid IPv6 URL')
    expect(() => pyUrlSplit('http://[1.2.3.4]/x')).toThrow('An IPv4 address cannot be in brackets')
    expect(() => pyUrlSplit('http://[vz.x]/x')).toThrow('IPvFuture address is invalid')
    expect(() => pyUrlSplit('http://exa℀mple.com/')).toThrow(/NFKC/)
    expect(pyUrlSplit(' \x00\thttp://h\nost:80/p')).toEqual({ scheme: 'http', netloc: 'host:80' })
  })
})

describe('执行阶段连接级复检（Node 加固：防 DNS rebinding / 重定向绕过）', () => {
  let server: Server
  let port: number
  let hits = 0

  beforeAll(async () => {
    server = createServer((_req, res) => {
      hits += 1
      res.end('should-not-reach')
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    port = (server.address() as AddressInfo).port
  })

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()))
  })

  const run = (url: string) => executeHttpRequest({ method: 'GET', url, headers: {}, body: null, timeoutSeconds: 5 })

  it('IP 直连内网地址：连接前拒绝', async () => {
    await expect(run(`http://127.0.0.1:${port}/`)).rejects.toThrow('不允许访问内网地址')
    await expect(run(`http://[::ffff:127.0.0.1]:${port}/`)).rejects.toThrow('不允许访问内网地址')
    expect(hits).toBe(0)
  })

  it('校验时解析到公网、执行时解析到内网（rebinding）：执行阶段拦截', async () => {
    // The validation at creation time is "fooled"
    await expect(validateRequestUrl(`http://localhost:${port}/`, { lookup: resolvesTo('93.184.216.34') })).resolves.toBeTruthy()
    // At actual execution localhost resolves to 127.0.0.1 → rejected
    await expect(run(`http://localhost:${port}/`)).rejects.toThrow('不允许访问内网地址')
    expect(hits).toBe(0)
  })
})
