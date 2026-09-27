/**
 * castor-kit feature verification gate
 *
 * Usage:
 *   pnpm verify -- --module customer
 *   pnpm verify -- --module customer --skip-build
 *   pnpm verify -- --module customer --json   # structured JSON output (for AI/MCP; stdout contains only JSON)
 *
 * Checks:
 *   1. TypeScript type check (tsc --noEmit: all of apps/api including scripts/test, apps/mcp and apps/web)
 *   2. routes layer must not define its own hasPermission (must use common/auth)
 *   3. Migration chain is intact (drizzle journal is linear, snapshot prevIds chain up, every entry has SQL, no stray SQL)
 *   4. Migrations are actually applied (journal compared against drizzle.__drizzle_migrations; module tables confirmed via to_regclass)
 *   5. OpenAPI document follows AGENTS.md's rules (blocking; runs scripts/generate-openapi.ts --dry-run --strict)
 *   6. Paths referenced by AI context docs exist (warning; blocking with --strict-docs)
 *   7. Backend routes/repository/service files exist
 *      + Data scope: a module whose schema.ts exports DATA_SCOPE must filter with dataScopeWhere in repository.ts
 *   8. Frontend page file exists
 *   9. Frontend API file exists
 *  10. Route registration (src/router.ts / modules/<domain>/router.ts)
 *  11. Table definition registration (db/schema/index.ts)
 *  12. RBAC seed (scripts/seed-rbac.ts) contains the menu component or permission code
 *  13. Frontend build passes (optional, skip with --skip-build)
 *  14. Frontend Vitest passes (optional, skip with --skip-frontend-tests)
 *  15. Backend Vitest passes (optional, skip with --skip-api-tests; ~45s, needs the test DB)
 *
 * JSON output shape: { passed, module, checks: [{ name, passed, error?, skipped?, warn?, detail? }], summary }
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

// ─── Utilities ─────────────────────────────────────────────────────────────────

export function run(cmd: string[], cwd: string, timeoutMs = 600_000): { code: number; output: string } {
  const opts: SpawnSyncOptions = { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: timeoutMs, env: process.env }
  const res = spawnSync(cmd[0]!, cmd.slice(1), opts)
  const output = `${res.stdout ?? ''}${res.stderr ?? ''}`
  if (res.error) return { code: 1, output: `${output}${res.error.message}` }
  return { code: res.status ?? 1, output }
}

/** Prefer the package's node_modules/.bin; fall back to npx if not found */
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

/** Candidate spellings of the module name: customer / customers / customer_page / list_page → list */
export function moduleCandidates(module: string): string[] {
  const singular = singularOf(module)
  const names = [module, singular, `${module}_page`, `${singular}_page`]
  if (module.endsWith('_page')) names.push(module.slice(0, -'_page'.length))
  return [...new Set(names)]
}

const BACKEND_DOMAINS = ['admin', 'component-center']
const WEB_MODULES = ['admin', 'component_center']

// ─── Individual checks ─────────────────────────────────────────────────────────

/** Type-checks each package's tsconfig.json (apps/api, apps/mcp, apps/web), plus apps/web's tsconfig.test.json (its tests and Vite / Vitest configs) */
export function checkTypescript(ctx: VerifyContext): CheckResult {
  const errors: string[] = []
  const projects: [pkg: string, config: string][] = [
    [ctx.apiDir, 'tsconfig.json'],
    [join(ctx.root, 'apps', 'mcp'), 'tsconfig.json'],
    [ctx.webDir, 'tsconfig.json'],
    [ctx.webDir, 'tsconfig.test.json'],
  ]
  for (const [pkg, config] of projects) {
    if (!existsSync(join(pkg, config))) continue
    const { code, output } = run([...bin(pkg, 'tsc'), '--noEmit', '-p', config], pkg)
    if (code !== 0) errors.push(`[${rel(ctx, join(pkg, config))}]\n${output.trim()}`)
  }
  if (errors.length > 0) return { name: 'typescript_compile', passed: false, error: errors.join('\n').slice(0, 2000) }
  return { name: 'typescript_compile', passed: true }
}

/** routes layer must not define its own hasPermission / hasMenuPermission (must import from common/auth) */
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
      error: `These files define their own hasPermission (import it from src/common/auth.ts instead): ${JSON.stringify(offenders)}`,
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
 * Migration chain integrity: journal idx is contiguous, when strictly increasing, tags unique; each entry has SQL and a snapshot;
 * snapshot prevIds link end to end (single root, linear, no forks); no stray (hand-written) SQL under drizzle/.
 */
export function checkMigrationChain(ctx: VerifyContext): CheckResult {
  const dir = join(ctx.apiDir, 'drizzle')
  const journalPath = join(dir, 'meta', '_journal.json')
  if (!existsSync(journalPath)) return { name: 'migration_chain', passed: true, skipped: true }

  let entries: JournalEntry[]
  try {
    entries = (JSON.parse(readFileSync(journalPath, 'utf8')) as { entries?: JournalEntry[] }).entries ?? []
  } catch (err) {
    return { name: 'migration_chain', passed: false, error: `Could not parse _journal.json: ${(err as Error).message}` }
  }
  if (entries.length === 0) return { name: 'migration_chain', passed: true, skipped: true }

  const details: string[] = []
  const tags = new Set<string>()
  let prevSnapshotId: string | null = null
  entries.forEach((e, i) => {
    if (e.idx !== i) details.push(`entry ${i} has idx=${e.idx} (expected ${i}; the journal is out of order or has a gap)`)
    if (i > 0 && !(e.when > entries[i - 1]!.when)) {
      details.push(`${e.tag}: when is not later than the previous entry's (the migrator compares timestamps, so it would be skipped)`)
    }
    if (tags.has(e.tag)) details.push(`duplicate tag: ${e.tag}`)
    tags.add(e.tag)
    if (!existsSync(join(dir, `${e.tag}.sql`))) details.push(`missing SQL file: drizzle/${e.tag}.sql`)

    const snapshotPath = join(dir, 'meta', `${String(e.idx).padStart(4, '0')}_snapshot.json`)
    if (!existsSync(snapshotPath)) {
      details.push(`missing snapshot: drizzle/meta/${String(e.idx).padStart(4, '0')}_snapshot.json`)
      prevSnapshotId = null
      return
    }
    try {
      const snap = JSON.parse(readFileSync(snapshotPath, 'utf8')) as { id?: string; prevId?: string }
      if (i > 0 && prevSnapshotId && snap.prevId !== prevSnapshotId) {
        details.push(`${e.tag}: snapshot.prevId does not point to the previous entry (the chain forks: several migrations were generated from the same parent)`)
      }
      prevSnapshotId = snap.id ?? null
    } catch {
      details.push(`could not parse the snapshot of ${e.tag}`)
      prevSnapshotId = null
    }
  })

  const orphans = readdirSync(dir)
    .filter((f) => f.endsWith('.sql') && !tags.has(f.slice(0, -4)))
    .sort()
  if (orphans.length > 0) {
    details.push(`SQL files in drizzle/ that are not in the journal (hand-written migrations break the chain; use drizzle-kit generate): ${JSON.stringify(orphans)}`)
  }

  if (details.length > 0) return { name: 'migration_chain', passed: false, error: `Broken migration chain: ${details.join('; ')}` }
  return { name: 'migration_chain', passed: true, head: entries[entries.length - 1]!.tag }
}

/** Find the module's table names in schema files (pgTable('xxx')) */
export function findModuleTables(ctx: VerifyContext, module: string): { file: string; tables: string[] } | null {
  const schemaDir = join(ctx.srcDir, 'db', 'schema')
  const files = walk(schemaDir, (p) => p.endsWith('.ts') && !p.endsWith('index.ts'))
  const names = moduleCandidates(module)
  const kebabs = new Set(names.map(toKebab))
  const tableNames = new Set(names.flatMap((n) => [n, `${n}s`]))

  // 1) Schema file with the same name (layout generated by scaffold)
  const byFile = files.find((f) => kebabs.has(f.slice(f.lastIndexOf('/') + 1, -3)))
  // 2) Any schema file that defines a table with the same name
  const byTable = files.find((f) => {
    for (const m of readFileSync(f, 'utf8').matchAll(/pgTable\(\s*['"]([^'"]+)['"]/g)) if (tableNames.has(m[1]!)) return true
    return false
  })
  const file = byFile ?? byTable
  if (!file) return null
  const tables = [...readFileSync(file, 'utf8').matchAll(/pgTable\(\s*['"]([^'"]+)['"]/g)].map((m) => m[1]!)
  return { file, tables }
}

/** Migrations actually applied: every journal migration (by SQL content hash) is in drizzle.__drizzle_migrations; module tables really exist */
export async function checkMigrationApplied(
  ctx: VerifyContext,
  module: string | undefined,
  databaseUrl: string | null,
): Promise<CheckResult> {
  const name = 'migration_applied'
  const folder = join(ctx.apiDir, 'drizzle')
  if (!existsSync(join(folder, 'meta', '_journal.json'))) return { name, passed: true, skipped: true }
  if (!databaseUrl) return { name, passed: false, error: 'No database connection configured (DEV_DATABASE_URL / DATABASE_URL / TEST_DATABASE_URL), so the migrations cannot be confirmed' }

  let migrations
  try {
    migrations = readMigrationFiles({ migrationsFolder: folder })
  } catch (err) {
    return { name, passed: false, error: `Could not read the migration files: ${(err as Error).message}` }
  }
  const journal = (JSON.parse(readFileSync(join(folder, 'meta', '_journal.json'), 'utf8')) as { entries: JournalEntry[] }).entries
  const database = databaseUrl.replace(/^.*\//, '').replace(/\?.*$/, '')

  const pool = new pg.Pool({ connectionString: databaseUrl, max: 1, connectionTimeoutMillis: 5000 })
  try {
    const { rows: reg } = await pool.query<{ t: string | null }>(`SELECT to_regclass('drizzle.__drizzle_migrations')::text AS t`)
    if (!reg[0]?.t) {
      return { name, passed: false, error: `No migrations have been applied to ${database} (drizzle.__drizzle_migrations does not exist); run pnpm db:migrate` }
    }
    const { rows } = await pool.query<{ hash: string }>('SELECT hash FROM drizzle.__drizzle_migrations')
    const applied = new Set(rows.map((r) => r.hash))
    const pending = migrations.map((m, i) => ({ m, tag: journal[i]?.tag ?? `#${i}` })).filter(({ m }) => !applied.has(m.hash))
    if (pending.length > 0) {
      return {
        name,
        passed: false,
        error:
          `Migrations not applied to ${database} (or their SQL changed after they were applied): ${pending.map((p) => p.tag).join(', ')}; ` +
          'run pnpm db:migrate and confirm with psql \\d <table>',
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
          return { name, passed: false, error: `Database ${database} is missing tables: ${missing.join(', ')} (defined in the schema, but no migration was generated or applied)` }
        }
        result.tables = found.tables
      }
    }
    result.detail = `migrated to ${result.head} (${database})`
    return result
  } catch (err) {
    return { name, passed: false, error: `Could not connect to database ${database}: ${(err as Error).message}` }
  } finally {
    await pool.end().catch(() => {})
  }
}

/**
 * OpenAPI document (blocks the gate): runs generate-openapi.ts --dry-run --strict, which checks every registered /api
 * route against AGENTS.md's OpenAPI rules (scripts/lib/openapi-lint.ts). Operations of the module being verified are
 * listed first.
 */
export function checkOpenapiSync(ctx: VerifyContext, module?: string): CheckResult {
  const name = 'openapi_sync'
  const script = join(ctx.apiDir, 'scripts', 'generate-openapi.ts')
  const docPath = join(ctx.root, 'docs', 'apifox-full.openapi.json')
  if (!existsSync(script) || !existsSync(docPath)) return { name, passed: true, skipped: true }

  const { code, output } = run([...bin(ctx.apiDir, 'tsx'), 'scripts/generate-openapi.ts', '--dry-run', '--strict'], ctx.apiDir, 180_000)
  if (code === 0) return { name, passed: true }
  const failing = /Docs check: (\d+) endpoints? do(?:es)? not follow the rules/.exec(output)?.[1]
  if (!failing) return { name, passed: false, error: `The OpenAPI generation script failed: ${output.trim().slice(-500)}` }

  const ops = output.split('\n').filter((l) => /^(GET|POST|PUT|PATCH|DELETE) \/api\//.test(l))
  const slug = module?.replace(/_/g, '-')
  const mine = slug ? ops.filter((l) => l.includes(`/${slug}`)) : []
  const shown = [...mine, ...ops.filter((l) => !mine.includes(l))].slice(0, 10)
  return {
    name,
    passed: false,
    error:
      `${failing} ${failing === '1' ? 'endpoint has' : 'endpoints have'} OpenAPI docs that do not follow AGENTS.md "OpenAPI writing rules"${mine.length ? ` (${mine.length} in this module)` : ''}: ` +
      `${shown.join('; ')}${ops.length > shown.length ? '; ...' : ''}. ` +
      'Run pnpm openapi:generate to add stubs, fill them in per the rules, then run pnpm openapi:generate -- --strict to see what is wrong with each endpoint',
  }
}

/** Repo paths referenced in AI context docs (AGENTS.md / CLAUDE.md / ...) via `backticks` or relative links must exist */
export function checkDocPaths(ctx: VerifyContext, strict = false): CheckResult {
  const name = 'docs_paths'
  const docs = [
    'AGENTS.md',
    'CLAUDE.md',
    'README.md',
    'README.zh-CN.md',
    'README.ja.md',
  ]
    .map((f) => join(ctx.root, f))
    .filter((p) => existsSync(p))
  for (const dir of ['.claude/skills', '.agents']) {
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
  const detail = `Paths referenced in the docs do not exist (${missing.length}): ${missing.slice(0, 20).join('; ')}`
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

/** Backend routes/repository/service files exist (modules/<domain>/<name>/) */
export function checkBackendFile(ctx: VerifyContext, module: string): CheckResult {
  const candidates = BACKEND_DOMAINS.flatMap((d) =>
    moduleCandidates(module).map((n) => join(ctx.srcDir, 'modules', d, toKebab(n))),
  )
  const found = candidates.find((dir) => existsSync(join(dir, 'routes.ts')))
  if (!found) {
    return {
      name: 'backend_file',
      passed: false,
      error: `No backend routes.ts found; looked in: ${candidates.slice(0, 4).map((d) => rel(ctx, join(d, 'routes.ts'))).join(', ')}`,
    }
  }
  const missing = ['repository.ts', 'service.ts'].filter((f) => !existsSync(join(found, f)))
  if (missing.length > 0) {
    return {
      name: 'backend_file',
      passed: false,
      error: `${rel(ctx, found)} is missing ${missing.join(' / ')} (layers: schema → repository → service → routes)`,
    }
  }
  return { name: 'backend_file', passed: true, path: rel(ctx, found) }
}

/** Frontend page index.jsx exists */
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
    error: `No frontend page index.tsx (or index.jsx) found; its directory should be named ${module}, ${singular} or ${module}_page`,
  }
}

/** Frontend API file exists */
export function checkFrontendApi(ctx: VerifyContext, module: string): CheckResult {
  const singular = singularOf(module)
  const api = (m: string, f: string) => join(ctx.webDir, 'src', 'modules', m, 'api', f)
  const bases = [
    api('admin', module),
    api('admin', singular),
    api('component_center', module),
    api('component_center', singular),
    api('component_center', `${module}_page`),
  ]
  const found = bases.flatMap((base) => [`${base}.ts`, `${base}.js`]).find((p) => existsSync(p))
  if (found) return { name: 'frontend_api', passed: true, path: rel(ctx, found) }
  return {
    name: 'frontend_api',
    passed: false,
    error: `No frontend API file found; looked in: ${[...new Set(bases)].slice(0, 3).map((p) => `${rel(ctx, p)}.{ts,js}`).join(', ')}`,
  }
}

/** Route registration: parse the registerXxxRoutes(app) calls actually made in router files, exact match */
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
      `No router calls register${toPascal(module)}Routes / register${toPascal(singularOf(module))}Routes; ` +
      `registered: ${all.length > 0 ? JSON.stringify(all) : 'none'}. Call it in src/modules/<domain>/router.ts`,
  }
}

/** Table definition registration: the module's schema file must be exported from db/schema/index.ts (both drizzle-kit and relational queries read from there) */
export function checkSchemaRegistration(ctx: VerifyContext, module: string): CheckResult {
  const name = 'schema_registration'
  const found = findModuleTables(ctx, module)
  if (!found) {
    return { name, passed: true, skipped: true, detail: `No table definition file found for ${module} (the module may have no tables of its own); skipped` }
  }
  const indexPath = join(ctx.srcDir, 'db', 'schema', 'index.ts')
  const spec = `./${relative(join(ctx.srcDir, 'db', 'schema'), found.file).replace(/\.ts$/, '')}`
  const index = existsSync(indexPath) ? readFileSync(indexPath, 'utf8') : ''
  const exported = new RegExp(`from\\s+['"]${spec.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\.ts)?['"]`).test(index)
  if (exported) return { name, passed: true, path: rel(ctx, found.file) }
  return {
    name,
    passed: false,
    error: `${rel(ctx, found.file)} is not exported from src/db/schema/index.ts; add export * from '${spec}'`,
  }
}

/** RBAC seed: the menu data must contain the matching component path or permission code (exact match) */
export function checkRbacSeed(ctx: VerifyContext, module: string): CheckResult {
  const seedFile = join(ctx.apiDir, 'scripts', 'seed-rbac.ts')
  if (!existsSync(seedFile)) return { name: 'rbac_seed', passed: false, error: 'scripts/seed-rbac.ts does not exist' }

  // seed-rbac.ts and the data files it imports relatively
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
  // Component path ends with /<module> or /<module>_page (e.g. component_center/ai/ai_sql_page / admin/users)
  const compMatch = [...components].some((c) =>
    [module, `${module}_page`, singular, `${singular}_page`].some((n) => c.endsWith(`/${n}`)),
  )
  const codeMatch = ['cc', 'system'].some((p) => codes.has(`${p}_${module}`) || codes.has(`${p}_${singular}`))
  if (compMatch || codeMatch) return { name: 'rbac_seed', passed: true }
  return {
    name: 'rbac_seed',
    passed: false,
    error:
      `No menu for ${module} in the seed data (neither a component path nor a system_${module} / cc_${module} permission code); ` +
      'add the menu and buttons to scripts/seed-rbac.ts, then run pnpm seed:rbac -- --incremental',
  }
}

/** Run seed-rbac.ts --incremental */
export function runRbacSync(ctx: VerifyContext): CheckResult {
  const { code, output } = run([...bin(ctx.apiDir, 'tsx'), 'scripts/seed-rbac.ts', '--incremental'], ctx.apiDir)
  return { name: 'rbac_sync', passed: code === 0, error: code !== 0 ? output.trim().slice(0, 500) : null }
}

/** Frontend build (vite build) */
export function checkFrontendBuild(ctx: VerifyContext, skip: boolean): CheckResult {
  if (skip) return { name: 'frontend_build', passed: true, skipped: true }
  const { code, output } = run([...bin(ctx.webDir, 'vite'), 'build'], ctx.webDir)
  if (code !== 0) return { name: 'frontend_build', passed: false, error: output.slice(-1000) }
  return { name: 'frontend_build', passed: true }
}

/** Frontend Vitest tests */
export function checkFrontendTests(ctx: VerifyContext, skip: boolean): CheckResult {
  if (skip) return { name: 'frontend_tests', passed: true, skipped: true }
  const { code, output } = run([...bin(ctx.webDir, 'vitest'), 'run'], ctx.webDir)
  if (code !== 0) return { name: 'frontend_tests', passed: false, error: output.slice(-1000) }
  return { name: 'frontend_tests', passed: true }
}

/** Backend unit tests: new features often change seed / migration related tests, so the gate must cover them */
export function checkApiTests(ctx: VerifyContext, skip: boolean): CheckResult {
  if (skip) return { name: 'api_tests', passed: true, skipped: true }
  const { code, output } = run([...bin(ctx.apiDir, 'vitest'), 'run'], ctx.apiDir)
  if (code !== 0) return { name: 'api_tests', passed: false, error: output.slice(-1500) }
  return { name: 'api_tests', passed: true }
}

// ─── Main flow ─────────────────────────────────────────────────────────────────

export interface VerifyOptions {
  module?: string
  skipBuild?: boolean
  skipFrontendTests?: boolean
  skipApiTests?: boolean
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

/** Read the database connection according to NODE_ENV (same as pnpm db:migrate) */
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

/**
 * Modules that declare data scope (`export const DATA_SCOPE` in schema.ts) must filter their queries with
 * dataScopeWhere in repository.ts; modules without the declaration are skipped.
 */
export function checkDataScopeFilter(ctx: VerifyContext, module: string): CheckResult {
  const name = 'data_scope_filter'
  const dir = BACKEND_DOMAINS.flatMap((d) => moduleCandidates(module).map((n) => join(ctx.srcDir, 'modules', d, toKebab(n)))).find(
    (candidate) => existsSync(join(candidate, 'routes.ts')),
  )
  const schemaPath = dir ? join(dir, 'schema.ts') : ''
  if (!dir || !existsSync(schemaPath) || !/export const DATA_SCOPE\b/.test(readFileSync(schemaPath, 'utf8'))) {
    return { name, passed: true, skipped: true, detail: 'The module declares no data scope (schema.ts has no DATA_SCOPE)' }
  }
  const repoPath = join(dir, 'repository.ts')
  const repo = existsSync(repoPath) ? readFileSync(repoPath, 'utf8') : ''
  if (!/\bdataScopeWhere\(/.test(repo)) {
    return {
      name,
      passed: false,
      error: `${rel(ctx, schemaPath)} declares DATA_SCOPE, but ${rel(ctx, repoPath)} does not filter its queries with dataScopeWhere (see src/common/data-scope.ts)`,
    }
  }
  return { name, passed: true, detail: `${rel(ctx, repoPath)} filters by data scope` }
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

  // Global checks
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
  step('openapi_sync', () => checkOpenapiSync(ctx, options.module))
  step('docs_paths', () => checkDocPaths(ctx, options.strictDocs))

  // Module-level checks
  if (options.module) {
    const m = options.module
    step('backend_file', () => checkBackendFile(ctx, m))
    step('data_scope_filter', () => checkDataScopeFilter(ctx, m))
    step('frontend_page', () => checkFrontendPage(ctx, m))
    step('frontend_api', () => checkFrontendApi(ctx, m))
    step('router_registration', () => checkRouterRegistration(ctx, m))
    step('schema_registration', () => checkSchemaRegistration(ctx, m))
    step('rbac_seed', () => checkRbacSeed(ctx, m))
  }

  // RBAC sync
  if (options.runRbacSync) step('rbac_sync', () => runRbacSync(ctx))

  // Frontend build + tests
  step('frontend_build', () => checkFrontendBuild(ctx, options.skipBuild ?? false))
  step('frontend_tests', () => checkFrontendTests(ctx, options.skipFrontendTests ?? false))
  step('api_tests', () => checkApiTests(ctx, options.skipApiTests ?? false))

  // Summary
  const passed = results.every((r) => r.passed)
  const failures = results.filter((r) => !r.passed && !r.skipped)
  return {
    passed,
    module: options.module ?? null,
    checks: results,
    summary: `${results.length - failures.length}/${results.length} checks passed`,
  }
}

export function formatHuman(report: VerifyReport): string {
  const lines = ['== castor-kit feature verification ==', '']
  for (const r of report.checks) {
    const icon = r.passed ? (r.skipped ? '⏭️ ' : '✅') : r.skipped ? '⏭️ ' : '❌'
    lines.push(`  ${icon} ${r.name.replace(/_/g, ' ')}`)
    if (!r.passed && !r.skipped && r.error) lines.push(`      → ${r.error}`)
    else if (r.warn && r.detail) lines.push(`      ⚠️ ${r.detail}`)
  }
  lines.push('')
  const failures = report.checks.filter((r) => !r.passed && !r.skipped)
  lines.push(
    report.passed
      ? '✅ All checks passed. The feature is ready to deliver.'
      : `❌ ${failures.length} ${failures.length === 1 ? 'check' : 'checks'} failed. Fix ${failures.length === 1 ? 'it' : 'them'} and run verify again.`,
  )
  return lines.join('\n')
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  const { values } = parseArgs({
    args: argv.filter((a) => a !== '--'),
    options: {
      module: { type: 'string' },
      'skip-build': { type: 'boolean', default: false },
      'skip-frontend-tests': { type: 'boolean', default: false },
      'skip-api-tests': { type: 'boolean', default: false },
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
    skipApiTests: values['skip-api-tests'],
    skipDb: values['skip-db'],
    strictDocs: values['strict-docs'],
    runRbacSync: values['run-rbac-sync'],
    databaseUrl: values['database-url'],
    root: values.root,
    // In --json mode stdout carries only JSON; progress goes to stderr
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
