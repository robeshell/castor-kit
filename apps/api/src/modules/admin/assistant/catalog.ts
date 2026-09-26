/**
 * The AI assistant's view of the API: every route actually registered under /api/admin (app.routeTable), described
 * with what the OpenAPI document knows about it (summary, tags, parameters, body fields). The document is bundled at
 * build time, so this works in production too, where docs/ isn't shipped.
 *
 * Routes the assistant must never call are left out here and refused again when a call is made (see isAllowed).
 */

import openapi from '../../../../../../docs/apifox-full.openapi.json'
import { API_TOKEN_DENIED } from '@/common/api-token'

export interface ApiEntry {
  method: string
  /** OpenAPI-style path, e.g. /api/admin/users/{user_id} */
  path: string
  summary: string
  description: string
  tags: string[]
  query: string[]
  body: string[]
  /** Matches concrete paths (parameters filled in) */
  pattern: RegExp
}

interface OpenApiOperation {
  summary?: string
  description?: string
  tags?: string[]
  parameters?: Array<{ name?: string; in?: string }>
  requestBody?: { content?: Record<string, { schema?: { properties?: Record<string, { type?: unknown; description?: string }>; required?: string[] } }> }
}

const paths = (openapi as { paths: Record<string, Record<string, OpenApiOperation>> }).paths

/** Paths the assistant never touches (on top of API_TOKEN_DENIED): itself, other AI endpoints, binary / multipart ones */
const ASSISTANT_DENIED: Array<[string, RegExp]> = [
  ['*', /^\/api\/admin\/assistant(\/|$)/],
  ['*', /^\/api\/admin\/component-center\/ai\//],
  ['*', /^\/api\/admin\/modeler(\/|$)/],
  ['*', /\/(import|export|template)$/],
  ['POST', /^\/api\/admin\/files$/],
  ['*', /^\/api\/admin\/files\/[^/]+\/(content|download)$/],
]

/** Whether the assistant may call this method + concrete path at all (permissions are still checked by the route) */
export function isAllowed(method: string, path: string): boolean {
  const denied = (list: Array<[string, RegExp]>) => list.some(([m, re]) => (m === '*' || m === method) && re.test(path))
  return path.startsWith('/api/admin/') && !denied(API_TOKEN_DENIED) && !denied(ASSISTANT_DENIED)
}

/** Route URL (:id(^\d+$)) or OpenAPI path ({id}, {int:id}) → a key with the parameters blanked */
const shapeOf = (path: string) => path.replace(/:[^/]+/g, '{}').replace(/\{[^}]+\}/g, '{}')

function describe(op: OpenApiOperation | undefined) {
  const query = (op?.parameters ?? []).filter((p) => p.in === 'query' && p.name).map((p) => p.name!)
  const schema = Object.values(op?.requestBody?.content ?? {})[0]?.schema
  const required = new Set(schema?.required ?? [])
  const body = Object.entries(schema?.properties ?? {}).map(([name, prop]) => {
    const type = Array.isArray(prop.type) ? prop.type.join('|') : String(prop.type ?? 'any')
    return `${name}${required.has(name) ? '*' : ''}: ${type}`
  })
  return { summary: op?.summary ?? '', description: (op?.description ?? '').slice(0, 240), tags: op?.tags ?? [], query, body }
}

/** Catalog of the callable routes */
export function buildCatalog(routes: Array<{ method: string; url: string }>): ApiEntry[] {
  const docs = new Map<string, { path: string; op: OpenApiOperation }>()
  for (const [path, ops] of Object.entries(paths)) {
    for (const [method, op] of Object.entries(ops)) docs.set(`${method.toUpperCase()} ${shapeOf(path)}`, { path, op })
  }
  const seen = new Set<string>()
  const out: ApiEntry[] = []
  for (const route of routes) {
    const method = route.method.toUpperCase()
    if (method === 'HEAD' || method === 'OPTIONS' || !route.url.startsWith('/api/admin/')) continue
    const key = `${method} ${shapeOf(route.url)}`
    if (seen.has(key)) continue
    seen.add(key)
    const sample = route.url.replace(/:[^/]+/g, '1')
    if (!isAllowed(method, sample)) continue
    const doc = docs.get(key)
    const names = [...route.url.matchAll(/:([A-Za-z_]\w*)/g)].map((m) => m[1]!)
    let i = 0
    const path = route.url.replace(/:[^/]+/g, () => `{${names[i++] ?? 'id'}}`)
    const pattern = new RegExp(`^${route.url.split(/:[^/]+/).map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[^/]+')}$`)
    out.push({ method, path, pattern, ...describe(doc?.op) })
  }
  return out
}

/** The route a concrete call targets, or undefined */
export function findEntry(catalog: ApiEntry[], method: string, path: string): ApiEntry | undefined {
  return catalog.find((e) => e.method === method && e.pattern.test(path))
}

const CJK = /[\u3400-\u9fff]/

/** Search terms: words, plus two-character pieces of Chinese runs (「新增用户」 also finds 「用户」) */
function termsOf(query: string): string[] {
  const words = query
    .toLowerCase()
    .split(/[\s,，、。;；:：/?？()（）"'`]+/)
    .filter(Boolean)
  const terms = new Set(words)
  for (const word of words) {
    if (!CJK.test(word) || word.length <= 2) continue
    for (let i = 0; i < word.length - 1; i++) terms.add(word.slice(i, i + 2))
  }
  return [...terms]
}

/** The best matching routes for a query (method, path, what it's for, parameters) */
export function searchCatalog(catalog: ApiEntry[], query: string, limit = 12) {
  const terms = termsOf(query)
  const scored = catalog
    .map((entry) => {
      const text = `${entry.method} ${entry.path} ${entry.summary} ${entry.tags.join(' ')} ${entry.description}`.toLowerCase()
      const score = terms.reduce((sum, term) => sum + (text.includes(term) ? (term.length > 2 ? 2 : 1) : 0), 0)
      return { entry, score }
    })
    .filter((s) => terms.length === 0 || s.score > 0)
    .sort((a, b) => b.score - a.score || a.entry.path.length - b.entry.path.length)
    .slice(0, limit)
  return scored.map(({ entry }) => ({
    method: entry.method,
    path: entry.path,
    summary: entry.summary,
    ...(entry.tags.length ? { module: entry.tags.join(' / ') } : {}),
    ...(entry.description ? { description: entry.description } : {}),
    ...(entry.query.length ? { query: entry.query } : {}),
    ...(entry.body.length ? { body: entry.body } : {}),
  }))
}
