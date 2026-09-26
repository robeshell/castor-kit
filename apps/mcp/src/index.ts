#!/usr/bin/env node
/**
 * castor-kit MCP Server
 *
 * Exposes the castor-kit dev tooling over the MCP protocol, so MCP clients such as Claude Desktop can drive the full feature-development flow without a command line.
 *
 * Configure in Claude Desktop (~/Library/Application Support/Claude/claude_desktop_config.json):
 *   {
 *     "mcpServers": {
 *       "castor-kit": {
 *         "command": "pnpm",
 *         "args": ["--dir", "/path/to/castor-kit", "-s", "mcp"]
 *       }
 *     }
 *   }
 * Or build it and run with node directly: `pnpm --filter @castor-kit/mcp build` → `node /path/to/castor-kit/apps/mcp/dist/index.js`
 *
 * Tools:
 *   get_project_context   returns AGENTS.md + the current module tree (for Step 1)
 *   get_menu_tree         returns the current menu structure (for inferring parent_id)
 *   get_spec_guide        returns the spec JSON Schema + requirement → spec examples (for writing a spec)
 *   validate_spec         checks a spec and says what it would generate (pnpm scaffold --spec --validate-only)
 *   scaffold_feature      generates a module from a spec (or legacy name / fields), incl. its OpenAPI entries
 *   check_openapi         checks docs/apifox-full.openapi.json against the OpenAPI rules (openapi:generate --dry-run --strict)
 *   run_verify            runs pnpm verify --json and returns the JSON
 *   init_rbac             runs pnpm seed:rbac -- --incremental
 *   run_migration         pnpm db:generate + pnpm db:migrate
 *   list_templates        returns the list of available templates
 *
 * The repo root defaults to three levels above this file (src/ and dist/ are at the same depth); override with CASTOR_KIT_ROOT.
 * Subcommands prefer pnpm; when pnpm is not on PATH, tsx / drizzle-kit from apps/api/node_modules/.bin are used directly.
 */

import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'

export const ROOT = resolve(process.env.CASTOR_KIT_ROOT ?? join(dirname(fileURLToPath(import.meta.url)), '../../..'))
const API_DIR = join(ROOT, 'apps', 'api')

// ─── Child processes ──────────────────────────────────────────────────────────

interface RunResult {
  code: number
  stdout: string
  stderr: string
  /** stdout + stderr (merged output) */
  output: string
}

function runCommand(cmd: string, args: string[], cwd: string = ROOT): Promise<RunResult> {
  return new Promise((resolvePromise) => {
    const child = spawn(cmd, args, { cwd, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    let output = ''
    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8')
      output += chunk.toString('utf8')
    })
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8')
      output += chunk.toString('utf8')
    })
    child.on('error', (err) => resolvePromise({ code: 1, stdout, stderr: stderr + err.message, output: output + err.message }))
    child.on('close', (code) => resolvePromise({ code: code ?? 1, stdout, stderr, output }))
  })
}

let pnpmAvailable: boolean | null = null
function hasPnpm(): boolean {
  if (pnpmAvailable === null) {
    const res = spawnSync('pnpm', ['--version'], { cwd: ROOT, stdio: 'ignore' })
    pnpmAvailable = res.status === 0
  }
  return pnpmAvailable
}

/** Root package.json scripts → equivalent direct invocations when pnpm is unavailable (cwd = apps/api) */
const SCRIPT_FALLBACK: Record<string, { bin: string; args: string[] }> = {
  scaffold: { bin: 'tsx', args: ['scripts/scaffold.ts'] },
  'openapi:generate': { bin: 'tsx', args: ['scripts/generate-openapi.ts'] },
  verify: { bin: 'tsx', args: ['scripts/verify-feature.ts'] },
  'seed:rbac': { bin: 'tsx', args: ['scripts/seed-rbac.ts'] },
  'db:migrate': { bin: 'tsx', args: ['src/db/migrate-cli.ts'] },
  'db:generate': { bin: 'drizzle-kit', args: ['generate'] },
}

/**
 * Runs a script from the root package.json: `pnpm -s <script> -- ...args`.
 * drizzle-kit does not understand `--` (castor-kit's own scripts ignore it), so db:generate takes the args directly.
 */
export function runScript(script: string, args: string[] = []): Promise<RunResult> {
  const dash = script === 'db:generate' ? [] : ['--']
  if (hasPnpm()) return runCommand('pnpm', ['-s', script, ...(args.length > 0 ? [...dash, ...args] : [])], ROOT)
  const fallback = SCRIPT_FALLBACK[script]
  if (!fallback) return Promise.resolve({ code: 1, stdout: '', stderr: `未知脚本：${script}`, output: `未知脚本：${script}` })
  const bin = join(API_DIR, 'node_modules', '.bin', fallback.bin)
  return runCommand(bin, [...fallback.args, ...args], API_DIR)
}

/** Extracts the JSON object from stdout that is mixed with other output */
export function extractJson(text: string): unknown {
  const trimmed = text.trim()
  try {
    return JSON.parse(trimmed)
  } catch {
    const start = trimmed.indexOf('{')
    const end = trimmed.lastIndexOf('}')
    if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1))
    throw new Error('输出中没有 JSON')
  }
}

// ─── Tool implementations ─────────────────────────────────────────────────────

type ToolResult = { content: { type: 'text'; text: string }[] }
const text = (value: string): ToolResult => ({ content: [{ type: 'text', text: value }] })

/** Script output without pnpm's own `$ <command>` echo lines */
export function cleanOutput(output: string): string {
  return output
    .split('\n')
    .filter((line) => !line.startsWith('$ '))
    .join('\n')
    .trim()
}

/** Run the scaffold with a spec object: it is written to a temp file for `--spec` and removed afterwards */
async function withSpecFile(spec: unknown, args: string[]): Promise<RunResult> {
  const dir = mkdtempSync(join(tmpdir(), 'castor-kit-spec-'))
  const file = join(dir, 'spec.json')
  try {
    writeFileSync(file, JSON.stringify(spec, null, 2), 'utf8')
    return await runScript('scaffold', ['--spec', file, ...args])
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

/** docs/spec.schema.json + docs/examples/specs (README and every example) */
export function specGuide(): string {
  const read = (rel: string) => {
    const path = join(ROOT, rel)
    return existsSync(path) ? readFileSync(path, 'utf8').trim() : `（${rel} 不存在）`
  }
  const examplesDir = join(ROOT, 'docs', 'examples', 'specs')
  const examples = existsSync(examplesDir) ? readdirSync(examplesDir).filter((f) => f.endsWith('.json')).sort() : []
  return [
    '# 模块规格（spec）指南',
    '',
    '先用 validate_spec 校验并确认会生成什么，再用 scaffold_feature 的 spec 参数生成。',
    '',
    '## 需求 → spec 示例（docs/examples/specs/README.md）',
    '',
    read('docs/examples/specs/README.md'),
    '',
    ...examples.flatMap((f) => [`## docs/examples/specs/${f}`, '', '```json', read(`docs/examples/specs/${f}`), '```', '']),
    '## JSON Schema（docs/spec.schema.json）',
    '',
    '```json',
    read('docs/spec.schema.json'),
    '```',
  ].join('\n')
}

export function projectContext(): string {
  const agentsMd = join(ROOT, 'AGENTS.md')
  const content = existsSync(agentsMd) ? readFileSync(agentsMd, 'utf8') : '（AGENTS.md 不存在）'

  // Current module list: apps/api/src/modules/<domain>/<module>/
  const modulesDir = join(API_DIR, 'src', 'modules')
  const beDomains: string[] = []
  if (existsSync(modulesDir)) {
    for (const domain of readdirSync(modulesDir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (!domain.isDirectory() || domain.name.startsWith('_')) continue
      const modules = readdirSync(join(modulesDir, domain.name), { withFileTypes: true })
        .filter((m) => m.isDirectory() && existsSync(join(modulesDir, domain.name, m.name, 'routes.ts')))
        .map((m) => m.name)
        .sort()
      beDomains.push(`  ${domain.name}/: ${modules.join(', ')}`)
    }
  }
  return `${content}\n\n---\n\n## 当前后端模块\n\n${beDomains.join('\n')}`
}

interface MenuRow {
  id: number
  name: string
  code: string
  parent_id: number | null
  menu_type: string | null
  path: string | null
  component: string | null
  sort_order: number | null
}

/** Queries menus using apps/api's config (NODE_ENV → .env.<env>); runs with tsx inside apps/api to reuse its dependencies */
const MENU_QUERY_SCRIPT = `
(async () => {
  const pg = (await import('pg')).default
  const cfg = await import('./src/config.ts')
  const raw = process.env.NODE_ENV
  cfg.loadEnvFiles(raw === 'production' || raw === 'test' ? raw : 'development')
  const client = new pg.Client({ connectionString: cfg.loadConfig().databaseUrl })
  await client.connect()
  try {
    const { rows } = await client.query(
      'SELECT id, name, code, parent_id, menu_type, path, component, sort_order ' +
      'FROM menus ORDER BY COALESCE(parent_id, 0), sort_order, id'
    )
    process.stdout.write(JSON.stringify(rows))
  } finally {
    await client.end()
  }
})().catch((err) => { console.error(err && err.message ? err.message : err); process.exit(1) })
`

export function formatMenuTree(menus: MenuRow[]): string {
  const lines = [`共 ${menus.length} 个菜单项`, '']
  const byParent = new Map<number | null, MenuRow[]>()
  for (const m of menus) {
    const list = byParent.get(m.parent_id) ?? []
    list.push(m)
    byParent.set(m.parent_id, list)
  }
  const parentIds = new Set(menus.map((m) => m.parent_id))
  const fmt = (items: MenuRow[], indent: number): void => {
    for (const m of items) {
      lines.push(`${'  '.repeat(indent)}ID=${m.id}  ${m.name} (${m.code})  ${m.menu_type ?? ''}`)
      if (parentIds.has(m.id)) fmt(byParent.get(m.id) ?? [], indent + 1)
    }
  }
  fmt(byParent.get(null) ?? [], 0)
  const maxId = menus.length > 0 ? Math.max(...menus.map((m) => m.id)) : 0
  lines.push(`\n当前最大 ID：${maxId}，建议下一个 ID：${maxId + 1}`)
  return lines.join('\n')
}

export async function menuTree(): Promise<string> {
  const tsx = join(API_DIR, 'node_modules', '.bin', 'tsx')
  const res = await runCommand(existsSync(tsx) ? tsx : 'npx', [...(existsSync(tsx) ? [] : ['tsx']), '-e', MENU_QUERY_SCRIPT], API_DIR)
  if (res.code !== 0) return `查询菜单失败：${res.output}`
  let menus: MenuRow[]
  try {
    menus = JSON.parse(res.stdout.trim()) as MenuRow[]
  } catch {
    return `查询菜单失败：${res.output}`
  }
  return formatMenuTree(menus)
}

export function listTemplates(): string {
  const templatesDir = join(ROOT, 'docs', 'templates')
  if (!existsSync(templatesDir)) return 'docs/templates/ 目录不存在，请先创建模板。'
  const lines = ['可用代码模板：', '']
  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name))
      .flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)).map((p) => `${e.name}/${p}`) : [e.name]))
  for (const d of readdirSync(templatesDir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (!d.isDirectory()) continue
    lines.push(`📁 ${d.name}/`)
    for (const f of walk(join(templatesDir, d.name))) lines.push(`   ${f}`)
    lines.push('')
  }
  return lines.join('\n')
}

/** Migration description → drizzle-kit --name (only lowercase letters, digits and underscores allowed) */
export function migrationName(message: string): string {
  const slug = message
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return slug || 'auto_migration'
}

// ─── Server ───────────────────────────────────────────────────────────────────

export function createServer(): McpServer {
  const server = new McpServer({ name: 'castor-kit', version: '0.1.0' })

  server.registerTool(
    'get_project_context',
    {
      description: '返回 castor-kit 项目上下文，包含 AGENTS.md 全文和当前模块结构。实现新功能前必须先调用此工具。',
      inputSchema: {},
    },
    async () => text(projectContext()),
  )

  server.registerTool(
    'get_menu_tree',
    {
      description: '返回当前数据库中的菜单树结构，用于确定新菜单的 parent_id 和下一个可用 ID。',
      inputSchema: {},
    },
    async () => text(await menuTree()),
  )

  server.registerTool(
    'get_spec_guide',
    {
      description:
        '返回写模块规格（spec）需要的全部参考：JSON Schema（字段类型、必填项、选项写法）和「一句需求 → spec」示例及每个字段的推断理由。' +
        '把需求写成 spec 之前先调用。',
      inputSchema: {},
    },
    async () => text(specGuide()),
  )

  server.registerTool(
    'validate_spec',
    {
      description:
        '校验模块规格（spec），不生成任何文件：有问题逐条列出（拼错的属性、缺中文标题 / 字段名、类型与默认值不符等）；' +
        '通过时说明会生成的接口、权限、表和菜单。生成前必须先通过。',
      inputSchema: {
        spec: z.record(z.string(), z.unknown()).describe('模块规格对象，格式见 get_spec_guide'),
      },
    },
    async ({ spec }) => {
      const res = await withSpecFile(spec, ['--validate-only'])
      return text(cleanOutput(res.output))
    },
  )

  server.registerTool(
    'scaffold_feature',
    {
      description:
        '生成一个完整模块：db/schema 表定义 + schema/repository/service/routes + 接口测试 + 前端页面，' +
        '自动注册到 db/schema/index.ts 与 router.ts、生成 drizzle 迁移、写好 OpenAPI 文档；spec 里写了 menu 时同时写入菜单和按钮权限。' +
        '优先传 spec（先用 validate_spec 校验）；name / fields 是没有中文标签和选项的旧用法。生成后还需补充业务逻辑。',
      inputSchema: {
        spec: z.record(z.string(), z.unknown()).optional().describe('模块规格对象（推荐），格式见 get_spec_guide；传了 spec 就不看 name / domain / fields'),
        name: z.string().optional().describe('旧用法：资源名，snake_case，如 customer'),
        domain: z.enum(['admin', 'component_center']).optional().describe('旧用法：所属域'),
        fields: z.string().optional().describe('旧用法：字段列表，格式 "name:str,phone:str20,amount:float"'),
        dry_run: z.boolean().optional().default(false).describe('只预览不写文件，默认 false'),
      },
    },
    async ({ spec, name, domain, fields, dry_run }) => {
      const flags = dry_run ? ['--dry-run'] : []
      let res: RunResult
      if (spec) {
        res = await withSpecFile(spec, flags)
      } else if (name) {
        res = await runScript('scaffold', ['--name', name, '--domain', domain ?? 'admin', '--fields', fields ?? 'name:str', ...flags])
      } else {
        return text('❌ 失败\n\n需要 spec（推荐）或 name')
      }
      return text(`${res.code === 0 ? '✅ 成功' : '❌ 失败'}\n\n${cleanOutput(res.output)}`)
    },
  )

  server.registerTool(
    'check_openapi',
    {
      description:
        '按 AGENTS.md「OpenAPI 编写规范」检查 docs/apifox-full.openapi.json 是否覆盖并正确描述所有接口，逐个列出不合规的接口和原因；' +
        '改了路由、字段或校验后调用。不修改文件。',
      inputSchema: {},
    },
    async () => {
      const res = await runScript('openapi:generate', ['--dry-run', '--strict'])
      return text(`${res.code === 0 ? '✅ 文档符合规范' : '❌ 文档不符合规范'}\n\n${cleanOutput(res.output).slice(-6000)}`)
    },
  )

  server.registerTool(
    'run_verify',
    {
      description: '运行 verify-feature.ts 门禁检查，返回结构化 JSON 结果。功能实现完成后必须调用，全部通过才算交付。',
      inputSchema: {
        module: z.string().describe('模块名，snake_case，如 customer'),
        skip_build: z.boolean().optional().default(false).describe('是否跳过前端构建（耗时），默认 false'),
      },
    },
    async ({ module, skip_build }) => {
      const args = ['--module', module, '--json']
      if (skip_build) args.push('--skip-build')
      const res = await runScript('verify', args)
      let result: unknown
      try {
        result = extractJson(res.stdout)
      } catch {
        result = { passed: false, raw: res.output }
      }
      return text(JSON.stringify(result, null, 2))
    },
  )

  server.registerTool(
    'init_rbac',
    {
      description: '运行 pnpm seed:rbac -- --incremental，同步菜单和权限到数据库。',
      inputSchema: {},
    },
    async () => {
      const res = await runScript('seed:rbac', ['--incremental'])
      return text(`${res.code === 0 ? '✅ RBAC 同步成功' : '❌ RBAC 同步失败'}\n\n${res.output.slice(-2000)}`)
    },
  )

  server.registerTool(
    'run_migration',
    {
      description: '执行 drizzle-kit generate + pnpm db:migrate，生成并应用数据库迁移。',
      inputSchema: {
        message: z.string().describe('迁移描述，如 "add customer table"（转换为 drizzle-kit --name）'),
      },
    },
    async ({ message }) => {
      const generate = await runScript('db:generate', ['--name', migrationName(message ?? 'auto migration')])
      const migrate = await runScript('db:migrate')
      const passed = generate.code === 0 && migrate.code === 0
      return text(
        `${passed ? '✅ 迁移成功' : '❌ 迁移失败'}\n\ngenerate:\n${generate.output}\n\nmigrate:\n${migrate.output}`,
      )
    },
  )

  server.registerTool(
    'list_templates',
    {
      description: '返回 docs/templates/ 下可用的代码模板列表及说明。',
      inputSchema: {},
    },
    async () => text(listTemplates()),
  )

  return server
}

// ─── Entry point ──────────────────────────────────────────────────────────────

export async function main(): Promise<void> {
  const server = createServer()
  await server.connect(new StdioServerTransport())
}

// After bin install argv[1] may be a symlink, so compare real paths
const entry = process.argv[1] ? (() => { try { return realpathSync(process.argv[1]!) } catch { return resolve(process.argv[1]!) } })() : null
const isMain = entry !== null && import.meta.url === pathToFileURL(entry).href
if (isMain) {
  main().catch((err: unknown) => {
    console.error(err)
    process.exit(1)
  })
}
