/**
 * scripts/scaffold.ts
 *
 * - Pure functions: naming / field parsing / inference rules / auto-registration;
 *   frontend pages use the new shadcn/ui system, checked with apps/web's eslint (via stdin, nothing written to disk) and @/ path existence
 * - i18n: every fixed Chinese string of the generated page is covered by PAGE_TEXTS, whose translations match the shared
 *   catalogs (apps/web/src/locales); the page passes apps/web/scripts/i18n-scan.mjs with only shared + generated locales
 * - Integration: copy apps/api into a temp dir (src + drizzle, node_modules symlinked), run scaffold with --root pointing at it,
 *   and assert the generated files, registration, migration SQL, that generated code passes tsc, reruns don't overwrite, and dry-run writes nothing.
 *   The temp copy also gets apps/web's shared locales and i18n scanner, so the generated page is scanned there. Never writes to the main repo.
 * - Comments in scaffold.ts and in every generated file are English (UI / error text stays Chinese)
 */

import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  buildSpec,
  fieldSpec,
  genApiTest,
  genDbSchema,
  genFrontendApi,
  genFrontendLocales,
  genFrontendPage,
  genModuleSchema,
  genRepository,
  genRoutes,
  genService,
  PAGE_LANGS,
  PAGE_TEXTS,
  pageTexts,
  parseFields,
  readSharedCatalogs,
  registerRoute,
  registerSchemaExport,
  toKebab,
  toLabel,
  toPascal,
} from '../scripts/scaffold'

const API_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const TSX = join(API_DIR, 'node_modules', '.bin', 'tsx')
const TSC = join(API_DIR, 'node_modules', '.bin', 'tsc')
const SCRIPT = join(API_DIR, 'scripts', 'scaffold.ts')
const WEB_DIR = resolve(API_DIR, '..', 'web')
const WEB_SRC = join(WEB_DIR, 'src')
const ESLINT = join(WEB_DIR, 'node_modules', '.bin', 'eslint')
const I18N_SCAN = join(WEB_DIR, 'scripts', 'i18n-scan.mjs')
const REPO_ROOT = resolve(API_DIR, '..', '..')

type Catalog = Record<string, string>
interface ScanProblem {
  file: string
  line: number
  kind: string
  text: string
}
type ScanFile = (path: string, catalogs: Record<string, Catalog>) => ScanProblem[]

/** apps/web's scanFile, run against the given catalogs only */
async function loadScanFile(): Promise<ScanFile> {
  const mod = (await import(pathToFileURL(I18N_SCAN).href)) as { scanFile: ScanFile }
  return mod.scanFile
}

/** Comment lines (// … , /* … , * …) that contain CJK characters */
function cjkComments(code: string): string[] {
  return code.split('\n').filter((line) => /^\s*(\/\/|\/\*|\*)/.test(line) && /[\u3400-\u9fff\uf900-\ufaff]/.test(line))
}

/** Run the copied apps/web/scripts/i18n-scan.mjs inside the temp repo; it scans with the temp repo's locales only */
function scanInCopy(root: string, target: string): { problems: ScanProblem[]; conflicts: unknown[] } {
  // realpath: the scanner only runs as a CLI when argv[1] equals its own resolved path (macOS tmpdir is a symlink)
  const script = realpathSync(join(root, 'apps/web/scripts/i18n-scan.mjs'))
  const res = spawnSync(process.execPath, [script, '--json', target], {
    cwd: join(root, 'apps/web'),
    encoding: 'utf8',
    timeout: 60_000,
  })
  expect(res.stderr).toBe('')
  return JSON.parse(res.stdout) as { problems: ScanProblem[]; conflicts: unknown[] }
}

function scaffoldCli(args: string[]) {
  const res = spawnSync(TSX, [SCRIPT, ...args], { cwd: API_DIR, encoding: 'utf8', timeout: 120_000 })
  return { code: res.status, out: `${res.stdout}${res.stderr}` }
}

describe('scaffold 纯函数', () => {
  it('命名：Pascal / kebab / title', () => {
    expect(toPascal('customer_order')).toBe('CustomerOrder')
    expect(toPascal('ck_demo_customer')).toBe('CkDemoCustomer')
    expect(toKebab('customer_order')).toBe('customer-order')
    expect(toLabel('phone_number')).toBe('Phone Number')
    expect(toLabel('name2x')).toBe('Name2X') // Python str.title()
  })

  it('字段解析：默认 name:str、缺类型按 str、类型未知回落 str', () => {
    expect(parseFields('')).toEqual([['name', 'str']])
    expect(parseFields(' title : str50 , memo,qty:int ')).toEqual([
      ['title', 'str50'],
      ['memo', 'str'],
      ['qty', 'int'],
    ])
    expect(fieldSpec('str').column).toBe('varchar({ length: 100 })')
    expect(fieldSpec('text').column).toBe('text()')
    expect(fieldSpec('int').column).toBe('integer()')
    expect(fieldSpec('float').column).toBe('numeric({ precision: 10, scale: 2 })')
    expect(fieldSpec('bool').column).toBe('boolean()')
    expect(fieldSpec('date').column).toBe("date({ mode: 'string' })")
    expect(fieldSpec('datetime').column).toBe("timestamp({ mode: 'string' })")
    expect(fieldSpec('whatever').column).toBe('varchar({ length: 100 })')
  })

  it('推断：权限前缀 / 表名 / 路由 / 菜单 component / 导入导出字段', () => {
    const admin = buildSpec('customer', 'admin', parseFields('amount:float,name:str,phone:str20,memo:text,level:int'))
    expect(admin).toMatchObject({
      table: 'customers',
      permPrefix: 'system_customer',
      apiBase: '/api/admin/customers',
      menuComponent: 'admin/customer',
      domainDir: 'admin',
      webModule: 'admin',
      nameField: 'name', // First str/str50 field
    })
    // Export / table columns: all fields; import: all fields, with the name field first (required column)
    expect(admin.exportFields.map(([f]) => f)).toEqual(['amount', 'name', 'phone', 'memo', 'level'])
    expect(admin.importFields.map(([f]) => f)).toEqual(['name', 'amount', 'phone', 'memo', 'level'])

    const cc = buildSpec('order_item', 'component_center', parseFields('qty:int,price:float'))
    expect(cc).toMatchObject({
      permPrefix: 'cc_order_item',
      apiBase: '/api/admin/order-items',
      menuComponent: 'component_center/admin/order_item_page',
      domainDir: 'component-center',
      webModule: 'component_center',
      nameField: 'qty', // With no string field, take the first field
    })
    // No string field: import all fields with their original types (don't treat the first field as str)
    expect(cc.importFields).toEqual([['qty', 'int'], ['price', 'float']])
  })

  it('前端页面：只导入用到的组件，@/ 导入在 apps/web/src 都存在，apps/web 的 eslint 零错误零告警', () => {
    const cases = [
      ['ck_min', 'admin', 'name:str'],
      ['ck_mix', 'component_center', 'active:bool,d:date,qty:int,title:str50,x:unknown'],
      ['ck_all', 'admin', 'n:str,t:text,i:int,f:float,b:bool,d:date,dt:datetime'],
    ] as const
    for (const [name, domain, fields] of cases) {
      const page = genFrontendPage(buildSpec(name, domain, parseFields(fields)))
      expect(page).not.toContain('@douyinfe')
      for (const [, spec] of page.matchAll(/from '@\/([^']+)'/g)) {
        if (spec!.startsWith(`modules/${domain}/api/`)) continue // The api file is generated by scaffold at the same time
        const hit = ['', '.js', '.jsx', '/index.js', '/index.jsx'].some((ext) => existsSync(join(WEB_SRC, `${spec}${ext}`)))
        expect(hit, `${name}: @/${spec}`).toBe(true)
      }
      const lint = spawnSync(ESLINT, ['--max-warnings', '0', '--stdin', '--stdin-filename', `src/modules/${domain}/pages/${name}/index.jsx`], {
        cwd: WEB_DIR,
        input: page,
        encoding: 'utf8',
        timeout: 60_000,
      })
      expect(lint.status, `${name}\n${lint.stdout}${lint.stderr}`).toBe(0)
    }
    const minimal = genFrontendPage(buildSpec('ck_min', 'admin', parseFields('name:str')))
    expect(minimal).toContain("import { FormInput } from '@/shared/components/FormFields'")
    expect(minimal).toContain("import { formatDateTime } from '@/lib/format'")
    expect(minimal).not.toContain('StatusBadge')
  }, 120_000)

  it('前端页面 i18n：固定中文都在 PAGE_TEXTS，公共 locales 已覆盖，无公共 locales 时生成的页面 locales 足以通过扫描', async () => {
    const scanFile = await loadScanFile()
    const shared = readSharedCatalogs(REPO_ROOT)
    const tmp = mkdtempSync(join(tmpdir(), 'ck-scaffold-i18n-'))
    try {
      for (const [name, domain, fields] of [
        ['ck_min', 'admin', 'name:str'],
        ['ck_all', 'component_center', 'n:str,t:text,i:int,f:float,b:bool,d:date,dt:datetime'],
      ] as const) {
        const spec = buildSpec(name, domain, parseFields(fields))
        const page = genFrontendPage(spec)
        const texts = pageTexts(page)
        expect(texts.filter((text) => !PAGE_TEXTS[text]), name).toEqual([])
        // Interpolated / JSX text goes through t() / <Trans> (the scan below also rejects Chinese template literals and raw JSX text)
        expect(page).toContain("import { Trans, useTranslation } from 'react-i18next'")
        expect(page).toContain("t('已勾选 {{count}} 条，将优先导出勾选数据。', { count: selectedKeys.length })")
        expect(page).toContain("t('导入成功：新增 {{created}} 条，更新 {{updated}} 条', { created: res?.created || 0, updated: res?.updated || 0 })")

        // The repo's shared locales already translate every generic CRUD string: a real run writes no page locales
        expect(genFrontendLocales(spec, shared), name).toBeNull()

        // Without shared locales, the page locales carry every string; both languages have the same keys
        const own = genFrontendLocales(spec, {})!
        expect(Object.keys(own['en-US']).sort()).toEqual(texts)
        expect(Object.keys(own['ja-JP']).sort()).toEqual(texts)

        // The real scanner, with only the generated locales as catalog: no problems
        const file = join(tmp, `${name}.jsx`)
        writeFileSync(file, page)
        expect(scanFile(file, own).map((p) => `${p.line} [${p.kind}] ${p.text}`), name).toEqual([])
        // With empty catalogs the scanner flags exactly the strings pageTexts() found (so the extraction misses nothing)
        const flagged = scanFile(file, { 'en-US': {}, 'ja-JP': {} })
        expect(flagged.every((p) => p.kind === 'missing')).toBe(true)
        expect([...new Set(flagged.map((p) => p.text))].sort()).toEqual(texts)
      }
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  })

  it('PAGE_TEXTS 与公共 locales 译文一致（同一 key 两处译文不同会被 web 的 i18n 测试判为冲突）', () => {
    const shared = readSharedCatalogs(REPO_ROOT)
    for (const lang of PAGE_LANGS) {
      const drift = Object.entries(PAGE_TEXTS)
        .filter(([zh, tr]) => shared[lang]?.[zh] !== undefined && shared[lang]![zh] !== tr[lang])
        .map(([zh, tr]) => `${zh}: ${tr[lang]} ≠ ${shared[lang]![zh]}`)
      expect(drift, lang).toEqual([])
    }
  })

  it('scaffold.ts 与全部生成代码的注释都是英文', () => {
    expect(cjkComments(readFileSync(SCRIPT, 'utf8'))).toEqual([])
    for (const [name, domain, fields] of [
      ['ck_min', 'admin', 'name:str'],
      ['ck_all', 'component_center', 'n:str,t:text,i:int,f:float,b:bool,d:date,dt:datetime'],
    ] as const) {
      const spec = buildSpec(name, domain, parseFields(fields))
      for (const gen of [genDbSchema, genModuleSchema, genRepository, genService, genRoutes, genApiTest, genFrontendApi, genFrontendPage]) {
        expect(cjkComments(gen(spec)), `${name} ${gen.name}`).toEqual([])
      }
    }
  })

  it('schema.ts 只生成用到的归一化函数', () => {
    const onlyStr = genModuleSchema(buildSpec('a', 'admin', parseFields('name:str')))
    expect(onlyStr).not.toContain('ServiceError')
    expect(onlyStr).toContain('function toStr(')
    const mixed = genModuleSchema(buildSpec('a', 'admin', parseFields('n:int,f:float,b:bool,d:date,t:datetime')))
    for (const fn of ['toInt', 'toNumeric', 'toBool', 'toDate', 'toDateTime', 'invalid']) expect(mixed).toContain(`function ${fn}(`)
    expect(mixed).not.toContain('function toStr(')
  })

  it('注册 db/schema/index.ts：插在同域最后一行之后；已注册返回 null', () => {
    const index = "// admin\nexport * from './admin/rbac'\nexport * from './admin/dicts'\n\n// cc\nexport * from './component-center/gantt'\n"
    const next = registerSchemaExport(index, 'admin', 'customer')!
    expect(next).toBe(
      "// admin\nexport * from './admin/rbac'\nexport * from './admin/dicts'\nexport * from './admin/customer'\n\n// cc\nexport * from './component-center/gantt'\n",
    )
    expect(registerSchemaExport(next, 'admin', 'customer')).toBeNull()
    expect(registerSchemaExport("export * from './admin/rbac'\n", 'new-domain', 'x')).toBe(
      "export * from './admin/rbac'\n\n// new_domain\nexport * from './new-domain/x'\n",
    )
  })

  it('注册 router.ts：import 放在最后一个 import 后，调用放在最后一个 register 调用后；已注册返回 null', () => {
    const router = [
      "import type { FastifyInstance } from 'fastify'",
      "import { registerUserRoutes } from './users/routes'",
      '',
      'export async function registerAdminRoutes(app: FastifyInstance): Promise<void> {',
      '  await registerUserRoutes(app)',
      '}',
      '',
    ].join('\n')
    const next = registerRoute(router, 'CustomerOrder', 'customer-order')!
    expect(next.split('\n')).toEqual([
      "import type { FastifyInstance } from 'fastify'",
      "import { registerUserRoutes } from './users/routes'",
      "import { registerCustomerOrderRoutes } from './customer-order/routes'",
      '',
      'export async function registerAdminRoutes(app: FastifyInstance): Promise<void> {',
      '  await registerUserRoutes(app)',
      '  await registerCustomerOrderRoutes(app)',
      '}',
      '',
    ])
    expect(registerRoute(next, 'CustomerOrder', 'customer-order')).toBeNull()
    expect(() => registerRoute('export {}\n', 'X', 'x')).toThrow(/无法自动注册/)
  })
})

/** Keep only the baseline migration: the test must not change as feature migrations are added to the repo */
function trimDrizzleToBaseline(dir: string): void {
  const journalPath = join(dir, 'meta', '_journal.json')
  const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as { entries: { tag: string }[] }
  const [baseline] = journal.entries
  for (const f of readdirSync(dir)) if (f.endsWith('.sql') && f !== `${baseline!.tag}.sql`) rmSync(join(dir, f))
  for (const f of readdirSync(join(dir, 'meta'))) if (/^\d{4}_snapshot\.json$/.test(f) && !f.startsWith('0000_')) rmSync(join(dir, 'meta', f))
  writeFileSync(journalPath, JSON.stringify({ ...journal, entries: [baseline] }, null, 2))
}

describe('scaffold CLI（临时目录副本）', () => {
  let root: string
  const name = 'ck_scaffold_demo'
  const fields = 'name:str,phone:str20,amount:float,active:bool,birthday:date,visited_at:datetime,memo:text,level:int'

  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), 'ck-scaffold-'))
    const api = join(root, 'apps', 'api')
    mkdirSync(api, { recursive: true })
    for (const entry of ['src', 'drizzle', 'drizzle.config.ts', 'tsconfig.json', 'package.json']) {
      cpSync(join(API_DIR, entry), join(api, entry), { recursive: true })
    }
    trimDrizzleToBaseline(join(api, 'drizzle'))
    symlinkSync(join(API_DIR, 'node_modules'), join(api, 'node_modules'), 'dir')
    mkdirSync(join(root, 'apps', 'web', 'src', 'modules'), { recursive: true })
    // Shared locales decide which page translations scaffold writes; the scanner locates src from its own path
    cpSync(join(WEB_SRC, 'locales'), join(root, 'apps', 'web', 'src', 'locales'), { recursive: true })
    mkdirSync(join(root, 'apps', 'web', 'scripts'), { recursive: true })
    cpSync(I18N_SCAN, join(root, 'apps', 'web', 'scripts', 'i18n-scan.mjs'))
    symlinkSync(join(WEB_DIR, 'node_modules'), join(root, 'apps', 'web', 'node_modules'), 'dir')
    // Generated API tests import ./helpers, which tsc needs for the check
    mkdirSync(join(api, 'test'), { recursive: true })
    cpSync(join(API_DIR, 'test', 'helpers.ts'), join(api, 'test', 'helpers.ts'))
  })

  afterAll(() => {
    if (root) rmSync(root, { recursive: true, force: true })
  })

  it('非法名称：exit 1 + 提示', () => {
    const res = scaffoldCli(['--', '--name', 'BadName', '--root', root])
    expect(res.code).toBe(1)
    expect(res.out).toContain('❌ --name 必须是 snake_case 格式（小写字母+下划线），如 customer_order')
  })

  it('dry-run：只打印，不写文件、不改注册文件、不生成迁移', () => {
    const indexBefore = readFileSync(join(root, 'apps/api/src/db/schema/index.ts'), 'utf8')
    const res = scaffoldCli(['--name', name, '--domain', 'component_center', '--fields', fields, '--dry-run', '--root', root])
    expect(res.code).toBe(0)
    expect(res.out).toContain('[dry-run] would write: apps/api/src/modules/component-center/ck-scaffold-demo/routes.ts')
    expect(res.out).toContain('[dry-run] would write: apps/api/test/cc-ck-scaffold-demo.test.ts')
    expect(res.out).toContain('[dry-run] would write: apps/web/src/modules/component_center/pages/admin/ck_scaffold_demo_page/index.jsx')
    expect(res.out).toContain('[dry-run] would run: drizzle-kit generate --name ck_scaffold_demo')
    expect(res.out).toContain('Perm prefix: cc_ck_scaffold_demo')
    expect(existsSync(join(root, 'apps/api/src/modules/component-center/ck-scaffold-demo'))).toBe(false)
    expect(readFileSync(join(root, 'apps/api/src/db/schema/index.ts'), 'utf8')).toBe(indexBefore)
    expect(readdirSync(join(root, 'apps/api/drizzle')).filter((f) => f.endsWith('.sql'))).toEqual(['0000_baseline.sql'])
  })

  it('生成：文件 + 注册 + drizzle 迁移，生成代码通过 tsc', () => {
    const res = scaffoldCli(['--name', name, '--domain', 'admin', '--fields', fields, '--root', root])
    expect(res.code, res.out).toBe(0)
    for (const rel of [
      'apps/api/src/db/schema/admin/ck-scaffold-demo.ts',
      'apps/api/src/modules/admin/ck-scaffold-demo/schema.ts',
      'apps/api/src/modules/admin/ck-scaffold-demo/repository.ts',
      'apps/api/src/modules/admin/ck-scaffold-demo/service.ts',
      'apps/api/src/modules/admin/ck-scaffold-demo/routes.ts',
      'apps/api/test/admin-ck-scaffold-demo.test.ts',
      'apps/web/src/modules/admin/api/ck_scaffold_demo.js',
      'apps/web/src/modules/admin/pages/ck_scaffold_demo/index.jsx',
    ]) {
      expect(res.out).toContain(`[create] ${rel}`)
      expect(existsSync(join(root, rel)), rel).toBe(true)
    }
    expect(res.out).toContain('[update] apps/api/src/db/schema/index.ts')
    expect(res.out).toContain('[update] apps/api/src/modules/admin/router.ts')
    expect(res.out).toContain('✅ 骨架文件生成完成！')

    const index = readFileSync(join(root, 'apps/api/src/db/schema/index.ts'), 'utf8')
    expect(index).toContain("export * from './admin/ck-scaffold-demo'")
    const router = readFileSync(join(root, 'apps/api/src/modules/admin/router.ts'), 'utf8')
    expect(router).toContain("import { registerCkScaffoldDemoRoutes } from './ck-scaffold-demo/routes'")
    expect(router).toContain('  await registerCkScaffoldDemoRoutes(app)')

    // Table definition
    const table = readFileSync(join(root, 'apps/api/src/db/schema/admin/ck-scaffold-demo.ts'), 'utf8')
    expect(table).toContain("export const ck_scaffold_demos = pgTable('ck_scaffold_demos', {")
    expect(table).toContain('  created_at: createdAt(),')
    expect(table).toContain('    visited_at: toIso(item.visited_at),')

    // Routes: permission codes and messages; routes with an id check 404 before 403
    const routes = readFileSync(join(root, 'apps/api/src/modules/admin/ck-scaffold-demo/routes.ts'), 'utf8')
    expect(routes).toContain("const BASE = '/api/admin/ck-scaffold-demos'")
    for (const [code, msg] of [
      ['system_ck_scaffold_demo', '无权限'],
      ['system_ck_scaffold_demo_add', '无权限新增'],
      ['system_ck_scaffold_demo_edit', '无权限编辑'],
      ['system_ck_scaffold_demo_delete', '无权限删除'],
      ['system_ck_scaffold_demo_export', '无权限导出'],
      ['system_ck_scaffold_demo_import', '无权限导入'],
    ]) {
      expect(routes).toContain(`hasMenuPermission(request, '${code}')))`)
      expect(routes).toContain(`{ error: '${msg}' }`)
    }
    expect(routes.indexOf('service.getOr404(itemId(request.params))')).toBeLessThan(routes.indexOf("'system_ck_scaffold_demo_edit'"))

    // Frontend: api file format; page uses the new shadcn/ui system (same structure as the users page)
    const api = readFileSync(join(root, 'apps/web/src/modules/admin/api/ck_scaffold_demo.js'), 'utf8')
    expect(api).toContain("const BASE = '/admin/ck-scaffold-demos'")
    const page = readFileSync(join(root, 'apps/web/src/modules/admin/pages/ck_scaffold_demo/index.jsx'), 'utf8')
    expect(page).toContain('export default function CkScaffoldDemoPage()')
    expect(page).toContain("from '@/modules/admin/api/ck_scaffold_demo'")
    expect(page).not.toMatch(/@douyinfe|var\(--semi-|import-export\//)
    for (const tag of ['PageHeader', 'FilterBar', 'SearchInput', 'DataTable', 'FormDialog', 'ImportDialog', 'ExportDialog', 'ConfirmAction']) {
      expect(page).toContain(`<${tag}`)
    }
    expect(page).toContain('useCrudList(')
    // Field type → form component
    for (const line of [
      '<FormInput control={form.control} name="name" label="Name" />',
      '<FormInput control={form.control} name="phone" label="Phone" />',
      '<FormNumber control={form.control} name="amount" label="Amount" step={0.01} />',
      '<FormSwitch control={form.control} name="active" label="Active" />',
      '<FormDate control={form.control} name="birthday" label="Birthday" />',
      '<FormDateTime control={form.control} name="visited_at" label="Visited At" />',
      '<FormTextarea control={form.control} name="memo" label="Memo" />',
      '<FormNumber control={form.control} name="level" label="Level" step={1} />',
    ]) {
      expect(page).toContain(line)
    }
    expect(page).toContain("import { FormDate, FormDateTime, FormInput, FormNumber, FormSwitch, FormTextarea } from '@/shared/components/FormFields'")
    // Table columns: first 4 fields (name/phone/amount/active) + created time; bool → StatusBadge, time → formatDateTime
    expect(page).toContain("<StatusBadge tone={value ? 'success' : 'neutral'} dot>")
    expect(page).toContain('render: (value) => formatDateTime(value),')
    // Edit prefill: dates converted to picker format; id / created_at not sent in the PUT
    expect(page).toContain("  birthday: formatDate(record.birthday, ''),")
    expect(page).toContain("  visited_at: formatDateTime(record.visited_at, ''),")

    // i18n: the shared locales cover every page string, so no page locales; the scanner passes in the copy
    expect(res.out).toContain('[skip] page locales: every page string is translated in apps/web/src/locales')
    expect(existsSync(join(root, 'apps/web/src/modules/admin/pages/ck_scaffold_demo/locales'))).toBe(false)
    expect(scanInCopy(root, 'src/modules/admin/pages/ck_scaffold_demo')).toEqual({ problems: [], conflicts: [] })

    // Comments of every generated file are English
    for (const rel of [
      'apps/api/src/db/schema/admin/ck-scaffold-demo.ts',
      'apps/api/src/modules/admin/ck-scaffold-demo/schema.ts',
      'apps/api/src/modules/admin/ck-scaffold-demo/repository.ts',
      'apps/api/src/modules/admin/ck-scaffold-demo/service.ts',
      'apps/api/src/modules/admin/ck-scaffold-demo/routes.ts',
      'apps/api/test/admin-ck-scaffold-demo.test.ts',
      'apps/web/src/modules/admin/api/ck_scaffold_demo.js',
      'apps/web/src/modules/admin/pages/ck_scaffold_demo/index.jsx',
    ]) {
      expect(cjkComments(readFileSync(join(root, rel), 'utf8')), rel).toEqual([])
    }
    // Backend error messages stay Chinese (translated by src/i18n/messages.ts, see test/i18n-messages.test.ts)
    const schemaTs = readFileSync(join(root, 'apps/api/src/modules/admin/ck-scaffold-demo/schema.ts'), 'utf8')
    expect(schemaTs).toContain('new ServiceError(`${fieldLabel(field)}的值无效`, 400)')
    const serviceTs = readFileSync(join(root, 'apps/api/src/modules/admin/ck-scaffold-demo/service.ts'), 'utf8')
    for (const msg of ["'删除成功'", "'导入失败，存在错误数据'", "'导入成功'", '`${requiredHeader}不能为空`']) expect(serviceTs).toContain(msg)

    // Migration SQL
    const sqlFiles = readdirSync(join(root, 'apps/api/drizzle')).filter((f) => f.endsWith('.sql'))
    expect(sqlFiles).toContain('0001_ck_scaffold_demo.sql')
    const sql = readFileSync(join(root, 'apps/api/drizzle/0001_ck_scaffold_demo.sql'), 'utf8')
    expect(sql).toContain('CREATE TABLE "ck_scaffold_demos"')
    for (const col of [
      '"name" varchar(100)',
      '"phone" varchar(20)',
      '"amount" numeric(10, 2)',
      '"active" boolean',
      '"birthday" date',
      '"visited_at" timestamp',
      '"memo" text',
      '"level" integer',
      '"created_at" timestamp',
      '"updated_at" timestamp',
    ]) {
      expect(sql).toContain(col)
    }
    const journal = JSON.parse(readFileSync(join(root, 'apps/api/drizzle/meta/_journal.json'), 'utf8'))
    expect(journal.entries.map((e: { tag: string }) => e.tag)).toEqual(['0000_baseline', '0001_ck_scaffold_demo'])

    // Generated TS code has zero type errors (only generated files are checked: other modules in the copy may be someone's work in progress)
    const tsc = spawnSync(TSC, ['--noEmit', '-p', join(root, 'apps/api/tsconfig.json')], { encoding: 'utf8', timeout: 120_000 })
    const ours = `${tsc.stdout}${tsc.stderr}`.split('\n').filter((l) => /ck-scaffold-demo|schema\/index\.ts|admin\/router\.ts/.test(l))
    expect(ours).toEqual([])
  }, 180_000)

  it('重复执行：不覆盖已有文件、不重复注册、不产生新迁移', () => {
    const routesPath = join(root, 'apps/api/src/modules/admin/ck-scaffold-demo/routes.ts')
    const before = readFileSync(routesPath, 'utf8')
    const res = scaffoldCli(['--name', name, '--domain', 'admin', '--fields', 'other:int', '--root', root])
    expect(res.code, res.out).toBe(0)
    expect(res.out).toContain('[skip] already exists: apps/api/src/modules/admin/ck-scaffold-demo/routes.ts')
    expect(res.out).toContain('[skip] already registered: apps/api/src/db/schema/index.ts')
    expect(res.out).toContain('[skip] already registered: apps/api/src/modules/admin/router.ts')
    expect(res.out).toContain('No schema changes')
    expect(readFileSync(routesPath, 'utf8')).toBe(before)
    const router = readFileSync(join(root, 'apps/api/src/modules/admin/router.ts'), 'utf8')
    expect(router.match(/registerCkScaffoldDemoRoutes/g)).toHaveLength(2) // One import + one call each
    expect(readdirSync(join(root, 'apps/api/drizzle')).filter((f) => f.endsWith('.sql'))).toHaveLength(2)
  }, 120_000)

  it('--skip-migration：component_center 域生成到 component-center 目录且不跑 drizzle-kit；缺公共 locales 时写页面 locales', () => {
    // Hide the shared locales so scaffold has to ship the page translations itself
    const sharedDir = join(root, 'apps/web/src/locales')
    renameSync(sharedDir, `${sharedDir}.hidden`)
    let res
    try {
      res = scaffoldCli(['--name', 'ck_scaffold_cc', '--domain', 'component_center', '--fields', 'title:str,on:bool', '--skip-migration', '--root', root])
    } finally {
      renameSync(`${sharedDir}.hidden`, sharedDir)
    }
    expect(res.code, res.out).toBe(0)
    const pageDir = 'apps/web/src/modules/component_center/pages/admin/ck_scaffold_cc_page'
    const locales = Object.fromEntries(
      PAGE_LANGS.map((lang) => {
        expect(res.out).toContain(`[create] ${pageDir}/locales/${lang}.json`)
        return [lang, JSON.parse(readFileSync(join(root, pageDir, 'locales', `${lang}.json`), 'utf8')) as Catalog]
      }),
    )
    const keys = Object.keys(locales['en-US']!)
    expect(Object.keys(locales['ja-JP']!)).toEqual(keys)
    expect(keys).toEqual([...keys].sort())
    expect(keys).toEqual(pageTexts(readFileSync(join(root, pageDir, 'index.jsx'), 'utf8')))
    expect(keys).toEqual(expect.arrayContaining(['是', '否', '确认删除该记录？', '已勾选 {{count}} 条，将优先导出勾选数据。']))
    // Shared locales restored: the page locales duplicate them with identical translations → no conflicts
    expect(scanInCopy(root, pageDir.replace('apps/web/', ''))).toEqual({ problems: [], conflicts: [] })
    expect(res.out).toContain('[create] apps/api/src/modules/component-center/ck-scaffold-cc/routes.ts')
    expect(res.out).toContain('[create] apps/web/src/modules/component_center/pages/admin/ck_scaffold_cc_page/index.jsx')
    expect(res.out).toContain('[skip] migration（--skip-migration）')
    const router = readFileSync(join(root, 'apps/api/src/modules/component-center/router.ts'), 'utf8')
    expect(router).toContain('  await registerCkScaffoldCcRoutes(app)')
    expect(readFileSync(join(root, 'apps/api/src/db/schema/index.ts'), 'utf8')).toContain(
      "export * from './component-center/ck-scaffold-cc'",
    )
    expect(readdirSync(join(root, 'apps/api/drizzle')).filter((f) => f.endsWith('.sql'))).toHaveLength(2)
  }, 60_000)
})
