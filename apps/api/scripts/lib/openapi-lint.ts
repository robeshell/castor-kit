/**
 * OpenAPI document rules (AGENTS.md, "OpenAPI 编写规范" section): every registered /api route is documented completely enough
 * for a person, an external client or the AI assistant to call it without reading the code.
 *
 * Used by test/openapi-doc.test.ts (the gate), `pnpm openapi:generate -- --strict` and `pnpm verify`.
 */

import { apiTokenDenied } from '../../src/common/api-token'

const METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const
const BODY_METHODS = new Set(['post', 'put', 'patch'])
const CJK = /[㐀-鿿]/

export interface LintIssue {
  /** Rule code, e.g. "summary" */
  rule: string
  /** "METHOD /path" */
  operation: string
  message: string
}

type Json = Record<string, unknown>
const isObject = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v)
const nonEmpty = (v: unknown) => isObject(v) && Object.keys(v).length > 0

/** A concrete path for matching route patterns: `/users/{user_id}` → `/users/1` */
const samplePath = (path: string) => path.replace(/\{[^}]*\}/g, '1')

/**
 * The security a signed-in operation should declare: cookie sessions always, API tokens unless the route refuses
 * them (API_TOKEN_DENIED). Public operations declare [].
 */
export function expectedSecurity(method: string, path: string): Array<Record<string, string[]>> {
  return apiTokenDenied(method.toUpperCase(), samplePath(path)) ? [{ cookieAuth: [] }] : [{ cookieAuth: [] }, { bearerAuth: [] }]
}

/** Path shape with parameter names blanked: `/users/{user_id}` → `/users/{}` */
const shapeOf = (path: string) => path.replace(/\{[^}]*\}/g, '{}')

/** A schema that actually says something: properties, items, a $ref, a composition, a type other than a bare object, or binary */
function describesSomething(schema: unknown): boolean {
  if (!isObject(schema)) return false
  if (nonEmpty(schema.properties) || isObject(schema.items) || typeof schema.$ref === 'string') return true
  if (Array.isArray(schema.oneOf) || Array.isArray(schema.anyOf) || Array.isArray(schema.allOf)) return true
  if (schema.additionalProperties !== undefined && schema.additionalProperties !== false) return true
  if (schema.format === 'binary') return true
  return schema.type !== undefined && schema.type !== 'object'
}

function contentDescribes(content: unknown): boolean {
  return isObject(content) && Object.values(content).some((media) => isObject(media) && describesSomething(media.schema))
}

export function lintOperation(path: string, method: string, op: Json, tagNames: Set<string>): LintIssue[] {
  const operation = `${method.toUpperCase()} ${path}`
  const issues: LintIssue[] = []
  const add = (rule: string, message: string) => issues.push({ rule, operation, message })

  const summary = typeof op.summary === 'string' ? op.summary.trim() : ''
  if (!summary) add('summary', '缺少 summary')
  else if (!CJK.test(summary) || /^(GET|POST|PUT|PATCH|DELETE)\b/.test(summary) || /[㐀-鿿][a-z_]{3,}|[a-z_]{3,}[㐀-鿿]/.test(summary)) {
    add('summary', `summary 要写成看得懂的中文（如「新增部门」），现在是「${summary}」`)
  }
  if (typeof op.description !== 'string' || !op.description.trim()) add('description', '缺少 description（写明所需权限、数据权限与特殊行为）')

  const tags = Array.isArray(op.tags) ? op.tags : []
  if (tags.length !== 1) add('tags', 'tags 必须恰好一个')
  else if (!tagNames.has(String(tags[0]))) add('tags', `标签「${String(tags[0])}」没有在文档顶层 tags 里声明`)
  if (typeof op['x-apifox-folder'] !== 'string' || !op['x-apifox-folder']) add('folder', '缺少 x-apifox-folder')
  if (!Array.isArray(op.security)) {
    add('security', '缺少 security（见 expectedSecurity：登录接口写 cookieAuth，能用 API Token 的再加 bearerAuth，公开接口写 []）')
  } else if (op.security.length > 0) {
    const schemes = op.security.filter(isObject).flatMap((s) => Object.keys(s))
    const tokenOk = !apiTokenDenied(method.toUpperCase(), samplePath(path))
    if (!schemes.includes('cookieAuth')) add('security', '需要登录的接口要列出 cookieAuth')
    if (tokenOk && !schemes.includes('bearerAuth')) add('security', '这个接口可以用 API Token 调用，security 要加上 { "bearerAuth": [] }')
    if (!tokenOk && schemes.includes('bearerAuth')) add('security', '这个接口拒绝 API Token（API_TOKEN_DENIED），security 不能列 bearerAuth')
  }

  const params = Array.isArray(op.parameters) ? op.parameters.filter(isObject) : []
  for (const name of [...path.matchAll(/\{([^}]+)\}/g)].map((m) => m[1]!)) {
    const declared = params.find((p) => p.in === 'path' && p.name === name)
    if (!declared) add('path-params', `路径参数 ${name} 没有声明`)
    else if (declared.required !== true || !isObject(declared.schema)) add('path-params', `路径参数 ${name} 要 required: true 并写 schema`)
  }
  for (const p of params) {
    if (p.in === 'query' && !isObject(p.schema)) add('query-params', `查询参数 ${String(p.name)} 缺少 schema`)
  }

  if (BODY_METHODS.has(method)) {
    const body = op.requestBody
    if (op['x-no-body'] === true) {
      if (body !== undefined) add('request-body', '声明了 x-no-body 就不要再写 requestBody')
    } else if (!isObject(body) || !contentDescribes(body.content)) {
      add('request-body', '缺少请求体 schema（没有请求体的接口写 "x-no-body": true）')
    }
  }

  const responses = isObject(op.responses) ? op.responses : {}
  const ok = Object.entries(responses).filter(([code]) => /^2\d\d$/.test(code))
  if (ok.length === 0) add('response', '缺少成功响应（2xx）')
  else if (!ok.some(([code, r]) => code === '204' || (isObject(r) && contentDescribes(r.content)))) {
    add('response', '成功响应缺少返回结构（content.schema）')
  }
  if (Array.isArray(op.security) && op.security.length > 0 && !('401' in responses)) add('error-responses', '需要登录的接口要列出 401')
  return issues
}

/**
 * Check the document against the registered routes (OpenAPI path → methods, as collectApiRoutes returns them).
 * Only /api paths are checked.
 */
export function lintOpenApi(doc: unknown, routes: Map<string, string[]>): LintIssue[] {
  const issues: LintIssue[] = []
  const root = isObject(doc) ? doc : {}
  const paths = isObject(root.paths) ? root.paths : {}
  const tagNames = new Set((Array.isArray(root.tags) ? root.tags : []).filter(isObject).map((t) => String(t.name)))

  const shapes = new Map<string, string[]>()
  for (const [path, entry] of Object.entries(paths)) {
    if (!path.startsWith('/api/')) continue
    shapes.set(shapeOf(path), [...(shapes.get(shapeOf(path)) ?? []), path])
    if (/\{[^}]*:[^}]*\}/.test(path)) issues.push({ rule: 'path-key', operation: path, message: '旧写法 {int:x} / {path:x}，改成 {x}（与路由参数同名）' })
    if (!isObject(entry)) continue
    for (const key of Object.keys(entry)) {
      if (key !== key.toLowerCase() && (METHODS as readonly string[]).includes(key.toLowerCase())) {
        issues.push({ rule: 'method-case', operation: `${key} ${path}`, message: '方法名必须小写' })
      }
    }
  }
  for (const [shape, keys] of shapes) {
    if (keys.length > 1) issues.push({ rule: 'path-key', operation: shape, message: `同一路径写了多份：${keys.join('、')}` })
  }

  const documented = new Set<string>()
  for (const [path, methods] of routes) {
    if (!path.startsWith('/api/')) continue
    for (const upper of methods) {
      const method = upper.toLowerCase()
      documented.add(`${method} ${shapeOf(path)}`)
      const entry = paths[path]
      const op = isObject(entry) ? entry[method] : undefined
      if (!isObject(op)) {
        issues.push({ rule: 'missing', operation: `${upper} ${path}`, message: '接口没有文档（路径要与路由参数同名，方法小写）' })
        continue
      }
      issues.push(...lintOperation(path, method, op, tagNames))
    }
  }

  for (const [path, entry] of Object.entries(paths)) {
    if (!path.startsWith('/api/') || !isObject(entry)) continue
    for (const key of Object.keys(entry)) {
      const method = key.toLowerCase()
      if ((METHODS as readonly string[]).includes(method) && !documented.has(`${method} ${shapeOf(path)}`)) {
        issues.push({ rule: 'stale', operation: `${key.toUpperCase()} ${path}`, message: '文档里有、路由里没有：删掉或改成实际路径' })
      }
    }
  }
  return issues
}

/** Human-readable report, grouped by operation */
export function formatLintIssues(issues: LintIssue[]): string {
  const byOp = new Map<string, string[]>()
  for (const i of issues) byOp.set(i.operation, [...(byOp.get(i.operation) ?? []), `[${i.rule}] ${i.message}`])
  return [...byOp].map(([op, list]) => `${op}\n  ${list.join('\n  ')}`).join('\n')
}
