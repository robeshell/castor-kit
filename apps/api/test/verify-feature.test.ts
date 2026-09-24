/**
 * scripts/verify-feature.ts
 *
 * 在临时目录里搭一个最小仓库骨架（模块文件、router、schema、seed、drizzle journal、前端文件、AGENTS.md），
 * 逐项验证各检查的通过 / 失败分支，以及 --json 输出结构（与 Python verify_feature.py 一致）。
 * migration_applied 连真实测试库（TEST_DATABASE_URL）。
 */

import { spawnSync } from 'node:child_process'
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  checkBackendFile,
  checkDocPaths,
  checkFrontendApi,
  checkFrontendPage,
  checkMigrationApplied,
  checkMigrationChain,
  checkNoLocalHasPermission,
  checkRbacSeed,
  checkRouterRegistration,
  checkSchemaRegistration,
  isRepoPathRef,
  makeContext,
  moduleCandidates,
  verify,
  type VerifyContext,
} from '../scripts/verify-feature'
import { TEST_DATABASE_URL } from './helpers'

const API_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const TSX = join(API_DIR, 'node_modules', '.bin', 'tsx')

let root: string
let ctx: VerifyContext

function put(rel: string, content: string): void {
  const path = join(root, rel)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content)
}

function snapshot(id: string, prevId: string): string {
  return JSON.stringify({ id, prevId, version: '7', dialect: 'postgresql', tables: {} })
}

function writeJournal(entries: { idx: number; when: number; tag: string }[]): void {
  put(
    'apps/api/drizzle/meta/_journal.json',
    JSON.stringify({ version: '7', dialect: 'postgresql', entries: entries.map((e) => ({ ...e, version: '7', breakpoints: true })) }),
  )
}

function baseFixture(): void {
  // 后端模块 ck_widget（admin 域，目录用连字符）
  put('apps/api/src/modules/admin/ck-widget/routes.ts', "import { hasMenuPermission } from '@/common/auth'\n")
  put('apps/api/src/modules/admin/ck-widget/repository.ts', '')
  put('apps/api/src/modules/admin/ck-widget/service.ts', '')
  put(
    'apps/api/src/modules/admin/router.ts',
    "import { registerCkWidgetRoutes } from './ck-widget/routes'\nexport async function registerAdminRoutes(app) {\n  await registerUserRoutes(app)\n  await registerCkWidgetRoutes(app)\n}\n",
  )
  put('apps/api/src/router.ts', 'export async function registerRoutes(app) {\n  await registerAdminRoutes(app)\n}\n')
  put('apps/api/src/db/schema/admin/ck-widget.ts', "export const ck_widgets = pgTable('ck_widgets', {})\n")
  put('apps/api/src/db/schema/index.ts', "export * from './admin/rbac'\nexport * from './admin/ck-widget'\n")
  put(
    'apps/api/scripts/seed-rbac.ts',
    `export const MENUS_DATA = [\n  { id: 39, name: "部件", code: "system_ck_widget", component: "admin/ck_widget" },\n]\n`,
  )
  // drizzle：复用真实 baseline（hash 与测试库里记录的一致）
  cpSync(join(API_DIR, 'drizzle'), join(root, 'apps/api/drizzle'), { recursive: true })
  // 前端
  put('apps/web/src/modules/admin/api/ck_widget.js', '')
  put('apps/web/src/modules/admin/pages/ck_widget/index.jsx', '')
  // 文档
  put('AGENTS.md', '# t\n\n见 `apps/api/src/router.ts`、`db/schema/index.ts` 与 [plan](docs/plan.md)；外部 `/Users/x/y.py`、`<name>/routes.ts`\n')
  put('docs/plan.md', '')
}

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'ck-verify-'))
  baseFixture()
  ctx = makeContext(root)
})

afterAll(() => {
  if (root) rmSync(root, { recursive: true, force: true })
})

describe('verify-feature 模块级检查', () => {
  it('模块名候选：单复数、_page 后缀', () => {
    expect(moduleCandidates('users')).toEqual(['users', 'user', 'users_page', 'user_page'])
    expect(moduleCandidates('kanban_page')).toEqual(['kanban_page', 'kanban_page_page', 'kanban'])
  })

  it('backend_file：找到 routes 且 repository/service 齐全；缺层 / 缺模块报错', () => {
    expect(checkBackendFile(ctx, 'ck_widget')).toEqual({ name: 'backend_file', passed: true, path: 'apps/api/src/modules/admin/ck-widget' })
    expect(checkBackendFile(ctx, 'ck_widgets').passed).toBe(true) // 复数也能匹配
    put('apps/api/src/modules/component-center/ck-half/routes.ts', '')
    put('apps/api/src/modules/component-center/ck-half/service.ts', '')
    expect(checkBackendFile(ctx, 'ck_half')).toEqual({
      name: 'backend_file',
      passed: false,
      error: 'apps/api/src/modules/component-center/ck-half 缺少 repository.ts（分层：schema → repository → service → routes）',
    })
    const missing = checkBackendFile(ctx, 'nope')
    expect(missing.passed).toBe(false)
    expect(missing.error).toMatch(/^未找到后端 routes\.ts，检查路径：apps\/api\/src\/modules\/admin\/nope\/routes\.ts/)
  })

  it('frontend_page / frontend_api', () => {
    expect(checkFrontendPage(ctx, 'ck_widget')).toEqual({
      name: 'frontend_page',
      passed: true,
      path: 'apps/web/src/modules/admin/pages/ck_widget/index.jsx',
    })
    expect(checkFrontendPage(ctx, 'nope')).toEqual({
      name: 'frontend_page',
      passed: false,
      error: '未找到前端页面文件 index.jsx，目录名应为 nope 或 nope 或 nope_page',
    })
    expect(checkFrontendApi(ctx, 'ck_widget')).toEqual({ name: 'frontend_api', passed: true, path: 'apps/web/src/modules/admin/api/ck_widget.js' })
    expect(checkFrontendApi(ctx, 'nope').error).toBe(
      '未找到前端 API 文件，检查路径：apps/web/src/modules/admin/api/nope.js, apps/web/src/modules/admin/api/nope.js, apps/web/src/modules/component_center/api/nope.js',
    )
  })

  it('router_registration：只认真实的 await registerXxxRoutes(...) 调用', () => {
    expect(checkRouterRegistration(ctx, 'ck_widget')).toEqual({
      name: 'router_registration',
      passed: true,
      registered: ['registerCkWidgetRoutes'],
    })
    expect(checkRouterRegistration(ctx, 'users').passed).toBe(true) // users → registerUserRoutes（单数）
    const res = checkRouterRegistration(ctx, 'ck_gadget')
    expect(res.passed).toBe(false)
    expect(res.error).toContain('router 中未注册 registerCkGadgetRoutes')
    expect(res.error).toContain('"registerAdminRoutes","registerCkWidgetRoutes","registerUserRoutes"')
  })

  it('schema_registration：schema 文件必须从 index.ts 导出；没有表的模块跳过', () => {
    expect(checkSchemaRegistration(ctx, 'ck_widget')).toEqual({
      name: 'schema_registration',
      passed: true,
      path: 'apps/api/src/db/schema/admin/ck-widget.ts',
    })
    put('apps/api/src/db/schema/admin/ck-orphan.ts', "export const t = pgTable('ck_orphans', {})\n")
    expect(checkSchemaRegistration(ctx, 'ck_orphan')).toEqual({
      name: 'schema_registration',
      passed: false,
      error: "apps/api/src/db/schema/admin/ck-orphan.ts 未在 src/db/schema/index.ts 导出，请添加 export * from './admin/ck-orphan'",
    })
    // 表定义在共享文件里（按 pgTable 表名匹配）
    put('apps/api/src/db/schema/admin/rbac.ts', "export const roles = pgTable('roles', {})\n")
    expect(checkSchemaRegistration(ctx, 'roles')).toMatchObject({ passed: true, path: 'apps/api/src/db/schema/admin/rbac.ts' })
    expect(checkSchemaRegistration(ctx, 'dashboard')).toMatchObject({ passed: true, skipped: true })
  })

  it('rbac_seed：component 路径或 system_/cc_ 权限码；种子文件不存在时报错', () => {
    expect(checkRbacSeed(ctx, 'ck_widget')).toEqual({ name: 'rbac_seed', passed: true })
    expect(checkRbacSeed(ctx, 'ck_widgets')).toEqual({ name: 'rbac_seed', passed: true })
    const res = checkRbacSeed(ctx, 'ck_gadget')
    expect(res.passed).toBe(false)
    expect(res.error).toContain('种子数据中未找到 ck_gadget 的菜单')

    // 数据拆到被 seed-rbac.ts 相对导入的文件里也能识别
    put('apps/api/scripts/rbac-data.ts', "export const EXTRA = [{ code: 'cc_ck_gadget', component: null }]\n")
    put('apps/api/scripts/seed-rbac.ts', "import { EXTRA } from './rbac-data'\n")
    expect(checkRbacSeed(ctx, 'ck_gadget').passed).toBe(true)

    rmSync(join(root, 'apps/api/scripts/seed-rbac.ts'))
    expect(checkRbacSeed(ctx, 'ck_widget')).toEqual({ name: 'rbac_seed', passed: false, error: 'scripts/seed-rbac.ts 不存在' })
    put(
      'apps/api/scripts/seed-rbac.ts',
      `export const MENUS_DATA = [\n  { id: 39, name: "部件", code: "system_ck_widget", component: "admin/ck_widget" },\n]\n`,
    )
  })
})

describe('verify-feature 全局检查', () => {
  it('no_local_has_permission', () => {
    expect(checkNoLocalHasPermission(ctx)).toEqual({ name: 'no_local_has_permission', passed: true })
    put('apps/api/src/modules/admin/ck-bad/routes.ts', 'async function hasMenuPermission(code: string) { return true }\n')
    const res = checkNoLocalHasPermission(ctx)
    expect(res.passed).toBe(false)
    expect(res.error).toContain('apps/api/src/modules/admin/ck-bad/routes.ts')
    rmSync(join(root, 'apps/api/src/modules/admin/ck-bad'), { recursive: true })
  })

  it('migration_chain：线性通过；缺 SQL / 分叉 / 游离 SQL / idx 断号 报错', () => {
    const journalPath = join(root, 'apps/api/drizzle/meta/_journal.json')
    const original = readFileSync(journalPath, 'utf8')
    expect(checkMigrationChain(ctx)).toEqual({ name: 'migration_chain', passed: true, head: '0000_baseline' })

    const baselineId = (JSON.parse(readFileSync(join(root, 'apps/api/drizzle/meta/0000_snapshot.json'), 'utf8')) as { id: string }).id
    const base = (JSON.parse(original) as { entries: { idx: number; when: number; tag: string }[] }).entries[0]!
    writeJournal([base, { idx: 1, when: base.when + 1, tag: '0001_a' }])
    put('apps/api/drizzle/0001_a.sql', 'SELECT 1;')
    put('apps/api/drizzle/meta/0001_snapshot.json', snapshot('s1', baselineId))
    expect(checkMigrationChain(ctx)).toMatchObject({ passed: true, head: '0001_a' })

    // 分叉：0001 的 prevId 不指向 baseline
    put('apps/api/drizzle/meta/0001_snapshot.json', snapshot('s1', 'someone-else'))
    expect(checkMigrationChain(ctx).error).toContain('0001_a 的 snapshot.prevId 不指向上一条')
    put('apps/api/drizzle/meta/0001_snapshot.json', snapshot('s1', baselineId))

    // 缺 SQL + 游离 SQL + 时间戳倒序 + idx 断号
    rmSync(join(root, 'apps/api/drizzle/0001_a.sql'))
    put('apps/api/drizzle/0009_handwritten.sql', 'ALTER TABLE x;')
    writeJournal([base, { idx: 2, when: base.when - 1, tag: '0001_a' }])
    const res = checkMigrationChain(ctx)
    expect(res.passed).toBe(false)
    expect(res.error).toContain('缺少 SQL 文件：drizzle/0001_a.sql')
    expect(res.error).toContain('未登记到 journal 的 SQL')
    expect(res.error).toContain('0009_handwritten.sql')
    expect(res.error).toContain('0001_a 的 when 不大于上一条')
    expect(res.error).toContain('第 1 条的 idx=2')

    rmSync(join(root, 'apps/api/drizzle/0009_handwritten.sql'))
    rmSync(join(root, 'apps/api/drizzle/meta/0001_snapshot.json'))
    writeFileSync(journalPath, original)
  })

  it('migration_applied：journal 全部落库通过；未执行的迁移 / 缺表 报错；连不上库报错', async () => {
    const ok = await checkMigrationApplied(ctx, undefined, TEST_DATABASE_URL)
    expect(ok).toMatchObject({ name: 'migration_applied', passed: true, head: '0000_baseline' })
    expect(ok.detail).toMatch(/^已迁移至 0000_baseline（/)

    // 模块表不存在（schema 定义了 ck_widgets，库里没有）
    const noTable = await checkMigrationApplied(ctx, 'ck_widget', TEST_DATABASE_URL)
    expect(noTable.passed).toBe(false)
    expect(noTable.error).toContain('中不存在表：ck_widgets')

    // 有一条迁移没落库
    const journalPath = join(root, 'apps/api/drizzle/meta/_journal.json')
    const original = readFileSync(journalPath, 'utf8')
    const base = (JSON.parse(original) as { entries: { idx: number; when: number; tag: string }[] }).entries[0]!
    writeJournal([base, { idx: 1, when: 9_999_999_999_999, tag: '0001_ck_verify_pending' }])
    put('apps/api/drizzle/0001_ck_verify_pending.sql', 'SELECT 1;')
    const pending = await checkMigrationApplied(ctx, undefined, TEST_DATABASE_URL)
    expect(pending.passed).toBe(false)
    expect(pending.error).toContain('以下迁移尚未落库')
    expect(pending.error).toContain('0001_ck_verify_pending')
    expect(pending.error).toContain('pnpm db:migrate')
    rmSync(join(root, 'apps/api/drizzle/0001_ck_verify_pending.sql'))
    writeFileSync(journalPath, original)

    const down = await checkMigrationApplied(ctx, undefined, 'postgresql://wangwenyu@127.0.0.1:1/nope')
    expect(down.passed).toBe(false)
    expect(down.error).toMatch(/^连接数据库 nope 失败/)
    expect(await checkMigrationApplied(ctx, undefined, null)).toMatchObject({ passed: false })
  })

  it('docs_paths：引用路径不存在时告警（--strict-docs 阻断）', () => {
    expect(isRepoPathRef('apps/api/src/router.ts', new Set())).toBe(true)
    expect(isRepoPathRef('frontend/', new Set())).toBe(true)
    expect(isRepoPathRef('apps/web', new Set(['apps']))).toBe(true)
    expect(isRepoPathRef('robeshell/AuraStack', new Set(['apps']))).toBe(false)
    for (const ref of ['<name>/routes.ts', '/abs/x.ts', '@/common/auth', 'a/b c.ts', 'apps/api/.env.development', 'http://x/y.md']) {
      expect(isRepoPathRef(ref, new Set(['apps'])), ref).toBe(false)
    }

    expect(checkDocPaths(ctx)).toMatchObject({ name: 'docs_paths', passed: true })
    expect(checkDocPaths(ctx).warn).toBeUndefined()
    put('CLAUDE.md', '看 `apps/api/src/gone.ts` 和 [旧文档](docs/old.md)\n')
    const warn = checkDocPaths(ctx)
    expect(warn).toMatchObject({ passed: true, warn: true })
    expect(warn.detail).toContain('CLAUDE.md: apps/api/src/gone.ts')
    expect(warn.detail).toContain('CLAUDE.md: docs/old.md')
    expect(checkDocPaths(ctx, true)).toMatchObject({ passed: false })
    rmSync(join(root, 'CLAUDE.md'))
  })
})

describe('verify-feature 汇总与 CLI', () => {
  it('verify()：JSON 结构、检查顺序、summary 与 Python 一致', async () => {
    const report = await verify({ root, module: 'ck_widget', skipBuild: true, skipFrontendTests: true, skipDb: true })
    expect(Object.keys(report)).toEqual(['passed', 'module', 'checks', 'summary'])
    expect(report.module).toBe('ck_widget')
    expect(report.checks.map((c) => c.name)).toEqual([
      'typescript_compile',
      'no_local_has_permission',
      'migration_chain',
      'migration_applied',
      'openapi_sync',
      'docs_paths',
      'backend_file',
      'frontend_page',
      'frontend_api',
      'router_registration',
      'schema_registration',
      'rbac_seed',
      'frontend_build',
      'frontend_tests',
    ])
    expect(report.passed).toBe(true)
    expect(report.summary).toBe('14/14 项通过')
    expect(report.checks.find((c) => c.name === 'frontend_build')).toEqual({ name: 'frontend_build', passed: true, skipped: true })

    const failing = await verify({ root, module: 'ck_gadget', skipBuild: true, skipFrontendTests: true, skipDb: true })
    expect(failing.passed).toBe(false)
    expect(failing.summary).toBe('9/14 项通过')
  })

  it('CLI --json：stdout 只有 JSON，失败时退出码 1；无 --module 时只跑全局检查', () => {
    const run = (args: string[]) =>
      spawnSync(TSX, ['scripts/verify-feature.ts', '--', ...args], { cwd: API_DIR, encoding: 'utf8', timeout: 120_000 })

    const bad = run(['--module', 'ck_gadget', '--json', '--skip-build', '--skip-frontend-tests', '--skip-db', '--root', root])
    expect(bad.status).toBe(1)
    const parsed = JSON.parse(bad.stdout)
    expect(parsed).toMatchObject({ passed: false, module: 'ck_gadget' })
    expect(parsed.checks.find((c: { name: string }) => c.name === 'router_registration').passed).toBe(false)

    const global = run(['--json', '--skip-build', '--skip-frontend-tests', '--skip-db', '--root', root])
    expect(global.status).toBe(0)
    const g = JSON.parse(global.stdout)
    expect(g.module).toBeNull()
    expect(g.checks.map((c: { name: string }) => c.name)).not.toContain('backend_file')

    const human = run(['--module', 'ck_widget', '--skip-build', '--skip-frontend-tests', '--skip-db', '--root', root])
    expect(human.status).toBe(0)
    expect(human.stdout).toContain('== castor-kit 功能验证 ==')
    expect(human.stdout).toContain('✅ 全部检查通过，功能可交付！')
  }, 60_000)
})
