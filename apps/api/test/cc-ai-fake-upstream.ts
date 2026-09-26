/**
 * Fake OpenAI-compatible upstream (/chat/completions): used by the AI chat / AI data query vitest suites; never calls a real AI.
 *
 * Behavior is determined by the content of the last message (streaming = ai_chat, non-streaming = ai_sql's call_llm, using the text after "问题：").
 *
 * vitest: `const up = await startFakeUpstream()`, `buildTestApp({ settingsEnv: { AI_API_BASE: up.url, AI_API_KEY: 'x', AI_MODEL: 'm' } })`
 */

import { createHash } from 'node:crypto'
import { createServer, type IncomingMessage, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { fileURLToPath } from 'node:url'

export interface FakeRequest {
  headers: IncomingMessage['headers']
  body: { model?: unknown; messages?: { role: string; content: unknown }[]; stream?: unknown }
  /** Set to true when the client (the backend under test) disconnects before the response ends */
  aborted: boolean
}

export interface FakeUpstream {
  url: string
  requests: FakeRequest[]
  /** 'gate' scenario: after sending the first chunk, wait for release() before continuing */
  release: () => void
  close: () => Promise<void>
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
export const sseChunk = (content: unknown) => `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`
/** Last chunk of a complete reply: the AI SDK treats a stream without a finish reason as cut off */
export const FINISH = `data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: 'stop' }] })}\n\ndata: [DONE]\n\n`

/** Content chunks sent in the default streaming scenario (includes Chinese, quotes, backslashes, newlines, emoji, control characters, U+2028) */
export const DEFAULT_PIECES = ['你好', '，"引号" \\ 反斜杠', '\n换行\t制表', '😀 emoji', '\u2028sep\u0001ctl', '</script>']

export async function startFakeUpstream(port = 0): Promise<FakeUpstream> {
  const requests: FakeRequest[] = []
  let releaseGate: () => void = () => {}
  let gate = new Promise<void>((r) => (releaseGate = r))

  const server: Server = createServer(async (req, res) => {
    const bufs: Buffer[] = []
    for await (const b of req) bufs.push(b as Buffer)
    let body: FakeRequest['body'] = {}
    try {
      body = JSON.parse(Buffer.concat(bufs).toString('utf8'))
    } catch {
      /* Non-JSON request body */
    }
    const record: FakeRequest = { headers: req.headers, body, aborted: false }
    requests.push(record)
    res.on('close', () => {
      if (!res.writableFinished) record.aborted = true
    })
    const messages = Array.isArray(body.messages) ? body.messages : []
    const last = String(messages.at(-1)?.content ?? '')

    // Tool calling (AI assistant): the user message "tool:<name> <json args>" makes the model call that tool;
    // once the last message is the tool's result, the model answers "result: <start of the result>"
    if (body.stream && Array.isArray((body as { tools?: unknown }).tools)) {
      res.writeHead(200, { 'content-type': 'text/event-stream' })
      const lastMessage = messages.at(-1) as { role?: string; content?: unknown } | undefined
      if (lastMessage?.role === 'tool') {
        res.write(sseChunk(`result: ${String(lastMessage.content).slice(0, 300)}`))
        return res.end(FINISH)
      }
      const call = /^tool:(\w+)\s+([\s\S]*)$/.exec(last)
      if (!call) {
        res.write(sseChunk(`plain answer to: ${last}`))
        return res.end(FINISH)
      }
      const toolCall = { index: 0, id: `call_${requests.length}`, type: 'function', function: { name: call[1], arguments: call[2] } }
      res.write(`data: ${JSON.stringify({ choices: [{ delta: { role: 'assistant', tool_calls: [toolCall] } }] })}\n\n`)
      res.write(`data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: 'tool_calls' }] })}\n\n`)
      return res.end('data: [DONE]\n\n')
    }

    if (body.stream) {
      const status = /^status:(\d+)$/.exec(last)
      if (status) {
        res.writeHead(Number(status[1]), { 'content-type': 'text/plain' })
        return res.end('upstream secret detail')
      }
      if (last === 'hang-headers') return // Never responds
      res.writeHead(200, { 'content-type': 'text/event-stream' })
      if (last === 'hang-body') {
        res.write(sseChunk('first'))
        return // Sends one chunk, then hangs
      }
      if (last === 'gate') {
        res.write(sseChunk('first'))
        await gate
        gate = new Promise<void>((r) => (releaseGate = r))
        if (!res.destroyed) {
          res.write(sseChunk('second'))
          res.end(FINISH)
        }
        return
      }
      if (last === 'demo:markdown') {
        // For trying the chat page by hand: a short markdown reply with a list, a table and a code block
        const text =
          '## 示例回复\n\n用 **castor-kit** 新增一个模块：\n\n1. 运行脚手架\n2. 补充业务逻辑\n\n| 命令 | 作用 |\n|---|---|\n| `pnpm scaffold` | 生成模块 |\n\n```ts\nexport async function hello(name: string): Promise<string> {\n  return `Hello, ${name}`\n}\n```\n'
        for (let i = 0; i < text.length; i += 12) {
          res.write(sseChunk(text.slice(i, i + 12)))
          await sleep(30)
        }
        return res.end(FINISH)
      }
      if (last === 'cutoff') {
        // Ends without a finish reason (connection dropped mid-reply)
        res.write(sseChunk('only'))
        return res.end()
      }
      if (last === 'slow') {
        res.write(sseChunk('first'))
        await sleep(300)
        res.write(sseChunk('second'))
        return res.end(FINISH)
      }
      for (const piece of DEFAULT_PIECES) {
        res.write(sseChunk(piece))
        await sleep(5)
      }
      return res.end(FINISH)
    }

    // Non-streaming (ai_sql call_llm)
    const q = /问题：([\s\S]*)$/.exec(last)?.[1] ?? ''
    const reply = (content: unknown) => {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ choices: [{ message: { content } }] }))
    }
    if (q === 'q:status500') {
      res.writeHead(500)
      return res.end('boom')
    }
    if (q === 'q:status429') {
      res.writeHead(429)
      return res.end('RESOURCE_EXHAUSTED')
    }
    if (q === 'q:notjson') {
      res.writeHead(200)
      return res.end('not json')
    }
    if (q === 'q:nocontent') {
      res.writeHead(200, { 'content-type': 'application/json' })
      return res.end('{"choices":[{"message":{}}]}')
    }
    if (q === 'q:nochoices') {
      res.writeHead(200, { 'content-type': 'application/json' })
      return res.end('{"x":1}')
    }
    if (q === 'q:hang') return
    if (q === 'q:unsafe') return reply('DELETE FROM kanban_boards')
    if (q === 'q:badsql') return reply('SELECT * FROM no_such_table_xyz')
    if (q === 'q:fence') return reply('```sql\nSELECT 1 AS one;\n```')
    if (q === 'q:hash') {
      // When the system prompt + schema text + question are identical, both backends get the same hash
      const h = createHash('sha256').update(JSON.stringify(messages)).digest('hex')
      return reply(`SELECT '${h}' AS prompt_hash`)
    }
    return reply('SELECT id, title FROM kanban_boards ORDER BY id LIMIT 3')
  })

  await new Promise<void>((resolve) => server.listen(port, '127.0.0.1', resolve))
  const { port: actual } = server.address() as AddressInfo
  return {
    url: `http://127.0.0.1:${actual}`,
    requests,
    release: () => releaseGate(),
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections()
        server.close(() => resolve())
      }),
  }
}

// CLI：npx tsx test/cc-ai-fake-upstream.ts <port>
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const up = await startFakeUpstream(Number(process.argv[2] ?? 5178))
  console.log(`fake upstream on ${up.url}`)
}
