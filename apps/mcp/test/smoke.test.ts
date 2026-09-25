/**
 * MCP smoke test: actually launches src/index.ts with the SDK's Client + StdioClientTransport and exercises the stdio protocol.
 *
 * Run: pnpm --filter @castor-kit/mcp test
 * get_menu_tree needs a database: when TEST_DATABASE_URL is set it connects to that DB with NODE_ENV=test, otherwise it is skipped.
 */

import assert from 'node:assert/strict'
import { dirname, join } from 'node:path'
import { after, before, describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

const MCP_DIR = join(dirname(fileURLToPath(import.meta.url)), '..')
const TOOLS = ['get_project_context', 'get_menu_tree', 'scaffold_feature', 'run_verify', 'init_rbac', 'run_migration', 'list_templates']

type TextResult = { content: { type: string; text: string }[] }
const textOf = (res: unknown) => (res as TextResult).content.map((c) => c.text).join('\n')

describe('castor-kit MCP server (stdio)', () => {
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
    client = new Client({ name: 'castor-kit-smoke', version: '0.0.0' })
    await client.connect(transport)
  })

  after(async () => {
    await client?.close()
  })

  it('list_tools 返回 7 个工具及输入 schema', async () => {
    const { tools } = await client.listTools()
    assert.deepEqual(tools.map((t) => t.name).sort(), [...TOOLS].sort())
    const scaffold = tools.find((t) => t.name === 'scaffold_feature')!
    assert.deepEqual(Object.keys(scaffold.inputSchema.properties ?? {}).sort(), ['domain', 'dry_run', 'fields', 'name'])
    assert.deepEqual(scaffold.inputSchema.required, ['name'])
    const verify = tools.find((t) => t.name === 'run_verify')!
    assert.deepEqual(verify.inputSchema.required, ['module'])
  })

  it('list_templates 列出 backend / frontend 模板', async () => {
    const out = textOf(await client.callTool({ name: 'list_templates', arguments: {} }))
    assert.match(out, /^可用代码模板：/)
    assert.match(out, /📁 backend\//)
    for (const f of ['routes.ts', 'service.ts', 'repository.ts', 'schema.ts', 'README.md']) assert.ok(out.includes(`   ${f}`), f)
    assert.match(out, /📁 frontend\//)
    assert.match(out, /list_page\/index\.jsx/)
  })

  it('get_project_context 返回 AGENTS.md + 当前后端模块', async () => {
    const out = textOf(await client.callTool({ name: 'get_project_context', arguments: {} }))
    assert.match(out, /castor-kit/)
    assert.match(out, /## 当前后端模块/)
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
    assert.match(out, /^✅ 成功/)
    assert.match(out, /\[dry-run\] would write: apps\/api\/src\/modules\/component-center\/ck-mcp-smoke\/routes\.ts/)
    assert.match(out, /Perm prefix: cc_ck_mcp_smoke/)
  })

  it('scaffold_feature 非法名称返回失败', async () => {
    const out = textOf(await client.callTool({ name: 'scaffold_feature', arguments: { name: 'BadName', dry_run: true } }))
    assert.match(out, /^❌ 失败/)
    assert.match(out, /snake_case/)
  })

  it('get_menu_tree 按层级输出并给出下一个可用 ID', { skip: !process.env.TEST_DATABASE_URL }, async () => {
    const out = textOf(await client.callTool({ name: 'get_menu_tree', arguments: {} }))
    assert.match(out, /^共 \d+ 个菜单项/)
    assert.match(out, /ID=2 {2}系统管理 \(system\)/)
    assert.match(out, /\n {2}ID=21 {2}用户管理 \(system_users\)/)
    assert.match(out, /当前最大 ID：\d+，建议下一个 ID：\d+/)
  })
})
