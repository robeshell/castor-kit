#!/usr/bin/env node
/**
 * castor-kit MCP Server
 *
 * 把 castor-kit 开发工具暴露为 MCP 协议，让 Claude Desktop 等 MCP 客户端无需命令行即可驱动完整的功能开发流程。
 *
 * 配置到 Claude Desktop（~/Library/Application Support/Claude/claude_desktop_config.json）：
 *   {
 *     "mcpServers": {
 *       "castor-kit": {
 *         "command": "pnpm",
 *         "args": ["--dir", "/path/to/castor-kit", "-s", "mcp"]
 *       }
 *     }
 *   }
 * 或构建后直接用 node：`pnpm --filter @castor-kit/mcp build` → `node /path/to/castor-kit/apps/mcp/dist/index.js`
 *
 * 工具列表：
 *   get_project_context   返回 AGENTS.md + 当前模块树（Step 1 用）
 *   get_menu_tree         返回当前菜单结构（推断 parent_id 用）
 *   scaffold_feature      生成代码骨架文件（pnpm scaffold）
 *   run_verify            运行 pnpm verify --json，返回 JSON
 *   init_rbac             运行 pnpm seed:rbac -- --incremental
 *   run_migration         pnpm db:generate + pnpm db:migrate
 *   list_templates        返回可用模板列表
 *
 * 仓库根目录默认取本文件向上三级（src/ 与 dist/ 同深度），可用 CASTOR_KIT_ROOT 覆盖。
 * 子命令优先用 pnpm；PATH 里没有 pnpm 时直接用 apps/api/node_modules/.bin 下的 tsx / drizzle-kit。
 */

import { spawn, spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, realpathSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'

export const ROOT = resolve(process.env.CASTOR_KIT_ROOT ?? join(dirname(fileURLToPath(import.meta.url)), '../../..'))
const API_DIR = join(ROOT, 'apps', 'api')

// ─── 子进程 ────────────────────────────────────────────────────────────────────

interface RunResult {
  code: number
  stdout: string
  stderr: string
  /** stdout + stderr（合并输出） */
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

/** 根 package.json 的脚本 → 无 pnpm 时的等价直接调用（cwd = apps/api） */
const SCRIPT_FALLBACK: Record<string, { bin: string; args: string[] }> = {
  scaffold: { bin: 'tsx', args: ['scripts/scaffold.ts'] },
  verify: { bin: 'tsx', args: ['scripts/verify-feature.ts'] },
  'seed:rbac': { bin: 'tsx', args: ['scripts/seed-rbac.ts'] },
  'db:migrate': { bin: 'tsx', args: ['src/db/migrate-cli.ts'] },
  'db:generate': { bin: 'drizzle-kit', args: ['generate'] },
}

/**
 * 运行根 package.json 里的脚本：`pnpm -s <script> -- ...args`。
 * drizzle-kit 不认识 `--`（castor-kit 自己的脚本会忽略它），db:generate 直接跟参数。
 */
export function runScript(script: string, args: string[] = []): Promise<RunResult> {
  const dash = script === 'db:generate' ? [] : ['--']
  if (hasPnpm()) return runCommand('pnpm', ['-s', script, ...(args.length > 0 ? [...dash, ...args] : [])], ROOT)
  const fallback = SCRIPT_FALLBACK[script]
  if (!fallback) return Promise.resolve({ code: 1, stdout: '', stderr: `未知脚本：${script}`, output: `未知脚本：${script}` })
  const bin = join(API_DIR, 'node_modules', '.bin', fallback.bin)
  return runCommand(bin, [...fallback.args, ...args], API_DIR)
}

/** 从混有其他输出的 stdout 中取出 JSON 对象 */
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

// ─── 工具实现 ──────────────────────────────────────────────────────────────────

type ToolResult = { content: { type: 'text'; text: string }[] }
const text = (value: string): ToolResult => ({ content: [{ type: 'text', text: value }] })

export function projectContext(): string {
  const agentsMd = join(ROOT, 'AGENTS.md')
  const content = existsSync(agentsMd) ? readFileSync(agentsMd, 'utf8') : '（AGENTS.md 不存在）'

  // 当前模块列表：apps/api/src/modules/<domain>/<module>/
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

/** 用 apps/api 的配置（NODE_ENV → .env.<env>）连库查询菜单；在 apps/api 目录里用 tsx 执行以复用其依赖 */
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

/** 迁移描述 → drizzle-kit --name（只允许小写字母数字下划线） */
export function migrationName(message: string): string {
  const slug = message
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return slug || 'auto_migration'
}

// ─── 服务器 ────────────────────────────────────────────────────────────────────

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
    'scaffold_feature',
    {
      description:
        '根据规格生成代码骨架文件（db/schema 表定义 + schema/repository/service/routes + 前端页面），' +
        '自动注册到 db/schema/index.ts 与 router.ts 并生成 drizzle 迁移。生成后还需补充业务逻辑。',
      inputSchema: {
        name: z.string().describe('资源名，snake_case，如 customer'),
        domain: z.enum(['admin', 'component_center']).optional().describe('所属域'),
        fields: z.string().optional().describe('字段列表，格式 "name:str,phone:str20,amount:float"'),
        dry_run: z.boolean().optional().default(false).describe('只预览不写文件，默认 false'),
      },
    },
    async ({ name, domain, fields, dry_run }) => {
      const args = ['--name', name, '--domain', domain ?? 'admin', '--fields', fields ?? 'name:str']
      if (dry_run) args.push('--dry-run')
      const res = await runScript('scaffold', args)
      return text(`${res.code === 0 ? '✅ 成功' : '❌ 失败'}\n\n${res.output}`)
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

// ─── 入口 ──────────────────────────────────────────────────────────────────────

export async function main(): Promise<void> {
  const server = createServer()
  await server.connect(new StdioServerTransport())
}

// bin 安装后 argv[1] 可能是符号链接，按真实路径比较
const entry = process.argv[1] ? (() => { try { return realpathSync(process.argv[1]!) } catch { return resolve(process.argv[1]!) } })() : null
const isMain = entry !== null && import.meta.url === pathToFileURL(entry).href
if (isMain) {
  main().catch((err: unknown) => {
    console.error(err)
    process.exit(1)
  })
}
