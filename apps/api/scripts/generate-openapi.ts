/**
 * Fill in OpenAPI paths from Fastify routes and merge them into docs/apifox-full.openapi.json
 *
 * - Keeps the detailed path definitions already in the document; only adds basic entries (generic responses) for missing /api routes.
 * - Added entries are "stubs" (generic responses only, no requestBody/parameters/content);
 *   coverage stats distinguish detailed paths vs stub paths so stubs don't inflate coverage.
 * - Usage:
 *     pnpm openapi:generate              # fill in and write back
 *     pnpm openapi:generate -- --dry-run # stats only, no write-back
 *     pnpm openapi:generate -- --strict  # exit non-zero if any stub paths exist
 *
 * Route source: subscribe to Fastify's `fastify.initialization` diagnostics channel, attach an onRoute hook after the
 * instance is created and before any route is registered, then run buildApp() once to collect all routes (no listening, no DB connection).
 *
 * Path and merge rules:
 * - Path params are converted to standard OpenAPI form: `:user_id(^\d+$)` → `{user_id}`, wildcard `*` → `{path}`.
 *   The document also has legacy keys like `{int:user_id}` / `{path:filename}` (some duplicate hand-maintained detailed `{user_id}` entries);
 *   "is the path already in the document" compares by param position (ignoring param names and converter prefixes), so legacy `{int:x}` entries still count as covered and no third copy is added.
 * - All methods of the same path are merged before generating the stub (e.g. PUT and DELETE of announcements/:id are recorded together).
 * - Write-back preserves the document's original key order (including integer-like keys such as "201" before "200"), with output formatted like Python `json.dumps(indent=2, ensure_ascii=False)`, byte-for-byte stable.
 */

import diagnostics from 'node:diagnostics_channel'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../src/app'
import { loadConfig, loadEnvFiles, type AppConfig, type AppEnv } from '../src/config'
import { dumpIndented, parseOrderedJson, toOrdered, type OrderedJson } from './lib/ordered-json'

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
export const DOC_PATH = resolve(REPO_ROOT, 'docs/apifox-full.openapi.json')

// Methods to skip
const SKIP_METHODS = new Set(['HEAD', 'OPTIONS', 'TRACE'])

const STUB_RESPONSES: Array<[string, string]> = [
  ['200', '成功'],
  ['400', '请求参数错误'],
  ['401', '未授权'],
  ['403', '无权限'],
  ['404', '资源不存在'],
  ['500', '服务器内部错误'],
]

// ---------------------------------------------------------------------------
// Route collection
// ---------------------------------------------------------------------------

/** Convert Fastify routes `/users/:user_id(^\d+$)`, `/file/*` to OpenAPI `/users/{user_id}`, `/file/{path}` */
export function fastifyPathToOpenApi(url: string): string {
  return url
    .replace(/:([A-Za-z_][A-Za-z0-9_]*)(\((?:[^()]|\([^()]*\))*\))?/g, '{$1}')
    .replace(/\*$/, '{path}')
}

/** Path shape: param names/converters are ignored in comparison (`{int:item_id}` and `{item_id}` are treated as the same path) */
export function pathShape(path: string): string {
  return path.replace(/\{[^}]*\}/g, '{}')
}

/** Collect all /api routes: OpenAPI path → sorted method list (HEAD/OPTIONS/TRACE removed) */
export async function collectApiRoutes(config: AppConfig): Promise<Map<string, string[]>> {
  const collected = new Map<string, Set<string>>()
  const channel = diagnostics.channel('fastify.initialization')
  const onInit = (message: unknown) => {
    const { fastify } = message as { fastify: FastifyInstance }
    fastify.addHook('onRoute', (route) => {
      const url = route.url ?? route.path
      if (!url.startsWith('/api/')) return
      const path = fastifyPathToOpenApi(url)
      const methods = collected.get(path) ?? new Set<string>()
      for (const method of Array.isArray(route.method) ? route.method : [route.method]) {
        const upper = String(method).toUpperCase()
        if (!SKIP_METHODS.has(upper)) methods.add(upper)
      }
      collected.set(path, methods)
    })
  }
  channel.subscribe(onInit)
  let app: FastifyInstance | undefined
  try {
    app = await buildApp({ config })
    await app.ready()
  } finally {
    channel.unsubscribe(onInit)
    await app?.close()
  }

  const result = new Map<string, string[]>()
  for (const path of [...collected.keys()].sort()) {
    const methods = [...collected.get(path)!].sort()
    if (methods.length > 0) result.set(path, methods)
  }
  return result
}

// ---------------------------------------------------------------------------
// Stub detection / stats (same rules as verify_feature._openapi_is_stub_path)
// ---------------------------------------------------------------------------

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** Python truthiness: None / False / 0 / '' / empty containers are falsy */
function pyTruthy(v: unknown): boolean {
  if (v === null || v === undefined || v === false || v === 0 || v === '') return false
  if (Array.isArray(v)) return v.length > 0
  if (isObject(v)) return Object.keys(v).length > 0
  return true
}

/** Stub path: every method has only generic responses, no requestBody/parameters/content */
export function isStubEntry(entry: unknown): boolean {
  if (!isObject(entry)) return true
  for (const op of Object.values(entry)) {
    if (!isObject(op)) continue
    if (pyTruthy(op.requestBody) || pyTruthy(op.parameters)) return false
    const responses = pyTruthy(op.responses) && isObject(op.responses) ? op.responses : {}
    for (const resp of Object.values(responses)) {
      if (isObject(resp) && pyTruthy(resp.content)) return false
    }
  }
  return true
}

export interface PathStats {
  total: number
  detailed: number
  stubs: number
}

export function pathStats(paths: Record<string, unknown>): PathStats {
  const entries = Object.values(paths)
  const stubs = entries.filter((entry) => isStubEntry(entry)).length
  return { total: entries.length, detailed: entries.length - stubs, stubs }
}

/** Python `f'{x:.0f}'`：round-half-even */
function formatPercent0(value: number): string {
  const floor = Math.floor(value)
  const diff = value - floor
  if (diff === 0.5) return String(floor % 2 === 0 ? floor : floor + 1)
  return value.toFixed(0)
}

export function buildStubEntry(path: string, methods: string[]): Record<string, unknown> {
  const entry: Record<string, unknown> = {}
  for (const method of methods) {
    entry[method] = {
      summary: `${method} ${path}`,
      responses: Object.fromEntries(STUB_RESPONSES.map(([code, description]) => [code, { description }])),
    }
  }
  return entry
}

/** Find routes missing from the document (compared by path shape) */
export function findMissingRoutes(
  docPaths: Record<string, unknown>,
  routes: Map<string, string[]>,
): Array<[string, string[]]> {
  const shapes = new Set(Object.keys(docPaths).map(pathShape))
  const missing: Array<[string, string[]]> = []
  for (const [path, methods] of routes) {
    if (shapes.has(pathShape(path))) continue
    missing.push([path, methods])
    shapes.add(pathShape(path))
  }
  return missing
}

// ---------------------------------------------------------------------------
// Main flow
// ---------------------------------------------------------------------------

export interface GenerateOptions {
  config: AppConfig
  docPath?: string
  dryRun?: boolean
  strict?: boolean
  log?: (msg: string) => void
}

export interface GenerateResult {
  exitCode: number
  routeCount: number
  added: Array<[string, string[]]>
  stats: PathStats
}

export async function generateOpenApi(options: GenerateOptions): Promise<GenerateResult> {
  const log = options.log ?? console.log
  const docPath = options.docPath ?? DOC_PATH
  const text = readFileSync(docPath, 'utf8')
  const doc = JSON.parse(text) as Record<string, unknown>
  const paths = (isObject(doc.paths) ? doc.paths : {}) as Record<string, unknown>

  const routes = await collectApiRoutes(options.config)
  const added = findMissingRoutes(paths, routes)
  for (const [path, methods] of added) paths[path] = buildStubEntry(path, methods)

  const stats = pathStats(paths)
  log(`收集到 /api 路由 ${routes.size} 条`)
  for (const [path, methods] of added) log(`  + ${methods.join(',')} ${path}`)
  log(`补齐 ${added.length} 个路径（均为骨架，需人工补 schema）`)
  const percent = stats.total ? formatPercent0((stats.detailed / stats.total) * 100) : '0'
  log(`文档路径统计：总数 ${stats.total}，详细 ${stats.detailed}（${percent}%），骨架 ${stats.stubs}`)

  if (!options.dryRun) {
    const ordered = parseOrderedJson(text)
    if (!(ordered instanceof Map)) throw new Error('OpenAPI 文档根节点必须是对象')
    const orderedPaths = ordered.get('paths') instanceof Map ? (ordered.get('paths') as Map<string, OrderedJson>) : new Map()
    for (const [path, methods] of added) orderedPaths.set(path, toOrdered(buildStubEntry(path, methods)))
    ordered.set('paths', new Map([...orderedPaths].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))))
    writeFileSync(docPath, dumpIndented(ordered), 'utf8')
    log(`已写回 ${relative(REPO_ROOT, docPath)}`)
  }

  let exitCode = 0
  if (options.strict && stats.stubs) {
    log(`❌ --strict：仍有 ${stats.stubs} 个骨架路径，请补充 schema 后再提交`)
    exitCode = 1
  }
  return { exitCode, routeCount: routes.size, added, stats }
}

const isMain = /[\\/]generate-openapi\.(?:ts|js|mjs)$/.test(process.argv[1] ?? '')
if (isMain) {
  let values: { 'dry-run': boolean; strict: boolean }
  try {
    values = parseArgs({
      args: process.argv.slice(2).filter((arg) => arg !== '--'),
      options: { 'dry-run': { type: 'boolean', default: false }, strict: { type: 'boolean', default: false } },
    }).values
  } catch (err) {
    console.error('usage: generate-openapi [--dry-run] [--strict]')
    console.error(`generate-openapi: error: ${err instanceof Error ? err.message : String(err)}`)
    process.exit(2)
  }
  const env = (process.env.NODE_ENV ?? 'development') as AppEnv
  loadEnvFiles(env)
  // Only collect routes; no DB connection, no scheduler
  const config = { ...loadConfig(), enableTaskScheduler: false, runSchedulerInWeb: false }
  generateOpenApi({ config, dryRun: values['dry-run'], strict: values.strict })
    .then((result) => process.exit(result.exitCode))
    .catch((err: unknown) => {
      console.error(err)
      process.exit(1)
    })
}
