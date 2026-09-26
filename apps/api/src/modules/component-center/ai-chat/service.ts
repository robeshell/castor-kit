/**
 * AI chat SSE stream
 *
 * Upstream is an OpenAI-compatible API (`${AI_API_BASE}/chat/completions`, stream:true). Parses `data:` line by line,
 * forwards `choices[0].delta.content` as `data: {"content": "..."}\n\n`, and ends with `data: [DONE]\n\n`.
 * Event text follows the `json.dumps(..., ensure_ascii=False)` format (separators `", "` / `": "`, non-ASCII kept as-is).
 *
 * 60 s timeout: timeout while connecting / waiting for response headers → `请求超时，请重试`;
 * timeout while reading the stream → generic message `AI 响应异常，请稍后重试`.
 */

import { Agent, fetch } from 'undici'
import { pyTruthy } from '@/common/py'
import { translateMessage, type Language } from '@/common/i18n'
import { pyJsonDumps } from '@/common/request-meta'
import { DEMO_MAX_OUTPUT_TOKENS } from '@/common/demo'
import type { AppConfig } from '@/config'
import type { Settings } from '@/common/settings'
import { pyStrip } from '../ai-sql/schema'

const UPSTREAM_TIMEOUT_MS = 60_000
const DONE_EVENT = 'data: [DONE]\n\n'

/** Injected system prompt: describes castor-kit's positioning, tech stack, feature modules and dev conventions */
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
    '请使用用户提问所用的语言回答（中文提问用中文，English questions in English，日本語の質問には日本語で），回答要结合 castor-kit 的实际技术栈和实现方式。',
}

/** `data: {json.dumps(obj, ensure_ascii=False)}\n\n` (obj has a single key) */
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
 * Extract `chunk['choices'][0]['delta'].get('content', '')` from one data: payload;
 * returns undefined on a shape mismatch (missing field, wrong type, empty choices, etc.) → the line is skipped
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

/** requests.iter_lines(): split lines on \r\n / \r / \n (at the byte level), strictly UTF-8 decoding each line */
async function* iterLines(body: AsyncIterable<Uint8Array>): AsyncGenerator<string> {
  const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true })
  let pending = Buffer.alloc(0)
  for await (const chunk of body) {
    pending = pending.length ? Buffer.concat([pending, chunk]) : Buffer.from(chunk)
    let start = 0
    for (let i = 0; i < pending.length; i++) {
      const b = pending[i]
      if (b !== 0x0a && b !== 0x0d) continue
      // \r landed exactly at the end of a chunk: wait for the next chunk to tell whether it is \r\n
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
  /** Server-side log for upstream failures (the client only ever sees a generic message) */
  log?: { warn: (obj: unknown, msg: string) => void }
}

export class AiChatService {
  private readonly dispatcher: Agent
  private readonly log: ChatStreamOptions['log']

  constructor(
    private readonly config: Partial<Pick<AppConfig, 'demoMode'>>,
    /** Current model settings (system settings → AI), read on every request */
    private readonly ai: () => Promise<Settings['ai']>,
    options: ChatStreamOptions = {},
  ) {
    const timeout = options.timeoutMs ?? UPSTREAM_TIMEOUT_MS
    this.log = options.log
    this.dispatcher = new Agent({ connect: { timeout }, headersTimeout: timeout, bodyTimeout: timeout })
  }

  async isConfigured(): Promise<boolean> {
    return Boolean((await this.ai()).apiKey)
  }

  async close(): Promise<void> {
    await this.dispatcher.destroy()
  }

  /**
   * Yields SSE event text. messages is the full history from the frontend (already validated as a non-empty array); the system prompt is prepended.
   * signal fires when the client disconnects and is used to abort the upstream request.
   * lang translates the error events: SSE bypasses the JSON response translation hook.
   */
  async *stream(messages: unknown[], signal: AbortSignal, lang: Language = 'zh-CN'): AsyncGenerator<string> {
    const { apiBase: aiApiBase, apiKey: aiApiKey, model: aiModel } = await this.ai()
    const fullMessages = [SYSTEM_PROMPT, ...messages]
    try {
      const resp = await fetch(`${aiApiBase}/chat/completions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${aiApiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: aiModel,
          messages: fullMessages,
          stream: true,
          ...(this.config.demoMode ? { max_tokens: DEMO_MAX_OUTPUT_TOKENS.chat } : {}),
        }),
        dispatcher: this.dispatcher,
        signal,
      })

      if (resp.status !== 200) {
        // Don't pass the upstream response body through to the client (it may contain internal info); only a generic error code.
        // Log the start of it server-side so the cause (bad model name, quota, overload...) is visible in the logs.
        const detail = await resp.text().catch(() => '')
        this.log?.warn({ status: resp.status, body: detail.slice(0, 500) }, 'AI 上游返回错误')
        yield event('error', translateMessage(`AI 服务暂时不可用（${resp.status}），请稍后重试`, lang))
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
        yield event('error', translateMessage('请求超时，请重试', lang))
      } else {
        // Don't send the raw exception to the client (it may contain internal details); generic message only
        yield event('error', translateMessage('AI 响应异常，请稍后重试', lang))
      }
      yield DONE_EVENT
    }
  }
}
