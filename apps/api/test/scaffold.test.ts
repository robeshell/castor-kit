/**
 * scripts/scaffold.ts
 *
 * - 纯函数：命名 / 字段解析 / 推断规则 / 自动注册；
 *   前端页面为 shadcn/ui 新体系，用 apps/web 的 eslint（stdin，不落盘）与 @/ 路径存在性把关
 * - 集成：在临时目录里复制一份 apps/api（src + drizzle，node_modules 用符号链接），用 --root 指向它执行 scaffold，
 *   断言生成文件、注册、迁移 SQL、生成代码通过 tsc、重复执行不覆盖、dry-run 不落盘。绝不写主仓库。
 */

import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  buildSpec,
  fieldSpec,
  genFrontendPage,
  genModuleSchema,
  parseFields,
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
      nameField: 'name', // 第一个 str/str50 字段
    })
    // 导出 / 表格列：全部字段；导入：全部字段，名称字段排第一（必填列）
    expect(admin.exportFields.map(([f]) => f)).toEqual(['amount', 'name', 'phone', 'memo', 'level'])
    expect(admin.importFields.map(([f]) => f)).toEqual(['name', 'amount', 'phone', 'memo', 'level'])

    const cc = buildSpec('order_item', 'component_center', parseFields('qty:int,price:float'))
    expect(cc).toMatchObject({
      permPrefix: 'cc_order_item',
      apiBase: '/api/admin/order-items',
      menuComponent: 'component_center/admin/order_item_page',
      domainDir: 'component-center',
      webModule: 'component_center',
      nameField: 'qty', // 没有字符串字段时取第一个字段
    })
    // 没有字符串字段：按原类型导入全部字段（不把第一个字段当 str）
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
        if (spec!.startsWith(`modules/${domain}/api/`)) continue // api 文件由 scaffold 同时生成
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

/** 只保留 baseline 迁移：测试不随仓库里新增的功能迁移变化 */
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

    // 表定义
    const table = readFileSync(join(root, 'apps/api/src/db/schema/admin/ck-scaffold-demo.ts'), 'utf8')
    expect(table).toContain("export const ck_scaffold_demos = pgTable('ck_scaffold_demos', {")
    expect(table).toContain('  created_at: createdAt(),')
    expect(table).toContain('    visited_at: toIso(item.visited_at),')

    // 路由：权限编码与文案，带 id 先 404 再 403
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

    // 前端：api 文件格式；页面是 shadcn/ui 新体系（结构同 users 页）
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
    // 字段类型 → 表单组件
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
    // 表格列：前 4 个字段（name/phone/amount/active）+ 创建时间；bool → StatusBadge，时间 → formatDateTime
    expect(page).toContain("<StatusBadge tone={value ? 'success' : 'neutral'} dot>")
    expect(page).toContain('render: (value) => formatDateTime(value),')
    // 编辑回填：日期转成选择器格式，不把 id / created_at 带进 PUT
    expect(page).toContain("  birthday: formatDate(record.birthday, ''),")
    expect(page).toContain("  visited_at: formatDateTime(record.visited_at, ''),")

    // 迁移 SQL
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

    // 生成的 TS 代码零类型错误（只看生成文件：副本里其他模块可能是别人的半成品）
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
    expect(router.match(/registerCkScaffoldDemoRoutes/g)).toHaveLength(2) // import + 调用各一次
    expect(readdirSync(join(root, 'apps/api/drizzle')).filter((f) => f.endsWith('.sql'))).toHaveLength(2)
  }, 120_000)

  it('--skip-migration：component_center 域生成到 component-center 目录且不跑 drizzle-kit', () => {
    const res = scaffoldCli(['--name', 'ck_scaffold_cc', '--domain', 'component_center', '--fields', 'title:str', '--skip-migration', '--root', root])
    expect(res.code, res.out).toBe(0)
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
