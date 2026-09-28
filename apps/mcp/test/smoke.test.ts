/**
 * MCP smoke test: actually launches src/index.ts with the SDK's Client + StdioClientTransport and exercises the stdio protocol.
 *
 * Run: pnpm --filter @castorjs/mcp test
 * get_menu_tree needs a database: when TEST_DATABASE_URL is set it connects to that DB with NODE_ENV=test, otherwise it is skipped.
 */

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { after, before, describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

const MCP_DIR = join(dirname(fileURLToPath(import.meta.url)), '..')
const TOOLS = [
  'get_project_context',
  'get_menu_tree',
  'get_spec_guide',
  'validate_spec',
  'scaffold_feature',
  'check_openapi',
  'run_verify',
  'init_rbac',
  'run_migration',
  'list_templates',
]

type TextResult = { content: { type: string; text: string }[] }
const textOf = (res: unknown) => (res as TextResult).content.map((c) => c.text).join('\n')

describe('Castor MCP server (stdio)', () => {
  let client: Client

  before(async () => {
    const env: Record<string, string> = Object.fromEntries(
      Object.entries(process.env).filter((e): e is [string, string] => typeof e[1] === 'string'),
    )
    if (process.env.TEST_DATABASE_URL) env.NODE_ENV = 'test'
    const transport = new StdioClientTransport({
      command: join(MCP_DIR, 'node_modules', '.bin', 'tsx'),
      args: ['src/index.ts'],
      cwd: MCP_DIR,
      env,
      stderr: 'pipe',
    })
    client = new Client({ name: 'castor-smoke', version: '0.0.0' })
    await client.connect(transport)
  })

  after(async () => {
    await client?.close()
  })

  it('list_tools 返回 10 个工具及输入 schema', async () => {
    const { tools } = await client.listTools()
    assert.deepEqual(tools.map((t) => t.name).sort(), [...TOOLS].sort())
    const scaffold = tools.find((t) => t.name === 'scaffold_feature')!
    assert.deepEqual(Object.keys(scaffold.inputSchema.properties ?? {}).sort(), ['domain', 'dry_run', 'fields', 'name', 'spec'])
    assert.equal(scaffold.inputSchema.required, undefined)
    assert.deepEqual(tools.find((t) => t.name === 'validate_spec')!.inputSchema.required, ['spec'])
    const verify = tools.find((t) => t.name === 'run_verify')!
    assert.deepEqual(verify.inputSchema.required, ['module'])
  })

  it('list_templates 列出 backend / frontend 模板', async () => {
    const out = textOf(await client.callTool({ name: 'list_templates', arguments: {} }))
    assert.match(out, /^Available code templates:/)
    assert.match(out, /📁 backend\//)
    for (const f of ['routes.ts', 'service.ts', 'repository.ts', 'schema.ts', 'README.md']) assert.ok(out.includes(`   ${f}`), f)
    assert.match(out, /📁 frontend\//)
    assert.match(out, /list_page\/index\.tsx/)
  })

  it('get_project_context 返回 AGENTS.md + 当前后端模块', async () => {
    const out = textOf(await client.callTool({ name: 'get_project_context', arguments: {} }))
    assert.match(out, /Castor/)
    assert.match(out, /## Current backend modules/)
    assert.match(out, /\n {2}admin\/: .*users/)
    assert.match(out, /\n {2}component-center\/: /)
  })

  it('scaffold_feature dry_run 只预览不写文件', async () => {
    const out = textOf(
      await client.callTool({
        name: 'scaffold_feature',
        arguments: { name: 'ck_mcp_smoke', domain: 'component_center', fields: 'title:str,qty:int', dry_run: true },
      }),
    )
    assert.match(out, /^✅ Success/)
    assert.match(out, /\[dry-run\] would write: apps\/api\/src\/modules\/component-center\/ck-mcp-smoke\/routes\.ts/)
    assert.match(out, /Perm prefix: cc_ck_mcp_smoke/)
  })

  it('get_spec_guide 返回示例（含推断理由）与 JSON Schema', async () => {
    const out = textOf(await client.callTool({ name: 'get_spec_guide', arguments: {} }))
    assert.match(out, /## docs\/examples\/specs\/device\.json/)
    assert.match(out, /设备台账/)
    assert.match(out, /\| Why \|/)
    assert.match(out, /## JSON Schema/)
    assert.match(out, /"additionalProperties": false/)
    // Everything an agent needs in one call, but not an unbounded dump
    assert.ok(out.length < 40_000, `guide is ${out.length} characters`)
  })

  it('validate_spec：通过时说明会生成什么；有问题逐条列出', async () => {
    const device = JSON.parse(readFileSync(join(MCP_DIR, '..', '..', 'docs', 'examples', 'specs', 'device.json'), 'utf8'))
    const ok = textOf(await client.callTool({ name: 'validate_spec', arguments: { spec: device } }))
    assert.match(ok, /^✅ Spec is valid: device \(设备台账\)/)
    assert.match(ok, /API: \/api\/admin\/devices/)
    const bad = textOf(await client.callTool({ name: 'validate_spec', arguments: { spec: { name: 'x', fields: [{ name: 'a', type: 'str', requried: true }] } } }))
    assert.match(bad, /Missing title/)
    assert.match(bad, /Field a: unknown property requried/)
  })

  it('scaffold_feature 传 spec + dry_run：只预览，也会写接口文档', async () => {
    const spec = { name: 'ck_mcp_spec', title: '烟测', fields: [{ name: 'title', type: 'str', label: '标题' }] }
    const out = textOf(await client.callTool({ name: 'scaffold_feature', arguments: { spec, dry_run: true } }))
    assert.match(out, /^✅ Success/)
    assert.match(out, /\[dry-run\] would write: apps\/api\/src\/modules\/admin\/ck-mcp-spec\/routes\.ts/)
    assert.match(out, /\[dry-run\] would update: docs\/apifox-full\.openapi\.json/)
  })

  it('scaffold_feature 既没有 spec 也没有 name：失败', async () => {
    assert.match(textOf(await client.callTool({ name: 'scaffold_feature', arguments: {} })), /^❌ Failed/)
  })

  it('check_openapi：当前文档符合规范', async () => {
    const out = textOf(await client.callTool({ name: 'check_openapi', arguments: {} }))
    assert.match(out, /^✅ Docs follow the rules/)
    assert.match(out, /Docs check: every endpoint follows the rules/)
  })

  it('scaffold_feature 非法名称返回失败', async () => {
    const out = textOf(await client.callTool({ name: 'scaffold_feature', arguments: { name: 'BadName', dry_run: true } }))
    assert.match(out, /^❌ Failed/)
    assert.match(out, /snake_case/)
  })

  it('get_menu_tree 按层级输出并给出下一个可用 ID', { skip: !process.env.TEST_DATABASE_URL }, async () => {
    const out = textOf(await client.callTool({ name: 'get_menu_tree', arguments: {} }))
    assert.match(out, /^\d+ menu items/)
    assert.match(out, /ID=2 {2}系统管理 \(system\)/)
    // Nested under a group since the System menu was grouped: any indentation
    assert.match(out, /\n +ID=21 {2}用户管理 \(system_users\)/)
    assert.match(out, /Current max ID: \d+, suggested next ID: \d+/)
  })
})
