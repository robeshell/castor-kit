/**
 * AI 对话 SSE 流
 *
 * 上游是 OpenAI 兼容接口（`${AI_API_BASE}/chat/completions`，stream:true）。逐行解析 `data:`，
 * 把 `choices[0].delta.content` 转发为 `data: {"content": "..."}\n\n`，结束发 `data: [DONE]\n\n`。
 * 事件文本按 `json.dumps(..., ensure_ascii=False)` 的格式输出（分隔符 `", "` / `": "`，非 ASCII 原样保留）。
 *
 * 超时 60 秒：连接/等响应头超时 → `请求超时，请重试`；
 * 读流过程中超时 → 通用文案 `AI 响应异常，请稍后重试`。
 */

import { Agent, fetch } from 'undici'
import { pyTruthy } from '@/common/py'
import { pyJsonDumps } from '@/common/request-meta'
import type { AppConfig } from '@/config'
import { pyStrip } from '../ai-sql/schema'

const UPSTREAM_TIMEOUT_MS = 60_000
const DONE_EVENT = 'data: [DONE]\n\n'

/** 注入的系统提示词：介绍 castor-kit 的定位、技术栈、功能模块与开发约定 */
export const SYSTEM_PROMPT = {
  role: 'system',
  content:
    '你是 castor-kit 项目的专属 AI 助手。\n\n' +
    '## 关于 castor-kit\n' +
    'castor-kit 是一个 AI-First 的企业级全栈脚手架（Node.js + React），核心理念是：PM 用自然语言描述需求，AI Agent 端到端实现功能。\n\n' +
    '## 技术栈\n' +
    '- 后端：Node.js 22 + Fastify 5 + TypeScript + Zod + Drizzle ORM + PostgreSQL\n' +
    '- 前端：React 19 + Vite + React Router + Tailwind CSS v4\n' +
    '- UI：shadcn/ui（Radix 原语）+ motion 动效 + lucide 图标\n' +
    '- 图表：ECharts 6\n' +
    '- 3D：Three.js\n' +
    '- 编辑器：Monaco Editor（代码）、React Quill New（富文本）\n' +
    '- 权限：完整的 RBAC 菜单权限体系（用户/角色/菜单三张表）\n\n' +
    '## 核心功能模块\n' +
    '1. 系统管理：用户管理、角色权限、菜单管理、日志审计、数据字典、定时任务\n' +
    '2. 组件示例中心（共 28 个页面）：\n' +
    '   - 管理系统类：列表页、统计列表、卡片列表、树形列表、动态表单、看板、详情标签、甘特图、高级表格\n' +
    '   - 数据可视化：数据大屏、实时折线图、热力日历图、地图热力图\n' +
    '   - 3D/创意：粒子连线、CSS 3D 卡片、Three.js 地球、粒子形态变换\n' +
    '   - AI 应用：AI 对话（即你当前所在页面）、AI 提示词工坊、AI 数据查询\n' +
    '   - 编辑器：富文本、代码编辑器、JSON 编辑器、Markdown 预览\n' +
    '   - 工程工具：拖拽布局、虚拟滚动、WebSocket 通信、性能监控\n\n' +
    '## 开发约定\n' +
    '- API 路由统一前缀：/api/admin/...\n' +
    '- 前端动态路由：通过 import.meta.glob 扫描 pages/**/index.jsx\n' +
    '- 权限检查：hasMenuPermission(request, code) / menuPermissionRequired(code)（common/auth.ts）\n' +
    '- 默认账号：admin（密码以部署配置为准）\n' +
    '- 开发端口：后端 5001，前端 5173（Vite）\n\n' +
    '请用中文回答，回答要结合 castor-kit 的实际技术栈和实现方式。',
}

/** `data: {json.dumps(obj, ensure_ascii=False)}\n\n`（obj 只有一个键） */
function event(key: string, value: unknown): string {
  return `data: {${JSON.stringify(key)}: ${pyJsonDumps(value)}}\n\n`
}

const TIMEOUT_CODES = new Set(['UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_HEADERS_TIMEOUT'])

function isRequestTimeout(err: unknown): boolean {
  let cur: unknown = err
  for (let depth = 0; cur && depth < 5; depth++) {
    const code = (cur as { code?: unknown }).code
    if (typeof code === 'string' && TIMEOUT_CODES.has(code)) return true
    cur = (cur as { cause?: unknown }).cause
  }
  return false
}

/**
 * 从一行 data: 负载里取 `chunk['choices'][0]['delta'].get('content', '')`；
 * 结构不符（缺字段、类型不对、choices 为空等）返回 undefined → 跳过该行
 */
function extractContent(chunk: unknown): unknown {
  if (!chunk || typeof chunk !== 'object' || Array.isArray(chunk)) return undefined
  if (!Object.hasOwn(chunk, 'choices')) return undefined
  const choices = (chunk as { choices: unknown }).choices
  if (!Array.isArray(choices) || choices.length === 0) return undefined
  const first: unknown = choices[0]
  if (!first || typeof first !== 'object' || Array.isArray(first) || !Object.hasOwn(first, 'delta')) return undefined
  const delta = (first as { delta: unknown }).delta
  if (!delta || typeof delta !== 'object' || Array.isArray(delta)) return undefined
  return Object.hasOwn(delta, 'content') ? (delta as { content: unknown }).content : ''
}

/** requests.iter_lines()：按 \r\n / \r / \n 切行（字节层面），每行严格 UTF-8 解码 */
async function* iterLines(body: AsyncIterable<Uint8Array>): AsyncGenerator<string> {
  const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true })
  let pending = Buffer.alloc(0)
  for await (const chunk of body) {
    pending = pending.length ? Buffer.concat([pending, chunk]) : Buffer.from(chunk)
    let start = 0
    for (let i = 0; i < pending.length; i++) {
      const b = pending[i]
      if (b !== 0x0a && b !== 0x0d) continue
      // \r 恰好在块末尾：等下一块确认是不是 \r\n
      if (b === 0x0d && i === pending.length - 1) break
      yield decoder.decode(pending.subarray(start, i))
      if (b === 0x0d && pending[i + 1] === 0x0a) i++
      start = i + 1
    }
    pending = pending.subarray(start)
  }
  if (pending.length) {
    const tail = pending[pending.length - 1] === 0x0d ? pending.subarray(0, -1) : pending
    yield decoder.decode(tail)
  }
}

export interface ChatStreamOptions {
  timeoutMs?: number
}

export class AiChatService {
  private readonly dispatcher: Agent

  constructor(
    private readonly config: Pick<AppConfig, 'aiApiBase' | 'aiApiKey' | 'aiModel'>,
    options: ChatStreamOptions = {},
  ) {
    const timeout = options.timeoutMs ?? UPSTREAM_TIMEOUT_MS
    this.dispatcher = new Agent({ connect: { timeout }, headersTimeout: timeout, bodyTimeout: timeout })
  }

  get configured(): boolean {
    return Boolean(this.config.aiApiKey)
  }

  async close(): Promise<void> {
    await this.dispatcher.destroy()
  }

  /**
   * 产出 SSE 事件文本。messages 为前端传来的完整历史（已校验为非空数组），前面注入系统提示词。
   * signal 在客户端断开时触发，用于中止上游请求。
   */
  async *stream(messages: unknown[], signal: AbortSignal): AsyncGenerator<string> {
    const { aiApiBase, aiApiKey, aiModel } = this.config
    const fullMessages = [SYSTEM_PROMPT, ...messages]
    try {
      const resp = await fetch(`${aiApiBase}/chat/completions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${aiApiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: aiModel, messages: fullMessages, stream: true }),
        dispatcher: this.dispatcher,
        signal,
      })

      if (resp.status !== 200) {
        // 不向客户端透传上游响应体（可能含内部信息），仅给通用错误码
        await resp.body?.cancel().catch(() => {})
        yield event('error', `AI 服务暂时不可用（${resp.status}），请稍后重试`)
        yield DONE_EVENT
        return
      }

      if (resp.body) {
        for await (const line of iterLines(resp.body)) {
          if (!line) continue
          if (!line.startsWith('data:')) continue
          const raw = pyStrip(line.slice(5))
          if (raw === '[DONE]') {
            yield DONE_EVENT
            return
          }
          let content: unknown
          try {
            content = extractContent(JSON.parse(raw))
          } catch {
            continue
          }
          if (pyTruthy(content)) yield event('content', content)
        }
      }
      yield DONE_EVENT
    } catch (err) {
      if (signal.aborted) return
      if (isRequestTimeout(err)) {
        yield event('error', '请求超时，请重试')
      } else {
        // 不向客户端输出原始异常（可能含内部细节），仅通用文案
        yield event('error', 'AI 响应异常，请稍后重试')
      }
      yield DONE_EVENT
    }
  }
}
