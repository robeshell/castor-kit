import type { ShadowCase } from './types'

/**
 * AI 对话 SSE。shadow 只比较不依赖 AI 配置的错误分支；依赖配置的用例（消息为空、流式内容）只在
 * SHADOW_FAKE_AI=1 时启用：两个后端都要以 `AI_API_BASE=http://127.0.0.1:<port> AI_API_KEY=fake-key AI_MODEL=fake-model`
 * 启动并指向同一个假上游（`npx tsx test/cc-ai-fake-upstream.ts 5178`），绝不能指向真实 AI 服务。
 * text/event-stream 的响应体按原始文本逐字比较。
 * 非 list 的 messages 在 Flask 里是未捕获 TypeError（debug oracle 返回 Werkzeug 调试页），由 vitest 覆盖。
 */
const FAKE_AI = process.env.SHADOW_FAKE_AI === '1'
const PATH = '/api/admin/component-center/ai/chat/stream'

const chat = (name: string, body: unknown): ShadowCase => ({ name, method: 'POST', path: PATH, body, auth: true })
const say = (name: string, content: string) => chat(name, { messages: [{ role: 'user', content }] })

export const cases: ShadowCase[] = [
  { name: '未登录', method: 'POST', path: PATH, body: { messages: [{ role: 'user', content: 'x' }] } },
  { name: '缺 CSRF', method: 'POST', path: PATH, body: { messages: [] }, auth: true, noCsrf: true },
  { name: 'GET → 404', path: PATH, auth: true },
  ...(FAKE_AI
    ? [
        chat('messages 缺失', {}),
        chat('messages 空数组', { messages: [] }),
        chat('messages null', { messages: null }),
        chat('messages 空串', { messages: '' }),
        say('流式：正常（中文/引号/换行/emoji/控制字符）', 'hello'),
        say('流式：各种畸形行被跳过、[DONE] 前后空白', 'garbage'),
        say('流式：上游没发 [DONE]', 'nodone'),
        say('流式：CRLF / CR 分行 + 分块切在多字节字符中间', 'crlf'),
        say('流式：非法 UTF-8 → 通用错误', 'badutf8'),
        say('流式：上游 502 不透传响应体', 'status:502'),
        say('流式：上游 401', 'status:401'),
        say('流式：上游 200 以外的 2xx', 'status:201'),
      ]
    : []),
]
