/**
 * AI chat: streams the model's reply as an AI SDK UI message stream (what `useChat` reads on the page).
 *
 * The page sends the conversation as UI messages; they are validated, converted to model messages and sent with the
 * system prompt through the model from common/ai.ts. Upstream problems never reach the client as-is: the stream ends
 * with a generic, translated error (status code only), and the details go to the server log.
 *
 * The timeout (60 s by default) bounds connecting, waiting for the response and each gap between chunks.
 */

import { convertToModelMessages, createUIMessageStream, createUIMessageStreamResponse, streamText, type UIMessage } from 'ai'
import type { Agent } from 'undici'
import { AI_CALL_DEFAULTS, aiConfigured, createAiAgent, languageModelFor, upstreamStatusOf } from '@/common/ai'
import { chatErrorMessage, parseChatMessages } from '@/common/ai-chat'
import { DEMO_MAX_OUTPUT_TOKENS } from '@/common/demo'
import type { Language } from '@/common/i18n'
import type { Settings } from '@/common/settings'
import type { AppConfig } from '@/config'

const UPSTREAM_TIMEOUT_MS = 60_000

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
    '- 编辑器：Monaco Editor（代码）、React Quill New（富文本）\n' +
    '- 权限：完整的 RBAC 菜单权限体系（用户/角色/菜单三张表）\n\n' +
    '## 核心功能模块\n' +
    '1. 系统管理：用户管理、角色权限、菜单管理、日志审计、数据字典、定时任务\n' +
    '2. 组件示例中心（共 36 个页面，6 组）：\n' +
    '   - 页面模板（每种页面模式一个参考实现，共用示例数据接口 /api/admin/component-center/demo-records）：标准列表、卡片列表、树形列表、统计列表、详情页、分步表单、动态表单、看板、甘特图、高级表格\n' +
    '   - 组件（每组公共组件一个用法展示页，附源码与属性表）：数据表格、表单、筛选、选择器、树、上传、导入导出、反馈、数据展示、Markdown、条件构造器\n' +
    '   - 数据可视化：数据大屏、实时折线图、热力日历图、流量转化分析\n' +
    '   - AI 应用：AI 对话（即你当前所在页面）、AI 提示词工坊、AI 数据查询\n' +
    '   - 编辑器：富文本、代码编辑器、JSON 编辑器、Markdown 预览\n' +
    '   - 工程工具：拖拽布局、虚拟滚动、WebSocket 通信、性能监控\n\n' +
    '## 开发约定\n' +
    '- API 路由统一前缀：/api/admin/...\n' +
    '- 前端动态路由：通过 import.meta.glob 扫描 pages/**/index.tsx\n' +
    '- 权限检查：hasMenuPermission(request, code) / menuPermissionRequired(code)（common/auth.ts）\n' +
    '- 默认账号：admin（密码以部署配置为准）\n' +
    '- 开发端口：后端 5001，前端 5173（Vite）\n\n' +
    '请使用用户提问所用的语言回答（中文提问用中文，English questions in English，日本語の質問には日本語で），回答要结合 castor-kit 的实际技术栈和实现方式。',
}

export interface ChatStreamOptions {
  timeoutMs?: number
  /** The AI API may be on an internal network (common/outbound.ts) */
  allowPrivate?: boolean
  /** Server-side log for upstream failures (the client only ever sees a generic message) */
  log?: { warn: (obj: unknown, msg: string) => void }
}

export class AiChatService {
  private readonly agent: Agent
  private readonly log: ChatStreamOptions['log']

  constructor(
    private readonly config: Partial<Pick<AppConfig, 'demoMode'>>,
    /** Current model settings (system settings → AI), read on every request */
    private readonly ai: () => Promise<Settings['ai']>,
    options: ChatStreamOptions = {},
  ) {
    this.log = options.log
    this.agent = createAiAgent(options.allowPrivate ?? false, options.timeoutMs ?? UPSTREAM_TIMEOUT_MS)
  }

  async isConfigured(): Promise<boolean> {
    return aiConfigured(await this.ai())
  }

  async close(): Promise<void> {
    await this.agent.destroy()
  }

  /** The request's messages as UI messages; 400 when empty or malformed */
  parseMessages(raw: unknown[]): Promise<UIMessage[]> {
    return parseChatMessages(raw)
  }

  /**
   * Start the reply. Resolves to a streaming Response (UI message stream); `signal` fires when the client disconnects
   * and aborts the upstream request; `lang` translates the error text sent inside the stream.
   */
  async stream(messages: UIMessage[], signal: AbortSignal, lang: Language = 'en-US'): Promise<Response> {
    const ai = await this.ai()
    const result = streamText({
      ...AI_CALL_DEFAULTS,
      model: languageModelFor(ai, this.agent),
      system: SYSTEM_PROMPT.content,
      messages: await convertToModelMessages(messages),
      abortSignal: signal,
      ...(this.config.demoMode ? { maxOutputTokens: DEMO_MAX_OUTPUT_TOKENS.chat } : {}),
      // Reported through the UI stream's onError below; this only keeps the SDK from printing to stderr
      onError: () => {},
    })
    const onError = (err: unknown) => {
      if (!signal.aborted) this.log?.warn({ err, status: upstreamStatusOf(err) }, 'AI 上游返回错误')
      return chatErrorMessage(err, lang)
    }
    // Merged into an outer stream: an error while reading the upstream body (e.g. it stalls) makes the model stream
    // throw instead of emitting an error chunk; the outer stream turns that into an error chunk as well
    const stream = createUIMessageStream({
      execute: ({ writer }) => writer.merge(result.toUIMessageStream({ onError })),
      onError,
    })
    return createUIMessageStreamResponse({ stream })
  }
}
