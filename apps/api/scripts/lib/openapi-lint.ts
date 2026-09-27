/**
 * OpenAPI document rules (AGENTS.md, "OpenAPI writing rules" section): every registered /api route is documented completely enough
 * for a person, an external client or the AI assistant to call it without reading the code.
 *
 * Used by test/openapi-doc.test.ts (the gate), `pnpm openapi:generate -- --strict` and `pnpm verify`.
 */

import { apiTokenDenied } from '../../src/common/api-token'

const METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const
const BODY_METHODS = new Set(['post', 'put', 'patch'])
const CJK = /[\u3400-\u9fff]/

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
  if (!summary) add('summary', 'missing summary')
  else if (!CJK.test(summary) || /^(GET|POST|PUT|PATCH|DELETE)\b/.test(summary) || /[\u3400-\u9fff][a-z_]{3,}|[a-z_]{3,}[\u3400-\u9fff]/.test(summary)) {
    add('summary', `summary must be readable Chinese (e.g. "新增部门"); got "${summary}"`)
  }
  if (typeof op.description !== 'string' || !op.description.trim()) add('description', 'missing description (state the required permission, the data scope and any special behavior)')

  const tags = Array.isArray(op.tags) ? op.tags : []
  if (tags.length !== 1) add('tags', 'tags must have exactly one entry')
  else if (!tagNames.has(String(tags[0]))) add('tags', `tag "${String(tags[0])}" is not declared in the top-level tags`)
  if (typeof op['x-apifox-folder'] !== 'string' || !op['x-apifox-folder']) add('folder', 'missing x-apifox-folder')
  if (!Array.isArray(op.security)) {
    add('security', 'missing security (see expectedSecurity: signed-in endpoints list cookieAuth, plus bearerAuth if they accept API tokens; public endpoints use [])')
  } else if (op.security.length > 0) {
    const schemes = op.security.filter(isObject).flatMap((s) => Object.keys(s))
    const tokenOk = !apiTokenDenied(method.toUpperCase(), samplePath(path))
    if (!schemes.includes('cookieAuth')) add('security', 'endpoints that need sign-in must list cookieAuth')
    if (tokenOk && !schemes.includes('bearerAuth')) add('security', 'this endpoint accepts API tokens, so security must include { "bearerAuth": [] }')
    if (!tokenOk && schemes.includes('bearerAuth')) add('security', 'this endpoint refuses API tokens (API_TOKEN_DENIED), so security must not list bearerAuth')
  }

  const params = Array.isArray(op.parameters) ? op.parameters.filter(isObject) : []
  for (const name of [...path.matchAll(/\{([^}]+)\}/g)].map((m) => m[1]!)) {
    const declared = params.find((p) => p.in === 'path' && p.name === name)
    if (!declared) add('path-params', `path parameter ${name} is not declared`)
    else if (declared.required !== true || !isObject(declared.schema)) add('path-params', `path parameter ${name} needs required: true and a schema`)
  }
  for (const p of params) {
    if (p.in === 'query' && !isObject(p.schema)) add('query-params', `query parameter ${String(p.name)} has no schema`)
  }

  if (BODY_METHODS.has(method)) {
    const body = op.requestBody
    if (op['x-no-body'] === true) {
      if (body !== undefined) add('request-body', 'x-no-body is declared, so remove the requestBody')
    } else if (!isObject(body) || !contentDescribes(body.content)) {
      add('request-body', 'missing request body schema (endpoints without a body declare "x-no-body": true)')
    }
  }

  const responses = isObject(op.responses) ? op.responses : {}
  const ok = Object.entries(responses).filter(([code]) => /^2\d\d$/.test(code))
  if (ok.length === 0) add('response', 'missing success response (2xx)')
  else if (!ok.some(([code, r]) => code === '204' || (isObject(r) && contentDescribes(r.content)))) {
    add('response', 'the success response does not describe its body (content.schema)')
  }
  if (Array.isArray(op.security) && op.security.length > 0 && !('401' in responses)) add('error-responses', 'endpoints that need sign-in must list 401')
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
    if (/\{[^}]*:[^}]*\}/.test(path)) issues.push({ rule: 'path-key', operation: path, message: 'path parameters take no type prefix; write {x} (named like the route parameter)' })
    if (!isObject(entry)) continue
    for (const key of Object.keys(entry)) {
      if (key !== key.toLowerCase() && (METHODS as readonly string[]).includes(key.toLowerCase())) {
        issues.push({ rule: 'method-case', operation: `${key} ${path}`, message: 'method names must be lowercase' })
      }
    }
  }
  for (const [shape, keys] of shapes) {
    if (keys.length > 1) issues.push({ rule: 'path-key', operation: shape, message: `the same path is written more than once: ${keys.join(', ')}` })
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
        issues.push({ rule: 'missing', operation: `${upper} ${path}`, message: 'endpoint is not documented (path parameters must match the route parameter names; methods lowercase)' })
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
        issues.push({ rule: 'stale', operation: `${key.toUpperCase()} ${path}`, message: 'documented but no such route: remove it or change it to the actual path' })
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
