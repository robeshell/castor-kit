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
 *   scaffold_feature      generates a module from a spec (or name / fields), incl. its OpenAPI entries
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
  if (!fallback) return Promise.resolve({ code: 1, stdout: '', stderr: `Unknown script: ${script}`, output: `Unknown script: ${script}` })
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
    throw new Error('No JSON in the output')
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
    return existsSync(path) ? readFileSync(path, 'utf8').trim() : `(${rel} does not exist)`
  }
  const examplesDir = join(ROOT, 'docs', 'examples', 'specs')
  const examples = existsSync(examplesDir) ? readdirSync(examplesDir).filter((f) => f.endsWith('.json')).sort() : []
  return [
    '# Module spec guide',
    '',
    'Validate with validate_spec first and confirm what will be generated, then generate with the spec parameter of scaffold_feature.',
    '',
    '## Requirement → spec examples (docs/examples/specs/README.md)',
    '',
    read('docs/examples/specs/README.md'),
    '',
    ...examples.flatMap((f) => [`## docs/examples/specs/${f}`, '', '```json', read(`docs/examples/specs/${f}`), '```', '']),
    '## JSON Schema (docs/spec.schema.json)',
    '',
    '```json',
    read('docs/spec.schema.json'),
    '```',
  ].join('\n')
}

export function projectContext(): string {
  const agentsMd = join(ROOT, 'AGENTS.md')
  const content = existsSync(agentsMd) ? readFileSync(agentsMd, 'utf8') : '(AGENTS.md does not exist)'

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
  return `${content}\n\n---\n\n## Current backend modules\n\n${beDomains.join('\n')}`
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
  const lines = [`${menus.length} menu items`, '']
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
  lines.push(`\nCurrent max ID: ${maxId}, suggested next ID: ${maxId + 1}`)
  return lines.join('\n')
}

export async function menuTree(): Promise<string> {
  const tsx = join(API_DIR, 'node_modules', '.bin', 'tsx')
  const res = await runCommand(existsSync(tsx) ? tsx : 'npx', [...(existsSync(tsx) ? [] : ['tsx']), '-e', MENU_QUERY_SCRIPT], API_DIR)
  if (res.code !== 0) return `Failed to query menus: ${res.output}`
  let menus: MenuRow[]
  try {
    menus = JSON.parse(res.stdout.trim()) as MenuRow[]
  } catch {
    return `Failed to query menus: ${res.output}`
  }
  return formatMenuTree(menus)
}

export function listTemplates(): string {
  const templatesDir = join(ROOT, 'docs', 'templates')
  if (!existsSync(templatesDir)) return 'The docs/templates/ directory does not exist; create the templates first.'
  const lines = ['Available code templates:', '']
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
  const server = new McpServer({ name: 'castor-kit', version: '0.3.0' })

  server.registerTool(
    'get_project_context',
    {
      description: 'Returns the castor-kit project context: the full AGENTS.md and the current module structure. Call this before implementing a new feature.',
      inputSchema: {},
    },
    async () => text(projectContext()),
  )

  server.registerTool(
    'get_menu_tree',
    {
      description: 'Returns the menu tree from the current database, for determining a new menu\'s parent_id and the next free ID.',
      inputSchema: {},
    },
    async () => text(await menuTree()),
  )

  server.registerTool(
    'get_spec_guide',
    {
      description:
        'Returns everything needed to write a module spec: the JSON Schema (field types, required properties, how to write options) and "one-line requirement → spec" examples with the reasoning for each field. ' +
        'Call before turning a requirement into a spec.',
      inputSchema: {},
    },
    async () => text(specGuide()),
  )

  server.registerTool(
    'validate_spec',
    {
      description:
        'Validates a module spec without generating any files: lists each problem (misspelled properties, missing Chinese title / field labels, defaults that don\'t match the type, etc.); ' +
        'when valid, describes the endpoints, permissions, table and menu that will be generated. Must pass before generating.',
      inputSchema: {
        spec: z.record(z.string(), z.unknown()).describe('Module spec object; see get_spec_guide for the format'),
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
        'Generates a complete module: db/schema table definition + schema/repository/service/routes + API tests + frontend page, ' +
        'registers it in db/schema/index.ts and router.ts, generates the drizzle migration and writes the OpenAPI docs; when the spec has menu, the menu and button permissions are written too. ' +
        'Prefer passing spec (validate it with validate_spec first); name / domain / fields are the shorthand (fields get no Chinese labels or options). Business logic still has to be added after generating.',
      inputSchema: {
        spec: z.record(z.string(), z.unknown()).optional().describe('Module spec object (recommended); see get_spec_guide for the format. When spec is given, name / domain / fields are ignored'),
        name: z.string().optional().describe('Shorthand: resource name, snake_case, e.g. customer'),
        domain: z.enum(['admin', 'component_center']).optional().describe('Shorthand: domain'),
        fields: z.string().optional().describe('Shorthand: field list, format "name:str,phone:str20,amount:float"'),
        dry_run: z.boolean().optional().default(false).describe('Preview only, write no files; default false'),
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
        return text('❌ Failed\n\nspec (recommended) or name is required')
      }
      return text(`${res.code === 0 ? '✅ Success' : '❌ Failed'}\n\n${cleanOutput(res.output)}`)
    },
  )

  server.registerTool(
    'check_openapi',
    {
      description:
        'Checks, per AGENTS.md "OpenAPI writing rules", that docs/apifox-full.openapi.json covers and correctly describes every endpoint, listing each non-conforming endpoint and why; ' +
        'call after changing routes, fields or validation. Does not modify files.',
      inputSchema: {},
    },
    async () => {
      const res = await runScript('openapi:generate', ['--dry-run', '--strict'])
      return text(`${res.code === 0 ? '✅ Docs follow the rules' : '❌ Docs do not follow the rules'}\n\n${cleanOutput(res.output).slice(-6000)}`)
    },
  )

  server.registerTool(
    'run_verify',
    {
      description: 'Runs the verify-feature.ts gate checks and returns structured JSON results. Must be called once a feature is implemented; it counts as delivered only when everything passes.',
      inputSchema: {
        module: z.string().describe('Module name, snake_case, e.g. customer'),
        skip_build: z.boolean().optional().default(false).describe('Skip the frontend build (slow); default false'),
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
      description: 'Runs pnpm seed:rbac -- --incremental to sync menus and permissions to the database.',
      inputSchema: {},
    },
    async () => {
      const res = await runScript('seed:rbac', ['--incremental'])
      return text(`${res.code === 0 ? '✅ RBAC sync succeeded' : '❌ RBAC sync failed'}\n\n${res.output.slice(-2000)}`)
    },
  )

  server.registerTool(
    'run_migration',
    {
      description: 'Runs drizzle-kit generate + pnpm db:migrate to generate and apply a database migration.',
      inputSchema: {
        message: z.string().describe('Migration description, e.g. "add customer table" (converted to drizzle-kit --name)'),
      },
    },
    async ({ message }) => {
      const generate = await runScript('db:generate', ['--name', migrationName(message ?? 'auto migration')])
      const migrate = await runScript('db:migrate')
      const passed = generate.code === 0 && migrate.code === 0
      return text(
        `${passed ? '✅ Migration succeeded' : '❌ Migration failed'}\n\ngenerate:\n${generate.output}\n\nmigrate:\n${migrate.output}`,
      )
    },
  )

  server.registerTool(
    'list_templates',
    {
      description: 'Returns the list of code templates available under docs/templates/.',
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
