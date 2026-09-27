/**
 * OpenAPI document gate: every registered /api route + method is documented per AGENTS.md's OpenAPI rules
 * (scripts/lib/openapi-lint.ts). The rules themselves are checked on small hand-made documents.
 */

import { readFileSync } from 'node:fs'
import { beforeAll, describe, expect, it } from 'vitest'
import { z } from 'zod'
import { exportBody, field, routeBody, type BodyMode, type BodySchema } from '@/common/validation'
import { collectApiRoutes, DOC_PATH } from '../scripts/generate-openapi'
import {
  BODY_SYNC_ALLOWLIST,
  bodyDifferences,
  isExportContractEnum,
  lintBodySync,
  type BodySyncException,
  type RouteBodyDeclaration,
} from '../scripts/lib/openapi-body-sync'
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

  it('structure: missing operation, typed path key, uppercase method, stale entry', () => {
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

describe('request bodies match the routeBody declarations', () => {
  const itemBody = z.object({
    name: field.requiredText('名称', '名称不能为空'),
    note: field.text('备注'),
    status: field.choice('状态', ['on', 'off'], 'on'),
    tags: field.textList('标签'),
  })
  const documented = {
    name: { type: 'string' },
    note: { type: ['string', 'null'] },
    status: { type: ['string', 'null'], enum: ['on', 'off', null] },
    tags: { type: ['array', 'null'], items: { type: 'string' } },
  }
  const opWith = (schema: Record<string, unknown>) => ({ ...good, requestBody: { content: { 'application/json': { schema } } } })
  const objectOp = (properties: Record<string, unknown>, required?: string[]) => opWith({ type: 'object', properties, ...(required ? { required } : {}) })
  /** "field kind" for each difference */
  const diff = (schema: BodySchema, mode: BodyMode, op: Record<string, unknown>) =>
    bodyDifferences({ schema, mode }, op)?.map((d) => `${d.field} ${d.kind}`)

  it('a documented body that matches passes: create lists what must be sent, an update lists nothing', () => {
    expect(diff(itemBody, 'create', objectOp(documented, ['name']))).toEqual([])
    expect(diff(itemBody, 'patch', objectOp(documented))).toEqual([])
    expect(diff(itemBody, 'patch', objectOp(documented, ['name']))).toEqual(['name required-extra'])
    expect(diff(itemBody, 'create', objectOp(documented))).toEqual(['name required-missing'])
  })

  it('nullability, types, enums and properties on one side only', () => {
    const changed = (patch: Record<string, unknown>) => diff(itemBody, 'patch', objectOp({ ...documented, ...patch }))
    expect(changed({ note: { type: 'string' } })).toEqual(['note nullable'])
    expect(changed({ name: { type: ['string', 'null'] } })).toEqual(['name not-nullable'])
    expect(changed({ tags: { type: ['string', 'null'] } })).toEqual(['tags type', 'tags type'])
    expect(changed({ status: { type: ['string', 'null'] } })).toEqual(['status enum-missing'])
    expect(changed({ status: { type: ['string', 'null'], enum: ['on', null] } })).toEqual(['status enum-values'])
    expect(changed({ status: { type: ['string', 'null'], enum: ['on', 'off'] } })).toEqual(['status enum-null'])
    expect(changed({ note: { type: ['string', 'null'], enum: ['a', 'b', null] } })).toEqual(['note enum-free-text'])
    expect(changed({ extra: { type: 'string' } })).toEqual(['extra doc-only'])
    const { tags: _t, ...withoutTags } = documented
    expect(diff(itemBody, 'patch', objectOp(withoutTags))).toEqual(['tags zod-only'])
  })

  it('nested objects, array items, arrays of objects and array bodies are compared too', () => {
    const exportRequest = exportBody({ status: field.text('状态') })
    const exportDoc = {
      ids: { type: ['array', 'null'], items: { type: 'integer' } },
      fields: { type: ['array', 'null'], items: { type: 'string', enum: ['id', 'name'] } },
      export_mode: { type: ['string', 'null'], enum: ['selected', 'filtered', 'all', null] },
      filters: { type: ['object', 'null'], properties: { status: { type: ['string', 'null'], enum: ['on', 'off', '', null] } } },
      file_type: { type: ['string', 'null'] },
    }
    expect(diff(exportRequest, 'create', objectOp(exportDoc))).toEqual(['fields[] items-enum', 'filters.status enum-free-text'])

    const conditions = z.object({ conditions: z.array(z.object({ field: field.requiredText('字段', '字段不能为空') })) })
    const conditionsDoc = (item: Record<string, unknown>) =>
      objectOp({ conditions: { type: 'array', items: { type: 'object', properties: item, required: ['field'] } } }, ['conditions'])
    expect(diff(conditions, 'create', conditionsDoc({ field: { type: 'string' } }))).toEqual([])
    expect(diff(conditions, 'create', conditionsDoc({ field: { type: ['string', 'null'] } }))).toEqual(['conditions[].field not-nullable'])

    const reorder = z.object({ id: field.id('ID'), sort_order: field.int('排序', 0) })
    const items = { type: 'object', properties: { id: { type: ['integer', 'null'] }, sort_order: { type: ['integer', 'null'] } } }
    expect(diff(reorder, 'array', opWith({ type: 'array', items }))).toEqual([])
    expect(diff(reorder, 'array', opWith(items))).toEqual([' body'])
    // No JSON body documented: other rules report it
    expect(bodyDifferences({ schema: reorder, mode: 'array' }, good)).toBeDefined()
    expect(bodyDifferences({ schema: reorder, mode: 'array' }, { ...good, requestBody: undefined })).toBeUndefined()
  })

  it('runs in lintOpenApi when the routes carry their body declarations; allowlisted differences pass, stale entries fail', () => {
    const path = '/api/admin/departments/{dept_id}'
    const doc = docWith({ [path]: { put: objectOp({ ...documented, note: { type: 'string' } }) } })
    const bodies = new Map<string, RouteBodyDeclaration>([[`PUT ${path}`, { schema: itemBody, mode: 'patch' }]])
    // A hand-made route map (no declarations) skips the rule, e.g. scaffold's static document checks
    expect(lintOpenApi(doc, routes)).toEqual([])
    const withBodies = Object.assign(new Map(routes), { bodies })
    expect(lintOpenApi(doc, withBodies).filter((i) => i.operation === `PUT ${path}`)).toEqual([
      {
        rule: 'body-sync',
        operation: `PUT ${path}`,
        message: 'body field note: the backend accepts null (read as null), but the documented type "string" has no null [nullable]',
      },
    ])

    const operationOf = (method: string, p: string) => (p === path && method === 'PUT' ? (doc.paths[path] as { put: Record<string, unknown> }).put : undefined)
    const entry: BodySyncException = { method: 'PUT', path, field: 'note', kind: 'nullable', reason: 'test' }
    expect(lintBodySync(operationOf, bodies, [entry])).toEqual([])
    expect(lintBodySync(operationOf, bodies, [{ ...entry, kind: ['nullable', 'enum-free-text'] }]).map((i) => i.message)).toEqual([
      'allowlisted body field note [enum-free-text] matches no difference any more; remove it from BODY_SYNC_ALLOWLIST (scripts/lib/openapi-body-sync.ts)',
    ])
    expect(lintBodySync(operationOf, bodies, [entry, { ...entry, path: '/api/admin/gone' }]).map((i) => i.message)).toEqual([
      'allowlisted body field note: no route declares this body with routeBody; remove the entry from BODY_SYNC_ALLOWLIST (scripts/lib/openapi-body-sync.ts)',
    ])
  })

  it("export requests' fields[] / file_type enums are the contract by design, not a difference", () => {
    const exportRequest = exportBody({})
    const op = objectOp({
      ids: { type: ['array', 'null'], items: { type: 'integer' } },
      fields: { type: ['array', 'null'], items: { type: 'string', enum: ['id', 'name'] } },
      export_mode: { type: ['string', 'null'], enum: ['selected', 'filtered', 'all', null] },
      filters: { type: ['object', 'null'], properties: {} },
      file_type: { type: ['string', 'null'], enum: ['csv', 'xlsx', null] },
    })
    const lint = (path: string) => lintBodySync(() => op, new Map([[`POST ${path}`, { schema: exportRequest, mode: 'create' as const }]]), [])
    expect(lint('/api/admin/things/export')).toEqual([])
    expect(lint('/api/admin/things').map((i) => i.message.replace(/:.*\[/, ' ['))).toEqual(['body field fields[] [items-enum]', 'body field file_type [enum-free-text]'])
    expect(isExportContractEnum('/api/admin/things/export', { field: 'filters.status', kind: 'enum-free-text' })).toBe(false)
  })

  it('routeBody puts the declaration on the route and parses like parseBody / parsePatch / parseArrayBody', () => {
    const create = routeBody(itemBody, 'create')
    expect(create.route).toEqual({ config: { body: itemBody, bodyMode: 'create' } })
    expect(create.parse({ body: { name: ' x ' } })).toEqual({ name: 'x', note: null, status: 'on', tags: [] })
    expect(routeBody(itemBody, 'patch').parse({ body: { note: ' n ' } })).toEqual({ note: 'n' })
    const reorder = routeBody(z.object({ id: field.id('ID') }), 'array', '需要数组')
    expect(reorder.parse({ body: [{ id: 1 }] })).toEqual([{ id: 1 }])
    expect(reorder.parse({ body: null })).toEqual([])
    expect(() => reorder.parse({ body: {} })).toThrow('需要数组')
  })

  it('every allowlist entry has a reason and names a body field once', () => {
    const keys = BODY_SYNC_ALLOWLIST.map((e) => `${e.method} ${e.path} ${e.field}`)
    expect(new Set(keys).size).toBe(keys.length)
    for (const e of BODY_SYNC_ALLOWLIST) expect(e.reason.trim(), keys.join('\n')).not.toBe('')
  })
})

describe('docs/apifox-full.openapi.json', () => {
  let apiRoutes: Awaited<ReturnType<typeof collectApiRoutes>>
  beforeAll(async () => {
    apiRoutes = await collectApiRoutes({ ...testConfig(), enableTaskScheduler: false })
  })

  it('records the body declaration of every route that reads one with routeBody', () => {
    const { bodies } = apiRoutes
    expect(bodies.get('POST /api/admin/departments')?.mode).toBe('create')
    expect(bodies.get('PUT /api/admin/departments/{dept_id}')?.mode).toBe('patch')
    expect(bodies.get('PUT /api/admin/component-center/kanban/cards/reorder')?.mode).toBe('array')
    // A handler shared by GET and POST (export from the query or the body) declares its body on the POST route only
    expect(bodies.has('POST /api/admin/component-center/list-page/export')).toBe(true)
    expect(bodies.has('GET /api/admin/component-center/list-page/export')).toBe(false)
  })

  it('documents every registered /api route per the rules (fix the listed operations; see AGENTS.md "OpenAPI writing rules")', () => {
    const issues = lintOpenApi(JSON.parse(readFileSync(DOC_PATH, 'utf8')), apiRoutes)
    expect(issues.length, `\n${formatLintIssues(issues)}\n`).toBe(0)
  })
})
