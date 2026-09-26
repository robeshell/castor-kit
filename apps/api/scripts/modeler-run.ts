/**
 * Visual modeler job runner (development only): started by the API as a detached process, so it keeps going when
 * the dev server restarts because generated files changed.
 *
 *   tsx scripts/modeler-run.ts <jobId>
 *
 * generate: scaffold (--spec, with the menu) → db:migrate → seed:rbac --incremental → openapi:generate →
 *           verify --module <name> --skip-build. A failing step undoes everything done so far.
 * undo:     remove a module the modeler generated: its table, migration record and menus in the dev and test
 *           databases, then its files and registrations (see lib/modeler-undo.ts).
 *
 * Progress is written to .modeler/jobs/<id>/state.json; output goes to stdout, which the API points at log.txt.
 */

import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, rmdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import pg from 'pg'
import { utcNowIso } from '../src/common/serialize'
import { loadConfig, loadEnvFiles } from '../src/config'
import {
  API_DIR,
  readModules,
  readState,
  releaseLock,
  REPO_ROOT,
  specPath,
  writeLock,
  writeModules,
  writeState,
  type GeneratedModule,
  type JobState,
} from '../src/modules/admin/modeler/files'
import {
  lastJournalEntry,
  moduleCodes,
  removeApiPaths,
  removeJournalEntry,
  removeMenuNames,
  unregisterMenus,
  unregisterRoute,
  unregisterSchema,
} from './lib/modeler-undo'
import { buildSpec, scaffoldFromSpec, type SpecFile } from './scaffold'

const JOURNAL = join(API_DIR, 'drizzle', 'meta', '_journal.json')
const TSX = join(API_DIR, 'node_modules', '.bin', 'tsx')

class StepError extends Error {}

function setStep(state: JobState, key: string, status: JobState['steps'][number]['status']): void {
  const step = state.steps.find((s) => s.key === key)
  if (step) step.status = status
  writeState(state)
}

async function step(state: JobState, key: string, run: () => void | Promise<void>): Promise<void> {
  const label = state.steps.find((s) => s.key === key)?.label ?? key
  console.log(`\n━━ ${label} ━━`)
  setStep(state, key, 'running')
  try {
    await run()
  } catch (err) {
    setStep(state, key, 'failed')
    throw err
  }
  setStep(state, key, 'done')
}

/** Run a command in apps/api with its output going to the log; throws when it fails */
function sh(label: string, args: string[]): void {
  console.log(`$ ${relative(API_DIR, args[0]!) || args[0]} ${args.slice(1).join(' ')}`)
  const res = spawnSync(TSX, args, { cwd: API_DIR, stdio: 'inherit', env: { ...process.env, FORCE_COLOR: '0' } })
  if (res.status !== 0) throw new StepError(`${label}失败（exit ${res.status ?? res.signal}）`)
}

function moduleOf(spec: SpecFile, files: string[], migration: GeneratedModule['migration'], jobId: string): GeneratedModule {
  const s = buildSpec(spec.name, spec.domain ?? 'admin', [], {})
  return {
    name: spec.name,
    title: spec.title?.trim() || s.title,
    domain: s.domain,
    table: s.table,
    permPrefix: s.permPrefix,
    pascal: s.pascal,
    kebab: s.kebab,
    domainDir: s.domainDir,
    apiBase: s.apiBase,
    path: `/biz/${s.kebab}s`,
    files,
    migration,
    jobId,
    created_at: utcNowIso(),
  }
}

// ─── Removing a module ───────────────────────────────────────────────────────

/** Drop the module's table, migration record and menus in one database (missing ones are fine) */
async function cleanDatabase(url: string, m: GeneratedModule): Promise<void> {
  const client = new pg.Client({ connectionString: url })
  try {
    await client.connect()
  } catch (err) {
    console.log(`  (跳过 ${url.replace(/\/\/[^@]*@/, '//')}：${err instanceof Error ? err.message : String(err)})`)
    return
  }
  try {
    await client.query('BEGIN')
    await client.query(`DROP TABLE IF EXISTS "${m.table.replace(/"/g, '')}" CASCADE`)
    if (m.migration) await client.query('DELETE FROM drizzle.__drizzle_migrations WHERE created_at = $1', [m.migration.when])
    const codes = moduleCodes(m.permPrefix)
    await client.query('DELETE FROM role_menus WHERE menu_id IN (SELECT id FROM menus WHERE code = ANY($1))', [codes])
    // Buttons first: they point at the menu
    await client.query('DELETE FROM menus WHERE code = ANY($1) AND menu_type = $2', [codes, 'button'])
    await client.query('DELETE FROM menus WHERE code = ANY($1)', [codes])
    await client.query('COMMIT')
    console.log(`  ${url.replace(/\/\/[^@]*@/, '//')}: 已删除表 ${m.table} 与菜单`)
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined)
    throw err
  } finally {
    await client.end()
  }
}

function edit(path: string, transform: (content: string) => string | null): void {
  if (!existsSync(path)) return
  const next = transform(readFileSync(path, 'utf8'))
  if (next === null) return
  writeFileSync(path, next, 'utf8')
  console.log(`  [update] ${relative(REPO_ROOT, path)}`)
}

/** Delete a file and the directories it leaves empty (up to the repo) */
function removeFile(rel: string): void {
  const path = join(REPO_ROOT, rel)
  if (!existsSync(path)) return
  rmSync(path, { force: true })
  console.log(`  [delete] ${rel}`)
  for (let dir = dirname(path); dir.startsWith(REPO_ROOT) && dir !== REPO_ROOT; dir = dirname(dir)) {
    try {
      if (readdirSync(dir).length > 0) break
      rmdirSync(dir)
    } catch {
      break
    }
  }
}

function removeFiles(m: GeneratedModule): void {
  // The journal first: it refuses when later migrations depend on this one
  if (m.migration) {
    edit(JOURNAL, (c) => removeJournalEntry(c, m.migration!.tag))
    removeFile(relative(REPO_ROOT, join(API_DIR, 'drizzle', `${m.migration.tag}.sql`)))
    const idx = m.migration.tag.split('_')[0]
    removeFile(relative(REPO_ROOT, join(API_DIR, 'drizzle', 'meta', `${idx}_snapshot.json`)))
  }
  for (const file of m.files) removeFile(file)
  edit(join(API_DIR, 'src', 'db', 'schema', 'index.ts'), (c) => unregisterSchema(c, m))
  edit(join(API_DIR, 'src', 'modules', m.domainDir, 'router.ts'), (c) => unregisterRoute(c, m))
  edit(join(API_DIR, 'scripts', 'seed-rbac.ts'), (c) => unregisterMenus(c, m))
  for (const lang of ['en-US', 'ja-JP']) {
    edit(join(REPO_ROOT, 'apps', 'web', 'src', 'locales', 'menus', `${lang}.json`), (c) => removeMenuNames(c, m))
  }
  edit(join(REPO_ROOT, 'docs', 'apifox-full.openapi.json'), (c) => removeApiPaths(c, m))
}

async function removeModule(m: GeneratedModule): Promise<void> {
  // Check the migration can go before touching anything
  if (m.migration && existsSync(JOURNAL)) {
    const last = lastJournalEntry(readFileSync(JOURNAL, 'utf8'))
    const present = (JSON.parse(readFileSync(JOURNAL, 'utf8')) as { entries: Array<{ tag: string }> }).entries.some((e) => e.tag === m.migration!.tag)
    if (present && last?.tag !== m.migration.tag) {
      throw new StepError(`迁移 ${m.migration.tag} 之后还有其他迁移，不能自动撤销；请手动处理后再删除模块`)
    }
  }
  loadEnvFiles('development')
  const dev = loadConfig({ ...process.env, NODE_ENV: 'development' })
  const test = loadConfig({ ...process.env, NODE_ENV: 'test' })
  for (const url of new Set([dev.databaseUrl, test.databaseUrl])) await cleanDatabase(url, m)
  removeFiles(m)
}

// ─── Jobs ────────────────────────────────────────────────────────────────────

async function runGenerate(state: JobState, spec: SpecFile): Promise<void> {
  const created: string[] = []
  let current: GeneratedModule | null = null
  const record = (m: GeneratedModule) => {
    current = m
    writeModules([...readModules().filter((x) => x.name !== m.name), m])
  }
  try {
    await step(state, 'scaffold', () => {
      const before = existsSync(JOURNAL) ? lastJournalEntry(readFileSync(JOURNAL, 'utf8')) : null
      const code = scaffoldFromSpec(spec, {
        log: (line) => console.log(line),
        onChange: ({ path, before: previous }) => {
          if (previous === null) created.push(relative(REPO_ROOT, path))
        },
      })
      const after = existsSync(JOURNAL) ? lastJournalEntry(readFileSync(JOURNAL, 'utf8')) : null
      const migration = after && after.tag !== before?.tag ? after : null
      // Recorded right away: whatever happens next, the module can be undone
      record(moduleOf(spec, created, migration, state.id))
      if (code !== 0) throw new StepError('生成代码失败')
    })
    await step(state, 'migrate', () => sh('迁移数据库', ['src/db/migrate-cli.ts']))
    await step(state, 'seed', () => sh('同步菜单权限', ['scripts/seed-rbac.ts', '--incremental']))
    await step(state, 'openapi', () => sh('更新接口文档', ['scripts/generate-openapi.ts']))
    await step(state, 'verify', () => sh('门禁检查', ['scripts/verify-feature.ts', '--module', spec.name, '--skip-build']))
  } catch (err) {
    state.error = err instanceof Error ? err.message : String(err)
    const m = current as GeneratedModule | null
    if (m) {
      console.log('\n━━ 回滚 ━━')
      try {
        await removeModule(m)
        writeModules(readModules().filter((x) => x.name !== m.name))
        state.rolledBack = true
      } catch (undoErr) {
        console.log(`回滚失败：${undoErr instanceof Error ? undoErr.message : String(undoErr)}`)
      }
    }
    throw err
  }
}

async function runUndo(state: JobState, name: string): Promise<void> {
  const m = readModules().find((x) => x.name === name)
  if (!m) throw new StepError(`没有找到建模器生成的模块 ${name}`)
  await step(state, 'database', () => removeModule(m))
  await step(state, 'finish', () => {
    writeModules(readModules().filter((x) => x.name !== name))
    console.log(`已删除模块 ${m.title}（${name}）`)
  })
}

async function main(): Promise<void> {
  const jobId = process.argv[2]
  if (!jobId) throw new Error('usage: tsx scripts/modeler-run.ts <jobId>')
  const state = readState(jobId)
  if (!state) throw new Error(`job ${jobId} not found`)
  writeLock(jobId, process.pid)
  const payload = JSON.parse(readFileSync(specPath(jobId), 'utf8')) as SpecFile
  try {
    if (state.kind === 'generate') await runGenerate(state, payload)
    else await runUndo(state, payload.name)
    state.status = 'success'
    console.log('\n✅ 完成')
  } catch (err) {
    state.status = 'failed'
    state.error ??= err instanceof Error ? err.message : String(err)
    for (const s of state.steps) if (s.status === 'pending') s.status = 'skipped'
    console.log(`\n❌ ${state.error}${state.rolledBack ? '（已回滚本次生成的内容）' : ''}`)
  } finally {
    state.finished_at = utcNowIso()
    writeState(state)
    releaseLock(jobId)
  }
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
