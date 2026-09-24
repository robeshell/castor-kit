/**
 * 从 Fastify 路由补齐 OpenAPI paths，合并到 docs/apifox-full.openapi.json（对齐 AuraStack backend/scripts/generate_openapi.py）
 *
 * - 保留文档中已有的详细路径定义，只为缺失的 /api 路由补上基础条目（通用响应）。
 * - 补出的条目是「骨架」（仅通用 responses、无 requestBody/parameters/content），
 *   覆盖率统计会区分 详细路径 vs 骨架路径，避免骨架虚高覆盖率。
 * - 用法：
 *     pnpm openapi:generate              # 补齐并写回
 *     pnpm openapi:generate -- --dry-run # 只统计，不写回
 *     pnpm openapi:generate -- --strict  # 存在骨架路径则退出非 0
 *
 * 路由来源：订阅 Fastify 的 `fastify.initialization` diagnostics channel，在实例创建后、任何路由注册前
 * 挂 onRoute 钩子，再跑一遍 buildApp() 收集全部路由（不启动监听、不连库）。
 *
 * 与 Python 的差异（均为修正 Python 的缺陷，结果更准确）：
 * - 路径参数转成标准 OpenAPI 形式：`:user_id(^\d+$)` → `{user_id}`，通配 `*` → `{path}`。
 *   Python 的 `rule.replace('<','{')` 实际产出 `{int:user_id}` / `{path:filename}`（文档里现存的 32 条这类 key
 *   就是它补出的骨架，其中 19 条与人工维护的 `{user_id}` 详细条目重复）。
 *   “路径是否已在文档里”按参数位置比较（忽略参数名与转换器前缀），因此历史的 `{int:x}` 条目仍算已覆盖，不会再补第三份。
 * - 同一路径的所有方法合并后再生成骨架。Python 按 Flask Rule 逐条处理、路径已存在即跳过，
 *   同一路径拆成两个 Rule（如 announcements/<id> 的 PUT 与 DELETE）时只记下第一个 Rule 的方法。
 * - 写回时保持文档原有键顺序（含 "201" 在 "200" 前这类整数形键），输出与 Python `json.dumps(indent=2, ensure_ascii=False)` 逐字节一致。
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

// 跳过的方法
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
// 路由收集
// ---------------------------------------------------------------------------

/** 把 Fastify 路由 `/users/:user_id(^\d+$)`、`/file/*` 转成 OpenAPI `/users/{user_id}`、`/file/{path}` */
export function fastifyPathToOpenApi(url: string): string {
  return url
    .replace(/:([A-Za-z_][A-Za-z0-9_]*)(\((?:[^()]|\([^()]*\))*\))?/g, '{$1}')
    .replace(/\*$/, '{path}')
}

/** 路径形状：参数名/转换器不参与比较（`{int:item_id}`、`{item_id}` 视为同一路径） */
export function pathShape(path: string): string {
  return path.replace(/\{[^}]*\}/g, '{}')
}

/** 收集全部 /api 路由：OpenAPI 路径 → 排序后的方法列表（已去掉 HEAD/OPTIONS/TRACE） */
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
// 骨架识别 / 统计（与 verify_feature._openapi_is_stub_path 同规则）
// ---------------------------------------------------------------------------

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** Python 真值：None / False / 0 / '' / 空容器为假 */
function pyTruthy(v: unknown): boolean {
  if (v === null || v === undefined || v === false || v === 0 || v === '') return false
  if (Array.isArray(v)) return v.length > 0
  if (isObject(v)) return Object.keys(v).length > 0
  return true
}

/** 骨架路径：所有 method 都只有通用 responses，无 requestBody/parameters/content */
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

/** 找出文档里没有的路由（按路径形状比较） */
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
// 主流程
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
  // 只收集路由，不连库、不启调度
  const config = { ...loadConfig(), enableTaskScheduler: false, runSchedulerInWeb: false }
  generateOpenApi({ config, dryRun: values['dry-run'], strict: values.strict })
    .then((result) => process.exit(result.exitCode))
    .catch((err: unknown) => {
      console.error(err)
      process.exit(1)
    })
}
