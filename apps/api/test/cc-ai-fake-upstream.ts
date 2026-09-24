/**
 * 假 OpenAI 兼容上游（/chat/completions）：AI 对话 / AI 数据查询的 vitest 与 shadow-diff 共用，绝不调用真实 AI。
 *
 * 行为由最后一条消息的内容决定（流式 = ai_chat，非流式 = ai_sql 的 call_llm，取“问题：”之后的文本）。
 *
 * vitest：`const up = await startFakeUpstream()`，`buildTestApp({ aiApiBase: up.url, aiApiKey: 'x', aiModel: 'm' })`
 * shadow-diff：`npx tsx test/cc-ai-fake-upstream.ts 5178`，Flask 与 Node 都以
 *   `AI_API_BASE=http://127.0.0.1:5178 AI_API_KEY=fake-key AI_MODEL=fake-model` 启动，再加 `SHADOW_FAKE_AI=1` 跑 shadow-diff
 */

import { createHash } from 'node:crypto'
import { createServer, type IncomingMessage, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { fileURLToPath } from 'node:url'

export interface FakeRequest {
  headers: IncomingMessage['headers']
  body: { model?: unknown; messages?: { role: string; content: unknown }[]; stream?: unknown }
  /** 客户端（被测后端）在响应结束前断开时置 true */
  aborted: boolean
}

export interface FakeUpstream {
  url: string
  requests: FakeRequest[]
  /** 'gate' 场景：发出第一块后等待 release() 才继续 */
  release: () => void
  close: () => Promise<void>
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
export const sseChunk = (content: unknown) => `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`

/** 默认流式场景下发的内容片段（含中文、引号、反斜杠、换行、emoji、控制字符、U+2028） */
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
      /* 非 JSON 请求体 */
    }
    const record: FakeRequest = { headers: req.headers, body, aborted: false }
    requests.push(record)
    res.on('close', () => {
      if (!res.writableFinished) record.aborted = true
    })
    const messages = Array.isArray(body.messages) ? body.messages : []
    const last = String(messages.at(-1)?.content ?? '')

    if (body.stream) {
      const status = /^status:(\d+)$/.exec(last)
      if (status) {
        res.writeHead(Number(status[1]), { 'content-type': 'text/plain' })
        return res.end('upstream secret detail')
      }
      if (last === 'hang-headers') return // 永不响应
      res.writeHead(200, { 'content-type': 'text/event-stream' })
      if (last === 'hang-body') {
        res.write(sseChunk('first'))
        return // 发一块后挂起
      }
      if (last === 'gate') {
        res.write(sseChunk('first'))
        await gate
        gate = new Promise<void>((r) => (releaseGate = r))
        if (!res.destroyed) {
          res.write(sseChunk('second'))
          res.end('data: [DONE]\n\n')
        }
        return
      }
      if (last === 'garbage') {
        res.write(': comment\n\nevent: x\n')
        res.write('data: not-json\n\n')
        res.write('data: {"choices": []}\n\n')
        res.write('data: {"choices": [{"delta": {"content": null}}]}\n\n')
        res.write('data: {"choices": [{"delta": {"role": "assistant"}}]}\n\n')
        res.write('data: {"choices": [{"delta": "str"}]}\n\n')
        res.write('data: {"choices": "abc"}\n\n')
        res.write('data: [1, 2]\n\n')
        res.write('data: {"choices": [{"delta": {"content": 42}}]}\n\n')
        res.write('data: {"choices": [{"delta": {"content": ["a", {"b": null}]}}]}\n\n')
        res.write('data:{"choices":[{"delta":{"content":"no-space"}}]}\n')
        res.write('data:    [DONE]   \n\n')
        res.write(sseChunk('after done'))
        return res.end()
      }
      if (last === 'nodone') {
        res.write(sseChunk('only'))
        return res.end()
      }
      if (last === 'crlf') {
        const text = Buffer.from(
          sseChunk('中文分块😀').replace(/\n\n$/, '\r\n') +
            sseChunk('second').replace(/\n\n$/, '\r') +
            sseChunk('third') +
            'data: [DONE]\r\n',
        )
        for (let i = 0; i < text.length; i += 7) {
          res.write(text.subarray(i, i + 7))
          await sleep(2)
        }
        return res.end()
      }
      if (last === 'badutf8') {
        res.write(sseChunk('ok'))
        res.write(Buffer.from([0x64, 0x61, 0x74, 0x61, 0x3a, 0xff, 0xfe, 0x0a]))
        return res.end()
      }
      if (last === 'slow') {
        res.write(sseChunk('first'))
        await sleep(300)
        res.write(sseChunk('second'))
        res.write('data: [DONE]\n\n')
        return res.end()
      }
      for (const piece of DEFAULT_PIECES) {
        res.write(sseChunk(piece))
        await sleep(5)
      }
      res.write('data: [DONE]\n\n')
      res.write(sseChunk('ignored after done'))
      return res.end()
    }

    // 非流式（ai_sql call_llm）
    const q = /问题：([\s\S]*)$/.exec(last)?.[1] ?? ''
    const reply = (content: unknown) => {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ choices: [{ message: { content } }] }))
    }
    if (q === 'q:status500') {
      res.writeHead(500)
      return res.end('boom')
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
      // 系统提示词 + schema 文本 + 问题逐字一致时两个后端得到同一个哈希
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
