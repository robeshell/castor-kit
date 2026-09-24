/**
 * castor-kit 功能验证门禁（对齐 AuraStack backend/scripts/verify_feature.py）
 *
 * 用法：
 *   pnpm verify -- --module customer
 *   pnpm verify -- --module customer --skip-build
 *   pnpm verify -- --module customer --json   # 输出结构化 JSON（供 AI/MCP 读取；stdout 只有 JSON）
 *
 * 检查项：
 *   1. TypeScript 类型检查（tsc --noEmit：apps/api 全量含 scripts/test，以及 apps/mcp）
 *   2. routes 层不允许自定义 hasPermission（必须用 common/auth）
 *   3. 迁移链完整（drizzle journal 线性、snapshot prevId 成链、每条都有 SQL、无游离 SQL）
 *   4. 迁移已真实落库（journal 与 drizzle.__drizzle_migrations 比对；模块表用 to_regclass 确认存在）
 *   5. OpenAPI 文档同步（告警，调用 scripts/generate-openapi.ts --dry-run）
 *   6. AI 上下文文档引用的路径存在（告警；--strict-docs 时阻断）
 *   7. 后端 routes/repository/service 文件存在
 *   8. 前端页面文件存在
 *   9. 前端 API 文件存在
 *  10. 路由注册（src/router.ts / modules/<domain>/router.ts）
 *  11. 表定义注册（db/schema/index.ts）
 *  12. RBAC 种子（scripts/seed-rbac.ts）包含菜单 component 或权限编码
 *  13. 前端构建通过（可选，--skip-build 跳过）
 *  14. 前端 Vitest 通过（可选，--skip-frontend-tests 跳过）
 *
 * JSON 输出结构与 Python 版一致：{ passed, module, checks: [{ name, passed, error?, skipped?, warn?, detail? }], summary }
 */

import { spawnSync, type SpawnSyncOptions } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import { printUsage } from './lib/usage'
import { readMigrationFiles } from 'drizzle-orm/migrator'
import pg from 'pg'

const DEFAULT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')

export interface CheckResult {
  name: string
  passed: boolean
  error?: string | null
  skipped?: boolean
  warn?: boolean
  detail?: string
  [extra: string]: unknown
}

export interface VerifyContext {
  root: string
  apiDir: string
  srcDir: string
  webDir: string
}

export function makeContext(root: string = DEFAULT_ROOT): VerifyContext {
  const r = resolve(root)
  const apiDir = join(r, 'apps', 'api')
  return { root: r, apiDir, srcDir: join(apiDir, 'src'), webDir: join(r, 'apps', 'web') }
}

// ─── 工具 ──────────────────────────────────────────────────────────────────────

export function run(cmd: string[], cwd: string, timeoutMs = 600_000): { code: number; output: string } {
  const opts: SpawnSyncOptions = { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: timeoutMs, env: process.env }
  const res = spawnSync(cmd[0]!, cmd.slice(1), opts)
  const output = `${res.stdout ?? ''}${res.stderr ?? ''}`
  if (res.error) return { code: 1, output: `${output}${res.error.message}` }
  return { code: res.status ?? 1, output }
}

/** 优先用包内 node_modules/.bin，找不到退回 npx */
function bin(pkgDir: string, name: string): string[] {
  const local = join(pkgDir, 'node_modules', '.bin', name)
  return existsSync(local) ? [local] : ['npx', name]
}

function rel(ctx: VerifyContext, path: string): string {
  return relative(ctx.root, path)
}

function walk(dir: string, filter: (path: string) => boolean, out: string[] = []): string[] {
  if (!existsSync(dir)) return out
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git') continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) walk(full, filter, out)
    else if (filter(full)) out.push(full)
  }
  return out.sort()
}

export function singularOf(module: string): string {
  return module.endsWith('s') ? module.slice(0, -1) : module
}

const toKebab = (name: string) => name.replace(/_/g, '-')
const toPascal = (name: string) =>
  name
    .split(/[_-]/)
    .map((w) => (w ? w[0]!.toUpperCase() + w.slice(1).toLowerCase() : ''))
    .join('')

/** 模块名的候选写法：customer / customers / customer_page / list_page → list */
export function moduleCandidates(module: string): string[] {
  const singular = singularOf(module)
  const names = [module, singular, `${module}_page`, `${singular}_page`]
  if (module.endsWith('_page')) names.push(module.slice(0, -'_page'.length))
  return [...new Set(names)]
}

const BACKEND_DOMAINS = ['admin', 'component-center']
const WEB_MODULES = ['admin', 'component_center']

// ─── 单项检查 ──────────────────────────────────────────────────────────────────

/** TypeScript 类型检查（apps/api 全量 + apps/mcp） */
export function checkTypescript(ctx: VerifyContext): CheckResult {
  const errors: string[] = []
  for (const pkg of [ctx.apiDir, join(ctx.root, 'apps', 'mcp')]) {
    if (!existsSync(join(pkg, 'tsconfig.json'))) continue
    const { code, output } = run([...bin(pkg, 'tsc'), '--noEmit', '-p', 'tsconfig.json'], pkg)
    if (code !== 0) errors.push(`[${rel(ctx, pkg)}]\n${output.trim()}`)
  }
  if (errors.length > 0) return { name: 'typescript_compile', passed: false, error: errors.join('\n').slice(0, 2000) }
  return { name: 'typescript_compile', passed: true }
}

/** routes 层不允许自定义 hasPermission / hasMenuPermission（必须 import 自 common/auth） */
export function checkNoLocalHasPermission(ctx: VerifyContext): CheckResult {
  const modulesDir = join(ctx.srcDir, 'modules')
  const re = /(function\s+has(Menu)?Permission\s*[(<])|((const|let|var)\s+has(Menu)?Permission\s*[=:])/
  const offenders = walk(modulesDir, (p) => p.endsWith('.ts'))
    .filter((p) => re.test(readFileSync(p, 'utf8')))
    .map((p) => rel(ctx, p))
  if (offenders.length > 0) {
    return {
      name: 'no_local_has_permission',
      passed: false,
      error: `以下文件含有非法的 hasPermission 定义（应使用 src/common/auth.ts）：${JSON.stringify(offenders)}`,
    }
  }
  return { name: 'no_local_has_permission', passed: true }
}

interface JournalEntry {
  idx: number
  when: number
  tag: string
}

/**
 * 迁移链完整性：journal 的 idx 连续、when 严格递增、tag 唯一；每条有 SQL 与 snapshot；
 * snapshot 的 prevId 首尾相接（等价 Alembic 的单根线性、无分叉）；drizzle/ 下没有游离（手写）SQL。
 */
export function checkMigrationChain(ctx: VerifyContext): CheckResult {
  const dir = join(ctx.apiDir, 'drizzle')
  const journalPath = join(dir, 'meta', '_journal.json')
  if (!existsSync(journalPath)) return { name: 'migration_chain', passed: true, skipped: true }

  let entries: JournalEntry[]
  try {
    entries = (JSON.parse(readFileSync(journalPath, 'utf8')) as { entries?: JournalEntry[] }).entries ?? []
  } catch (err) {
    return { name: 'migration_chain', passed: false, error: `_journal.json 解析失败：${(err as Error).message}` }
  }
  if (entries.length === 0) return { name: 'migration_chain', passed: true, skipped: true }

  const details: string[] = []
  const tags = new Set<string>()
  let prevSnapshotId: string | null = null
  entries.forEach((e, i) => {
    if (e.idx !== i) details.push(`第 ${i} 条的 idx=${e.idx}（应为 ${i}，journal 顺序被打乱或有缺号）`)
    if (i > 0 && !(e.when > entries[i - 1]!.when)) {
      details.push(`${e.tag} 的 when 不大于上一条（迁移器按时间戳判断是否已执行，会被跳过）`)
    }
    if (tags.has(e.tag)) details.push(`tag 重复：${e.tag}`)
    tags.add(e.tag)
    if (!existsSync(join(dir, `${e.tag}.sql`))) details.push(`缺少 SQL 文件：drizzle/${e.tag}.sql`)

    const snapshotPath = join(dir, 'meta', `${String(e.idx).padStart(4, '0')}_snapshot.json`)
    if (!existsSync(snapshotPath)) {
      details.push(`缺少 snapshot：drizzle/meta/${String(e.idx).padStart(4, '0')}_snapshot.json`)
      prevSnapshotId = null
      return
    }
    try {
      const snap = JSON.parse(readFileSync(snapshotPath, 'utf8')) as { id?: string; prevId?: string }
      if (i > 0 && prevSnapshotId && snap.prevId !== prevSnapshotId) {
        details.push(`${e.tag} 的 snapshot.prevId 不指向上一条（存在分叉：多个迁移基于同一祖先生成）`)
      }
      prevSnapshotId = snap.id ?? null
    } catch {
      details.push(`snapshot 解析失败：${e.tag}`)
      prevSnapshotId = null
    }
  })

  const orphans = readdirSync(dir)
    .filter((f) => f.endsWith('.sql') && !tags.has(f.slice(0, -4)))
    .sort()
  if (orphans.length > 0) {
    details.push(`drizzle/ 下有未登记到 journal 的 SQL（手写迁移会破坏 journal 链，请用 drizzle-kit generate）：${JSON.stringify(orphans)}`)
  }

  if (details.length > 0) return { name: 'migration_chain', passed: false, error: `迁移链异常：${details.join('；')}` }
  return { name: 'migration_chain', passed: true, head: entries[entries.length - 1]!.tag }
}

/** 从 schema 文件里找出模块相关的表名（pgTable('xxx')） */
export function findModuleTables(ctx: VerifyContext, module: string): { file: string; tables: string[] } | null {
  const schemaDir = join(ctx.srcDir, 'db', 'schema')
  const files = walk(schemaDir, (p) => p.endsWith('.ts') && !p.endsWith('index.ts'))
  const names = moduleCandidates(module)
  const kebabs = new Set(names.map(toKebab))
  const tableNames = new Set(names.flatMap((n) => [n, `${n}s`]))

  // 1) 同名 schema 文件（scaffold 生成的布局）
  const byFile = files.find((f) => kebabs.has(f.slice(f.lastIndexOf('/') + 1, -3)))
  // 2) 任意 schema 文件里定义了同名表
  const byTable = files.find((f) => {
    for (const m of readFileSync(f, 'utf8').matchAll(/pgTable\(\s*['"]([^'"]+)['"]/g)) if (tableNames.has(m[1]!)) return true
    return false
  })
  const file = byFile ?? byTable
  if (!file) return null
  const tables = [...readFileSync(file, 'utf8').matchAll(/pgTable\(\s*['"]([^'"]+)['"]/g)].map((m) => m[1]!)
  return { file, tables }
}

/** 迁移已真实落库：journal 的每条迁移（按 SQL 内容 hash）都在 drizzle.__drizzle_migrations；模块表真实存在 */
export async function checkMigrationApplied(
  ctx: VerifyContext,
  module: string | undefined,
  databaseUrl: string | null,
): Promise<CheckResult> {
  const name = 'migration_applied'
  const folder = join(ctx.apiDir, 'drizzle')
  if (!existsSync(join(folder, 'meta', '_journal.json'))) return { name, passed: true, skipped: true }
  if (!databaseUrl) return { name, passed: false, error: '未配置数据库连接（DEV_DATABASE_URL / DATABASE_URL / TEST_DATABASE_URL），无法确认迁移是否落库' }

  let migrations
  try {
    migrations = readMigrationFiles({ migrationsFolder: folder })
  } catch (err) {
    return { name, passed: false, error: `读取迁移文件失败：${(err as Error).message}` }
  }
  const journal = (JSON.parse(readFileSync(join(folder, 'meta', '_journal.json'), 'utf8')) as { entries: JournalEntry[] }).entries
  const database = databaseUrl.replace(/^.*\//, '').replace(/\?.*$/, '')

  const pool = new pg.Pool({ connectionString: databaseUrl, max: 1, connectionTimeoutMillis: 5000 })
  try {
    const { rows: reg } = await pool.query<{ t: string | null }>(`SELECT to_regclass('drizzle.__drizzle_migrations')::text AS t`)
    if (!reg[0]?.t) {
      return { name, passed: false, error: `数据库 ${database} 尚未执行任何迁移（drizzle.__drizzle_migrations 不存在），请运行 pnpm db:migrate` }
    }
    const { rows } = await pool.query<{ hash: string }>('SELECT hash FROM drizzle.__drizzle_migrations')
    const applied = new Set(rows.map((r) => r.hash))
    const pending = migrations.map((m, i) => ({ m, tag: journal[i]?.tag ?? `#${i}` })).filter(({ m }) => !applied.has(m.hash))
    if (pending.length > 0) {
      return {
        name,
        passed: false,
        error:
          `以下迁移尚未落库到 ${database}（或 SQL 在落库后被修改）：${pending.map((p) => p.tag).join(', ')}；` +
          '请运行 pnpm db:migrate，并用 psql \\d <table> 确认',
      }
    }

    const result: CheckResult = { name, passed: true, head: journal[journal.length - 1]?.tag, database }
    if (module) {
      const found = findModuleTables(ctx, module)
      if (found && found.tables.length > 0) {
        const missing: string[] = []
        for (const table of found.tables) {
          const { rows: r } = await pool.query<{ t: string | null }>('SELECT to_regclass($1)::text AS t', [`public.${table}`])
          if (!r[0]?.t) missing.push(table)
        }
        if (missing.length > 0) {
          return { name, passed: false, error: `数据库 ${database} 中不存在表：${missing.join(', ')}（schema 已定义但没有生成/执行迁移）` }
        }
        result.tables = found.tables
      }
    }
    result.detail = `已迁移至 ${result.head}（${database}）`
    return result
  } catch (err) {
    return { name, passed: false, error: `连接数据库 ${database} 失败：${(err as Error).message}` }
  } finally {
    await pool.end().catch(() => {})
  }
}

/**
 * OpenAPI 文档同步度（告警性质，不阻断门禁）：调用 generate-openapi.ts --dry-run（只统计不写回），
 * 有未入文档的路由、或详细路径覆盖率 < 80%（骨架路径不计入，与 Python 同一口径）时告警。
 */
export function checkOpenapiSync(ctx: VerifyContext): CheckResult {
  const name = 'openapi_sync'
  const script = join(ctx.apiDir, 'scripts', 'generate-openapi.ts')
  const docPath = join(ctx.root, 'docs', 'apifox-full.openapi.json')
  if (!existsSync(script) || !existsSync(docPath)) return { name, passed: true, skipped: true }

  const { code, output } = run([...bin(ctx.apiDir, 'tsx'), 'scripts/generate-openapi.ts', '--dry-run'], ctx.apiDir, 180_000)
  if (code !== 0) {
    return { name, passed: true, warn: true, detail: `OpenAPI 生成脚本执行失败：${output.trim().slice(-500)}` }
  }
  const routes = Number(/收集到 \/api 路由 (\d+) 条/.exec(output)?.[1] ?? Number.NaN)
  const added = Number(/补齐 (\d+) 个路径/.exec(output)?.[1] ?? Number.NaN)
  const detailed = Number(/详细 (\d+)/.exec(output)?.[1] ?? Number.NaN)
  if ([routes, added, detailed].some(Number.isNaN)) {
    return { name, passed: true, warn: true, detail: `无法解析 OpenAPI 生成脚本输出：${output.trim().slice(-300)}` }
  }
  if (added > 0) {
    const lines = output
      .split('\n')
      .filter((l) => /^\s+\+ /.test(l))
      .map((l) => l.trim().slice(2))
    return {
      name,
      passed: true,
      warn: true,
      detail:
        `OpenAPI 文档缺少 ${added} 个路由路径（${lines.slice(0, 10).join('；')}${lines.length > 10 ? '…' : ''}），` +
        '建议运行 pnpm openapi:generate 补齐并补充 schema',
    }
  }
  const ratio = routes ? (detailed / routes) * 100 : 0
  if (ratio < 80) {
    return {
      name,
      passed: true,
      warn: true,
      detail:
        `OpenAPI 详细路径 ${detailed} vs 后端路由 ${routes}（覆盖率 ${Math.round(ratio)}%），` +
        '建议运行 pnpm openapi:generate 补齐并补充 schema',
    }
  }
  return { name, passed: true }
}

/** AI 上下文文档（AGENTS.md / CLAUDE.md / ...）里 `反引号` 或相对链接引用的仓库路径必须存在 */
export function checkDocPaths(ctx: VerifyContext, strict = false): CheckResult {
  const name = 'docs_paths'
  const docs = [
    'AGENTS.md',
    'CLAUDE.md',
    'CODEX.md',
    'README.md',
    'README.en.md',
    'llms.txt',
    '.windsurfrules',
    '.github/copilot-instructions.md',
  ]
    .map((f) => join(ctx.root, f))
    .filter((p) => existsSync(p))
  for (const dir of ['.cursor', '.claude/skills', '.agents']) {
    docs.push(...walk(join(ctx.root, dir), (p) => /\.(md|mdc)$/.test(p)))
  }
  docs.push(...walk(join(ctx.root, 'docs', 'templates'), (p) => p.endsWith('README.md')))
  if (docs.length === 0) return { name, passed: true, skipped: true }

  const bases = [ctx.root, ctx.apiDir, ctx.srcDir, ctx.webDir, join(ctx.webDir, 'src')]
  const topLevel = new Set(bases.flatMap((b) => (existsSync(b) ? readdirSync(b) : [])))
  const missing: string[] = []
  const checked = new Set<string>()

  for (const doc of docs) {
    const text = readFileSync(doc, 'utf8').replace(/```[\s\S]*?```/g, '')
    const refs = [
      ...[...text.matchAll(/`([^`\n]+)`/g)].map((m) => m[1]!.trim()),
      ...[...text.matchAll(/\]\(([^)\s]+)\)/g)].map((m) => m[1]!.trim()),
    ]
    for (const raw of refs) {
      const ref = raw.replace(/#.*$/, '').replace(/^\.\//, '')
      if (!isRepoPathRef(ref, topLevel)) continue
      const key = `${rel(ctx, doc)}: ${ref}`
      if (checked.has(key)) continue
      checked.add(key)
      const docDir = dirname(doc)
      const exists = [...bases, docDir].some((b) => existsSync(join(b, ref)))
      if (!exists) missing.push(key)
    }
  }
  if (missing.length === 0) return { name, passed: true, checked: checked.size }
  const detail = `文档引用的路径不存在（${missing.length} 处）：${missing.slice(0, 20).join('；')}`
  return strict ? { name, passed: false, error: detail } : { name, passed: true, warn: true, detail }
}

const PATH_EXT_RE = /\.(md|mdc|ts|tsx|js|jsx|mjs|cjs|json|ya?ml|sql|sh|txt|toml|css|html|py)$/

export function isRepoPathRef(ref: string, topLevel: Set<string>): boolean {
  if (!ref.includes('/')) return false
  if (/[\s<>*{}$|()=,"'…:;]/.test(ref) || ref.includes('...')) return false
  if (/^(\/|~|@|-|https?:|\.\.\/)/.test(ref)) return false
  const segments = ref.split('/').filter(Boolean)
  const last = segments[segments.length - 1] ?? ''
  if (last.startsWith('.env')) return false
  if (PATH_EXT_RE.test(last) || ref.endsWith('/')) return true
  return topLevel.has(segments[0] ?? '')
}

/** 后端 routes/repository/service 文件存在（modules/<domain>/<name>/） */
export function checkBackendFile(ctx: VerifyContext, module: string): CheckResult {
  const candidates = BACKEND_DOMAINS.flatMap((d) =>
    moduleCandidates(module).map((n) => join(ctx.srcDir, 'modules', d, toKebab(n))),
  )
  const found = candidates.find((dir) => existsSync(join(dir, 'routes.ts')))
  if (!found) {
    return {
      name: 'backend_file',
      passed: false,
      error: `未找到后端 routes.ts，检查路径：${candidates.slice(0, 4).map((d) => rel(ctx, join(d, 'routes.ts'))).join(', ')}`,
    }
  }
  const missing = ['repository.ts', 'service.ts'].filter((f) => !existsSync(join(found, f)))
  if (missing.length > 0) {
    return {
      name: 'backend_file',
      passed: false,
      error: `${rel(ctx, found)} 缺少 ${missing.join(' / ')}（分层：schema → repository → service → routes）`,
    }
  }
  return { name: 'backend_file', passed: true, path: rel(ctx, found) }
}

/** 前端页面 index.jsx 存在 */
export function checkFrontendPage(ctx: VerifyContext, module: string): CheckResult {
  const singular = singularOf(module)
  const names = new Set([module, singular, `${module}_page`, `${singular}_page`])
  for (const m of WEB_MODULES) {
    const base = join(ctx.webDir, 'src', 'modules', m, 'pages')
    const hit = walk(base, (p) => p.endsWith('/index.jsx') || p.endsWith('/index.tsx')).find((p) =>
      names.has(dirname(p).slice(dirname(p).lastIndexOf('/') + 1)),
    )
    if (hit) return { name: 'frontend_page', passed: true, path: rel(ctx, hit) }
  }
  return {
    name: 'frontend_page',
    passed: false,
    error: `未找到前端页面文件 index.jsx，目录名应为 ${module} 或 ${singular} 或 ${module}_page`,
  }
}

/** 前端 API 文件存在 */
export function checkFrontendApi(ctx: VerifyContext, module: string): CheckResult {
  const singular = singularOf(module)
  const api = (m: string, f: string) => join(ctx.webDir, 'src', 'modules', m, 'api', f)
  const candidates = [
    api('admin', `${module}.js`),
    api('admin', `${singular}.js`),
    api('component_center', `${module}.js`),
    api('component_center', `${singular}.js`),
    api('component_center', `${module}_page.js`),
  ]
  const found = candidates.find((p) => existsSync(p))
  if (found) return { name: 'frontend_api', passed: true, path: rel(ctx, found) }
  return {
    name: 'frontend_api',
    passed: false,
    error: `未找到前端 API 文件，检查路径：${candidates.slice(0, 3).map((p) => rel(ctx, p)).join(', ')}`,
  }
}

/** 路由注册：解析 router 文件中真实调用的 registerXxxRoutes(app)，精确匹配 */
export function checkRouterRegistration(ctx: VerifyContext, module: string): CheckResult {
  const routerFiles = [join(ctx.srcDir, 'router.ts'), ...BACKEND_DOMAINS.map((d) => join(ctx.srcDir, 'modules', d, 'router.ts'))]
  const registered = new Set<string>()
  for (const f of routerFiles) {
    if (!existsSync(f)) continue
    for (const m of readFileSync(f, 'utf8').matchAll(/await\s+register([A-Za-z0-9]+)Routes\s*\(/g)) registered.add(m[1]!)
  }
  const wanted = new Set(moduleCandidates(module).map((n) => toPascal(n).toLowerCase()))
  const matched = [...registered].filter((r) => wanted.has(r.toLowerCase())).sort()
  if (matched.length > 0) {
    return { name: 'router_registration', passed: true, registered: matched.map((m) => `register${m}Routes`) }
  }
  const all = [...registered].sort().map((m) => `register${m}Routes`)
  return {
    name: 'router_registration',
    passed: false,
    error:
      `router 中未注册 register${toPascal(module)}Routes / register${toPascal(singularOf(module))}Routes；` +
      `已注册: ${all.length > 0 ? JSON.stringify(all) : '无'}。请在 src/modules/<domain>/router.ts 中调用`,
  }
}

/** 表定义注册：模块的 schema 文件必须从 db/schema/index.ts 导出（drizzle-kit 与 relational query 都从这里读） */
export function checkSchemaRegistration(ctx: VerifyContext, module: string): CheckResult {
  const name = 'schema_registration'
  const found = findModuleTables(ctx, module)
  if (!found) {
    return { name, passed: true, skipped: true, detail: `未找到 ${module} 对应的表定义文件（模块可能没有自己的表），跳过` }
  }
  const indexPath = join(ctx.srcDir, 'db', 'schema', 'index.ts')
  const spec = `./${relative(join(ctx.srcDir, 'db', 'schema'), found.file).replace(/\.ts$/, '')}`
  const index = existsSync(indexPath) ? readFileSync(indexPath, 'utf8') : ''
  const exported = new RegExp(`from\\s+['"]${spec.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\.ts)?['"]`).test(index)
  if (exported) return { name, passed: true, path: rel(ctx, found.file) }
  return {
    name,
    passed: false,
    error: `${rel(ctx, found.file)} 未在 src/db/schema/index.ts 导出，请添加 export * from '${spec}'`,
  }
}

/** RBAC 种子：菜单数据里必须有对应 component 路径或权限编码（精确匹配） */
export function checkRbacSeed(ctx: VerifyContext, module: string): CheckResult {
  const seedFile = join(ctx.apiDir, 'scripts', 'seed-rbac.ts')
  if (!existsSync(seedFile)) return { name: 'rbac_seed', passed: false, error: 'scripts/seed-rbac.ts 不存在' }

  // seed-rbac.ts 及其相对导入的数据文件
  const files = [seedFile]
  for (const m of readFileSync(seedFile, 'utf8').matchAll(/from\s+['"](\.{1,2}\/[^'"]+)['"]/g)) {
    const base = resolve(dirname(seedFile), m[1]!)
    const hit = [base, `${base}.ts`, join(base, 'index.ts')].find((p) => existsSync(p) && statSync(p).isFile())
    if (hit) files.push(hit)
  }
  const text = files.map((f) => readFileSync(f, 'utf8')).join('\n')
  const codes = new Set([...text.matchAll(/\bcode['"]?\s*:\s*['"]([^'"]+)['"]/g)].map((m) => m[1]!))
  const components = new Set([...text.matchAll(/\bcomponent['"]?\s*:\s*['"]([^'"]+)['"]/g)].map((m) => m[1]!))

  const singular = singularOf(module)
  // 组件路径以 /<module> 或 /<module>_page 结尾（如 component_center/ai/ai_sql_page / admin/users）
  const compMatch = [...components].some((c) =>
    [module, `${module}_page`, singular, `${singular}_page`].some((n) => c.endsWith(`/${n}`)),
  )
  const codeMatch = ['cc', 'system'].some((p) => codes.has(`${p}_${module}`) || codes.has(`${p}_${singular}`))
  if (compMatch || codeMatch) return { name: 'rbac_seed', passed: true }
  return {
    name: 'rbac_seed',
    passed: false,
    error:
      `种子数据中未找到 ${module} 的菜单（component 路径或 system_${module} / cc_${module} 权限码），` +
      '请在 scripts/seed-rbac.ts 添加菜单/按钮后运行 pnpm seed:rbac -- --incremental',
  }
}

/** 执行 seed-rbac.ts --incremental */
export function runRbacSync(ctx: VerifyContext): CheckResult {
  const { code, output } = run([...bin(ctx.apiDir, 'tsx'), 'scripts/seed-rbac.ts', '--incremental'], ctx.apiDir)
  return { name: 'rbac_sync', passed: code === 0, error: code !== 0 ? output.trim().slice(0, 500) : null }
}

/** 前端构建（vite build） */
export function checkFrontendBuild(ctx: VerifyContext, skip: boolean): CheckResult {
  if (skip) return { name: 'frontend_build', passed: true, skipped: true }
  const { code, output } = run([...bin(ctx.webDir, 'vite'), 'build'], ctx.webDir)
  if (code !== 0) return { name: 'frontend_build', passed: false, error: output.slice(-1000) }
  return { name: 'frontend_build', passed: true }
}

/** 前端 Vitest 测试（含 @ 别名导入完整性回归） */
export function checkFrontendTests(ctx: VerifyContext, skip: boolean): CheckResult {
  if (skip) return { name: 'frontend_tests', passed: true, skipped: true }
  const { code, output } = run([...bin(ctx.webDir, 'vitest'), 'run'], ctx.webDir)
  if (code !== 0) return { name: 'frontend_tests', passed: false, error: output.slice(-1000) }
  return { name: 'frontend_tests', passed: true }
}

// ─── 主流程 ────────────────────────────────────────────────────────────────────

export interface VerifyOptions {
  module?: string
  skipBuild?: boolean
  skipFrontendTests?: boolean
  skipDb?: boolean
  runRbacSync?: boolean
  strictDocs?: boolean
  databaseUrl?: string | null
  root?: string
  progress?: (line: string) => void
}

export interface VerifyReport {
  passed: boolean
  module: string | null
  checks: CheckResult[]
  summary: string
}

/** 按 NODE_ENV 读取数据库连接（与 pnpm db:migrate 一致） */
export async function resolveDatabaseUrl(ctx: VerifyContext): Promise<string | null> {
  try {
    const configUrl = pathToFileURL(join(ctx.srcDir, 'config.ts')).href
    const mod = (await import(configUrl)) as {
      loadEnvFiles: (env: 'development' | 'production' | 'test') => void
      loadConfig: () => { databaseUrl: string }
    }
    const raw = process.env.NODE_ENV
    const env = raw === 'production' || raw === 'test' ? raw : 'development'
    mod.loadEnvFiles(env)
    return mod.loadConfig().databaseUrl
  } catch {
    return process.env.DATABASE_URL ?? process.env.DEV_DATABASE_URL ?? null
  }
}

export async function verify(options: VerifyOptions = {}): Promise<VerifyReport> {
  const ctx = makeContext(options.root)
  const progress = options.progress ?? (() => {})
  const results: CheckResult[] = []
  const step = <T extends CheckResult>(label: string, fn: () => T): T => {
    progress(`… ${label}`)
    const r = fn()
    results.push(r)
    return r
  }

  // 全局检查
  step('typescript_compile', () => checkTypescript(ctx))
  step('no_local_has_permission', () => checkNoLocalHasPermission(ctx))
  step('migration_chain', () => checkMigrationChain(ctx))
  if (options.skipDb) {
    results.push({ name: 'migration_applied', passed: true, skipped: true })
  } else {
    progress('… migration_applied')
    const url = options.databaseUrl !== undefined ? options.databaseUrl : await resolveDatabaseUrl(ctx)
    results.push(await checkMigrationApplied(ctx, options.module, url))
  }
  step('openapi_sync', () => checkOpenapiSync(ctx))
  step('docs_paths', () => checkDocPaths(ctx, options.strictDocs))

  // 模块级检查
  if (options.module) {
    const m = options.module
    step('backend_file', () => checkBackendFile(ctx, m))
    step('frontend_page', () => checkFrontendPage(ctx, m))
    step('frontend_api', () => checkFrontendApi(ctx, m))
    step('router_registration', () => checkRouterRegistration(ctx, m))
    step('schema_registration', () => checkSchemaRegistration(ctx, m))
    step('rbac_seed', () => checkRbacSeed(ctx, m))
  }

  // RBAC 同步
  if (options.runRbacSync) step('rbac_sync', () => runRbacSync(ctx))

  // 前端构建 + 测试
  step('frontend_build', () => checkFrontendBuild(ctx, options.skipBuild ?? false))
  step('frontend_tests', () => checkFrontendTests(ctx, options.skipFrontendTests ?? false))

  // 汇总
  const passed = results.every((r) => r.passed)
  const failures = results.filter((r) => !r.passed && !r.skipped)
  return {
    passed,
    module: options.module ?? null,
    checks: results,
    summary: `${results.length - failures.length}/${results.length} 项通过`,
  }
}

export function formatHuman(report: VerifyReport): string {
  const lines = ['== castor-kit 功能验证 ==', '']
  for (const r of report.checks) {
    const icon = r.passed ? (r.skipped ? '⏭️ ' : '✅') : r.skipped ? '⏭️ ' : '❌'
    lines.push(`  ${icon} ${r.name.replace(/_/g, ' ')}`)
    if (!r.passed && !r.skipped && r.error) lines.push(`      → ${r.error}`)
    else if (r.warn && r.detail) lines.push(`      ⚠️ ${r.detail}`)
  }
  lines.push('')
  const failures = report.checks.filter((r) => !r.passed && !r.skipped)
  lines.push(report.passed ? '✅ 全部检查通过，功能可交付！' : `❌ ${failures.length} 项检查未通过，请修复后重新验证。`)
  return lines.join('\n')
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  const { values } = parseArgs({
    args: argv.filter((a) => a !== '--'),
    options: {
      module: { type: 'string' },
      'skip-build': { type: 'boolean', default: false },
      'skip-frontend-tests': { type: 'boolean', default: false },
      'skip-db': { type: 'boolean', default: false },
      'strict-docs': { type: 'boolean', default: false },
      json: { type: 'boolean', default: false },
      'run-rbac-sync': { type: 'boolean', default: false },
      'database-url': { type: 'string' },
      root: { type: 'string' },
      help: { type: 'boolean', short: 'h', default: false },
    },
    strict: true,
  })
  if (values.help) {
    printUsage(import.meta.url)
    return 0
  }
  const report = await verify({
    module: values.module,
    skipBuild: values['skip-build'],
    skipFrontendTests: values['skip-frontend-tests'],
    skipDb: values['skip-db'],
    strictDocs: values['strict-docs'],
    runRbacSync: values['run-rbac-sync'],
    databaseUrl: values['database-url'],
    root: values.root,
    // --json 模式 stdout 只输出 JSON，进度走 stderr
    progress: values.json ? (l) => process.stderr.write(`${l}\n`) : undefined,
  })
  if (values.json) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
  else console.log(formatHuman(report))
  return report.passed ? 0 : 1
}

const isMain = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href
if (isMain) {
  main()
    .then((code) => {
      process.exitCode = code
    })
    .catch((err: unknown) => {
      console.error(err)
      process.exitCode = 2
    })
}
