/**
 * scripts/generate-openapi.ts + scripts/import-apifox.ts
 *
 * - 骨架识别
 * - 文档覆盖所有已注册的 /api 路由（按路径形状比较，`{int:x}` 与 `{x}` 等价）
 * - 写回格式同 json.dumps(indent=2, ensure_ascii=False)，逐字节稳定
 * - Apifox 推送：用本地假服务校验 URL / 头 / 体与退出码，不向 Apifox 发真实请求
 */

import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  buildStubEntry,
  collectApiRoutes,
  DOC_PATH,
  fastifyPathToOpenApi,
  findMissingRoutes,
  generateOpenApi,
  isStubEntry,
  pathShape,
  pathStats,
} from '../scripts/generate-openapi'
import { runImport } from '../scripts/import-apifox'
import { dumpIndented, dumpPythonDefault, parseOrderedJson, toOrdered } from '../scripts/lib/ordered-json'
import { intParam } from '../src/common/http'
import { testConfig } from './helpers'

const workDir = mkdtempSync(join(tmpdir(), 'ck-test-r8-openapi-'))
afterAll(() => rmSync(workDir, { recursive: true, force: true }))

const config = () => ({ ...testConfig(), enableTaskScheduler: false })

describe('骨架识别', () => {
  it('生成的骨架是骨架', () => {
    expect(isStubEntry({ GET: { summary: 'GET /x', responses: { '200': { description: '成功' } } } })).toBe(true)
  })

  it('响应带 content 的不是骨架', () => {
    const detailed = { GET: { summary: 'GET /x', responses: { '200': { description: '成功', content: { 'application/json': {} } } } } }
    expect(isStubEntry(detailed)).toBe(false)
  })

  it('带 parameters 的不是骨架', () => {
    const withParams = { GET: { summary: 'GET /x', parameters: [{ name: 'page', in: 'query' }], responses: { '200': { description: '成功' } } } }
    expect(isStubEntry(withParams)).toBe(false)
  })

  it('Python 真值语义：空 parameters / 空 content 仍是骨架；非对象条目算骨架', () => {
    expect(isStubEntry({ GET: { parameters: [], requestBody: null, responses: { '200': { content: {} } } } })).toBe(true)
    expect(isStubEntry({ POST: { requestBody: { content: {} } } })).toBe(false)
    expect(isStubEntry('x')).toBe(true)
    expect(isStubEntry({ summary: 'x', GET: 1 })).toBe(true)
  })

  it('pathStats 统计总数 / 详细 / 骨架', () => {
    const stub = buildStubEntry('/api/x', ['GET'])
    expect(pathStats({ '/a': stub, '/b': { get: { parameters: [{}] } } })).toEqual({ total: 2, detailed: 1, stubs: 1 })
  })
})

describe('路径转换', () => {
  it('Fastify 路由 → OpenAPI 路径', () => {
    expect(fastifyPathToOpenApi(`/api/admin/users/${intParam('user_id')}`)).toBe('/api/admin/users/{user_id}')
    expect(fastifyPathToOpenApi(`/api/a/${intParam('item_id')}/versions/${intParam('version_id')}/rollback`)).toBe(
      '/api/a/{item_id}/versions/{version_id}/rollback',
    )
    expect(fastifyPathToOpenApi('/api/x/:name')).toBe('/api/x/{name}')
    expect(fastifyPathToOpenApi('/api/list-page/file/*')).toBe('/api/list-page/file/{path}')
  })

  it('按形状判断已存在：历史的 {int:x} / {path:x} 条目算已覆盖', () => {
    expect(pathShape('/api/a/{int:item_id}/x')).toBe(pathShape('/api/a/{item_id}/x'))
    expect(pathShape('/api/f/{path:filename}')).toBe(pathShape(fastifyPathToOpenApi('/api/f/*')))
    const routes = new Map([
      ['/api/a/{item_id}', ['DELETE', 'PUT']],
      ['/api/b', ['GET', 'POST']],
    ])
    expect(findMissingRoutes({ '/api/a/{int:item_id}': {} }, routes)).toEqual([['/api/b', ['GET', 'POST']]])
  })

  it('骨架条目格式（方法大写、同一路径的方法合并）', () => {
    expect(buildStubEntry('/api/b', ['GET', 'POST'])).toEqual({
      GET: {
        summary: 'GET /api/b',
        responses: {
          '200': { description: '成功' },
          '400': { description: '请求参数错误' },
          '401': { description: '未授权' },
          '403': { description: '无权限' },
          '404': { description: '资源不存在' },
          '500': { description: '服务器内部错误' },
        },
      },
      POST: expect.objectContaining({ summary: 'POST /api/b' }),
    })
  })
})

describe('保序 JSON', () => {
  it('现有文档解析后重新输出与原文件逐字节一致（含 "201" 在 "200" 之前的键序）', () => {
    const text = readFileSync(DOC_PATH, 'utf8')
    expect(dumpIndented(parseOrderedJson(text))).toBe(text)
  })

  it('requests json= 编码：ensure_ascii + 带空格分隔符', () => {
    expect(dumpPythonDefault(toOrdered({ a: '中\u007f😀"\n', b: [1, true, null], c: {} }))).toBe(
      '{"a": "\\u4e2d\\u007f\\ud83d\\ude00\\"\\n", "b": [1, true, null], "c": {}}',
    )
  })
})

describe('generateOpenApi', () => {
  let routes: Map<string, string[]>
  beforeAll(async () => {
    routes = await collectApiRoutes(config())
  })

  it('从 Fastify 应用收集到 /api 路由（去掉 HEAD）', () => {
    expect(routes.size).toBeGreaterThan(0)
    expect(routes.get('/api/admin/users')).toEqual(['GET', 'POST'])
    expect(routes.get('/api/admin/users/{user_id}')).toEqual(['DELETE', 'PUT'])
    for (const [path, methods] of routes) {
      expect(path.startsWith('/api/')).toBe(true)
      expect(methods).not.toContain('HEAD')
    }
  })

  it('文档覆盖所有已注册的 /api 路由', () => {
    const doc = JSON.parse(readFileSync(DOC_PATH, 'utf8')) as { paths: Record<string, unknown> }
    expect(findMissingRoutes(doc.paths, routes).map(([p]) => p)).toEqual([])
  })

  it('dry-run 只统计不写回；写回时无新增则文件逐字节不变', async () => {
    const file = join(workDir, 'same.json')
    copyFileSync(DOC_PATH, file)
    const before = readFileSync(file, 'utf8')
    const log: string[] = []
    const dry = await generateOpenApi({ config: config(), docPath: file, dryRun: true, log: (m) => log.push(m) })
    expect(dry.added).toEqual([])
    expect(log).toContain(`补齐 0 个路径（均为骨架，需人工补 schema）`)
    expect(log.some((m) => m.startsWith('文档路径统计：总数 '))).toBe(true)
    expect(log.some((m) => m.startsWith('已写回'))).toBe(false)

    await generateOpenApi({ config: config(), docPath: file, log: () => {} })
    expect(readFileSync(file, 'utf8')).toBe(before)
  })

  it('缺失路由补骨架、按路径排序写回；--strict 有骨架时退出 1', async () => {
    const file = join(workDir, 'missing.json')
    const doc = JSON.parse(readFileSync(DOC_PATH, 'utf8')) as { paths: Record<string, unknown> }
    delete doc.paths['/api/admin/users']
    delete doc.paths['/api/admin/users/{int:user_id}']
    delete doc.paths['/api/admin/users/{user_id}']
    writeFileSync(file, JSON.stringify(doc, null, 2))

    const log: string[] = []
    const result = await generateOpenApi({ config: config(), docPath: file, strict: true, log: (m) => log.push(m) })
    expect(result.added).toEqual([
      ['/api/admin/users', ['GET', 'POST']],
      ['/api/admin/users/{user_id}', ['DELETE', 'PUT']],
    ])
    expect(result.exitCode).toBe(1)
    expect(log).toContain('补齐 2 个路径（均为骨架，需人工补 schema）')
    expect(log.at(-1)).toBe(`❌ --strict：仍有 ${result.stats.stubs} 个骨架路径，请补充 schema 后再提交`)

    const written = JSON.parse(readFileSync(file, 'utf8')) as { paths: Record<string, unknown> }
    expect(written.paths['/api/admin/users/{user_id}']).toEqual(buildStubEntry('/api/admin/users/{user_id}', ['DELETE', 'PUT']))
    const keys = Object.keys(written.paths)
    expect(keys).toEqual([...keys].sort())
  })
})

describe('import-apifox（本地假服务）', () => {
  let server: Server
  let baseUrl: string
  const received: Array<{ method: string; url: string; headers: Record<string, string | string[] | undefined>; body: string }> = []
  let reply: [number, string] = [200, '{}']

  beforeAll(async () => {
    server = createServer((req, res) => {
      const chunks: Buffer[] = []
      req.on('data', (c: Buffer) => chunks.push(c))
      req.on('end', () => {
        received.push({ method: req.method!, url: req.url!, headers: req.headers, body: Buffer.concat(chunks).toString('utf8') })
        res.writeHead(reply[0], { 'content-type': 'application/json' })
        res.end(reply[1])
      })
    })
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  })
  afterAll(async () => {
    await new Promise((r) => server.close(r))
  })

  const run = async (argv: string[], env: NodeJS.ProcessEnv = {}) => {
    const out: string[] = []
    const err: string[] = []
    const code = await runImport(argv, { baseUrl, env, out: (l) => out.push(l), err: (l) => err.push(l) })
    return { code, out, err }
  }

  it('默认读取 docs 下的文档：URL / 头 / 体', async () => {
    received.length = 0
    reply = [200, '{"data": {"counters": {"endpointCreated": 3, "endpointFailed": 0}, "errors": []}}']
    const { code, out } = await run([], { APIFOX_PROJECT_ID: 'p1', APIFOX_ACCESS_TOKEN: 't1' })
    expect(code).toBe(0)
    const req = received[0]!
    expect(req.method).toBe('POST')
    expect(req.url).toBe('/v1/projects/p1/import-openapi?locale=zh-CN')
    expect(req.headers.authorization).toBe('Bearer t1')
    expect(req.headers['x-apifox-api-version']).toBe('2024-03-28')
    expect(req.headers['content-type']).toBe('application/json')
    expect(/^[\x00-\x7f]*$/.test(req.body)).toBe(true)
    expect(JSON.parse(req.body)).toEqual({
      input: readFileSync(DOC_PATH, 'utf8'),
      options: {
        endpointOverwriteBehavior: 'OVERWRITE_EXISTING',
        schemaOverwriteBehavior: 'OVERWRITE_EXISTING',
        updateFolderOfChangedEndpoint: false,
        prependBasePath: false,
        deleteUnmatchedResources: false,
      },
    })
    expect(out).toEqual([
      'Import request accepted.',
      '{\n  "data": {\n    "counters": {\n      "endpointCreated": 3,\n      "endpointFailed": 0\n    },\n    "errors": []\n  }\n}',
      'Import counters:',
      '  - endpointCreated: 3',
      '  - endpointFailed: 0',
    ])
  })

  it('--input-url + basicAuth + 可选项；返回 errors 时退出 2', async () => {
    received.length = 0
    reply = [200, '{"data": {"errors": [{"code": "E1", "message": "坏了"}, "plain"]}}']
    const { code, out, err } = await run([
      '--', '--project-id', '99', '--access-token', 'tok', '--api-version', 'v2', '--locale', 'zh CN*~',
      '--input-url', 'https://x.test/a.json', '--input-basic-auth-username', 'u', '--input-basic-auth-password', 'p',
      '--target-endpoint-folder-id', ' 12', '--module-id', '3', '--endpoint-overwrite-behavior', 'AUTO_MERGE', '--prepend-base-path',
    ])
    expect(code).toBe(2)
    expect(received[0]!.url).toBe('/v1/projects/99/import-openapi?locale=zh+CN%2A~')
    expect(received[0]!.body).toBe(
      '{"input": {"url": "https://x.test/a.json", "basicAuth": {"username": "u", "password": "p"}}, "options": ' +
        '{"endpointOverwriteBehavior": "AUTO_MERGE", "schemaOverwriteBehavior": "OVERWRITE_EXISTING", ' +
        '"updateFolderOfChangedEndpoint": false, "prependBasePath": true, "deleteUnmatchedResources": false, ' +
        '"targetEndpointFolderId": 12, "moduleId": 3}}',
    )
    expect(out).toContain('No counters returned.')
    expect(err).toEqual(['Import returned errors:', '  - code=E1 message=坏了', '  - code= message=plain'])
  })

  it('*Failed 计数 > 0 退出 2；HTTP >= 400 退出 1 并把非 JSON 响应包成 raw', async () => {
    reply = [200, '{"data": {"counters": {"schemaFailed": "2"}}}']
    expect((await run(['--project-id', '1', '--access-token', 't'])).code).toBe(2)
    reply = [500, 'boom']
    const failed = await run(['--project-id', '1', '--access-token', 't'])
    expect(failed.code).toBe(1)
    expect(failed.err).toEqual(['Import failed. HTTP 500', '{\n  "raw": "boom"\n}'])
  })

  it('参数错误退出 2；输入构建失败退出 1（不发请求）', async () => {
    received.length = 0
    const missing = await run(['--access-token', 't'])
    expect(missing.code).toBe(2)
    expect(missing.err.at(-1)).toBe('import-apifox: error: Missing --project-id (or APIFOX_PROJECT_ID env var).')
    expect((await run(['--project-id', '1'])).err.at(-1)).toBe(
      'import-apifox: error: Missing --access-token (or APIFOX_ACCESS_TOKEN env var).',
    )
    expect((await run(['--project-id', '1', '--access-token', 't', '--timeout', 'x'])).code).toBe(2)
    expect((await run(['--project-id', '1', '--access-token', 't', '--schema-overwrite-behavior', 'NOPE'])).code).toBe(2)

    const noPassword = await run(['--project-id', '1', '--access-token', 't', '--input-url', 'http://x', '--input-basic-auth-username', 'u'])
    expect(noPassword).toMatchObject({
      code: 1,
      err: ['Input build failed: Both --input-basic-auth-username and --input-basic-auth-password are required together.'],
    })
    const noFile = await run(['--project-id', '1', '--access-token', 't', '--spec-file', '/nonexistent-ck.json'])
    expect(noFile).toMatchObject({ code: 1, err: ['Input build failed: OpenAPI file not found: /nonexistent-ck.json'] })
    expect(received).toHaveLength(0)
  })
})
