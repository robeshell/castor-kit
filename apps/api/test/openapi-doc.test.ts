/**
 * OpenAPI document gate: every registered /api route + method is documented per AGENTS.md's OpenAPI rules
 * (scripts/lib/openapi-lint.ts). The rules themselves are checked on small hand-made documents.
 */

import { readFileSync } from 'node:fs'
import { beforeAll, describe, expect, it } from 'vitest'
import { collectApiRoutes, DOC_PATH } from '../scripts/generate-openapi'
import { formatLintIssues, lintOpenApi } from '../scripts/lib/openapi-lint'
import { testConfig } from './helpers'

const good = {
  summary: '编辑部门',
  description: '需要 system_departments_edit',
  tags: ['后台-部门管理'],
  'x-apifox-folder': '后台/系统管理/部门管理',
  security: [{ cookieAuth: [] }, { bearerAuth: [] }],
  parameters: [{ name: 'dept_id', in: 'path', required: true, schema: { type: 'integer' } }],
  requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { name: { type: 'string' } } } } } },
  responses: { '200': { description: '成功', content: { 'application/json': { schema: { type: 'object', properties: { id: { type: 'integer' } } } } } }, '401': { description: '未登录' } },
}
const docWith = (paths: Record<string, unknown>) => ({ tags: [{ name: '后台-部门管理' }], paths })
const routes = new Map([['/api/admin/departments/{dept_id}', ['PUT']]])
const rulesOf = (paths: Record<string, unknown>) => lintOpenApi(docWith(paths), routes).map((i) => i.rule)

describe('OpenAPI rules', () => {
  it('a complete operation passes', () => {
    expect(lintOpenApi(docWith({ '/api/admin/departments/{dept_id}': { put: good } }), routes)).toEqual([])
  })

  it('structure: missing operation, legacy key, uppercase method, stale entry', () => {
    expect(rulesOf({})).toEqual(['missing'])
    expect(rulesOf({ '/api/admin/departments/{int:dept_id}': { put: good } })).toEqual(['path-key', 'missing'])
    expect(rulesOf({ '/api/admin/departments/{dept_id}': { PUT: good } })).toEqual(['method-case', 'missing'])
    expect(rulesOf({ '/api/admin/departments/{dept_id}': { put: good, delete: good } })).toEqual(['stale'])
  })

  it('summary must be readable Chinese', () => {
    for (const summary of ['', 'PUT /api/admin/departments/{dept_id}', '创建departments', 'update dept']) {
      expect(rulesOf({ '/api/admin/departments/{dept_id}': { put: { ...good, summary } } }), summary).toContain('summary')
    }
    expect(rulesOf({ '/api/admin/departments/{dept_id}': { put: { ...good, summary: '编辑 API Token' } } })).toEqual([])
  })

  it('tags, folder, description, security', () => {
    expect(rulesOf({ '/api/admin/departments/{dept_id}': { put: { ...good, tags: ['未声明'] } } })).toEqual(['tags'])
    expect(rulesOf({ '/api/admin/departments/{dept_id}': { put: { ...good, tags: [] } } })).toEqual(['tags'])
    const { 'x-apifox-folder': _f, description: _d, security: _s, ...bare } = good
    expect(rulesOf({ '/api/admin/departments/{dept_id}': { put: bare } })).toEqual(['description', 'folder', 'security'])
  })

  it('security matches what the route accepts: API tokens unless API_TOKEN_DENIED refuses them', () => {
    expect(rulesOf({ '/api/admin/departments/{dept_id}': { put: { ...good, security: [{ cookieAuth: [] }] } } })).toEqual(['security'])
    const sessions = new Map([['/api/admin/sessions/{key}', ['DELETE']]])
    const del = { ...good, parameters: [{ name: 'key', in: 'path', required: true, schema: { type: 'string' } }], requestBody: undefined }
    const lint = (security: unknown[]) => lintOpenApi(docWith({ '/api/admin/sessions/{key}': { delete: { ...del, security } } }), sessions).map((i) => i.rule)
    expect(lint([{ cookieAuth: [] }])).toEqual([])
    expect(lint([{ cookieAuth: [] }, { bearerAuth: [] }])).toEqual(['security'])
  })

  it('path parameters are declared with the route name, required and typed', () => {
    expect(rulesOf({ '/api/admin/departments/{dept_id}': { put: { ...good, parameters: [] } } })).toEqual(['path-params'])
    const loose = [{ name: 'dept_id', in: 'path', schema: { type: 'integer' } }]
    expect(rulesOf({ '/api/admin/departments/{dept_id}': { put: { ...good, parameters: loose } } })).toEqual(['path-params'])
  })

  it('writes describe their body, or say they have none', () => {
    const { requestBody: _b, ...noBody } = good
    expect(rulesOf({ '/api/admin/departments/{dept_id}': { put: noBody } })).toEqual(['request-body'])
    const empty = { ...good, requestBody: { content: { 'application/json': { schema: { type: 'object', properties: {} } } } } }
    expect(rulesOf({ '/api/admin/departments/{dept_id}': { put: empty } })).toEqual(['request-body'])
    expect(rulesOf({ '/api/admin/departments/{dept_id}': { put: { ...noBody, 'x-no-body': true } } })).toEqual([])
    const upload = { ...good, requestBody: { content: { 'multipart/form-data': { schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } } } } }
    expect(rulesOf({ '/api/admin/departments/{dept_id}': { put: upload } })).toEqual([])
  })

  it('success responses describe what comes back; signed-in routes list 401', () => {
    expect(rulesOf({ '/api/admin/departments/{dept_id}': { put: { ...good, responses: { '200': { description: '成功' }, '401': {} } } } })).toEqual(['response'])
    expect(rulesOf({ '/api/admin/departments/{dept_id}': { put: { ...good, responses: { '204': { description: '已删除' }, '401': {} } } } })).toEqual([])
    const binary = { '200': { description: '文件', content: { 'text/csv': { schema: { type: 'string', format: 'binary' } } } }, '401': {} }
    expect(rulesOf({ '/api/admin/departments/{dept_id}': { put: { ...good, responses: binary } } })).toEqual([])
    expect(rulesOf({ '/api/admin/departments/{dept_id}': { put: { ...good, responses: { '200': good.responses['200'] } } } })).toEqual(['error-responses'])
    expect(rulesOf({ '/api/admin/departments/{dept_id}': { put: { ...good, security: [], responses: { '200': good.responses['200'] } } } })).toEqual([])
  })
})

describe('docs/apifox-full.openapi.json', () => {
  let apiRoutes: Map<string, string[]>
  beforeAll(async () => {
    apiRoutes = await collectApiRoutes({ ...testConfig(), enableTaskScheduler: false })
  })

  it('documents every registered /api route per the rules (fix the listed operations; see AGENTS.md「OpenAPI 编写规范」)', () => {
    const issues = lintOpenApi(JSON.parse(readFileSync(DOC_PATH, 'utf8')), apiRoutes)
    expect(issues.length, `\n${formatLintIssues(issues)}\n`).toBe(0)
  })
})
