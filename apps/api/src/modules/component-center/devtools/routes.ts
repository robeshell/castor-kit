/**
 * 工程工具类 API：
 * 性能监控快照（REST）+ WebSocket `/ws/devtools` 实时推送。
 *
 * WebSocket 行为：
 * - 连接建立后先校验 Origin（同 Host 或 CORS_ORIGINS 白名单，无 Origin 放行）、会话已登录、
 *   `cc_devtools_perf_monitor` 权限，任一不满足直接正常关闭（1000）
 * - 立即推送一次、之后每秒推送 `{...snapshot, type:'metric'}`
 * - 收到消息回 `{...payload, type:'echo', server_ts}`（非 JSON 文本包成 `{text}`）；
 *   JSON 但不是对象时直接断开连接
 * - 30 秒没有收到任何消息断开（正常关闭 1000）
 */

import type { FastifyInstance, FastifyRequest } from 'fastify'
import type { WebSocket } from 'ws'
import { hasMenuPermission, loginRequired } from '@/common/auth'
import { isPlainObject } from '@/common/py'
import { pyJsonDumps } from '@/common/request-meta'
import { metricMessage, systemSnapshot, warmUp } from './service'

const PERMISSION = 'cc_devtools_perf_monitor'
const NORMAL_CLOSURE = 1000

/** 推送间隔（1 秒）与接收超时（30 秒）；导出仅供测试缩短 */
export const WS_TIMINGS = { pushIntervalMs: 1000, receiveTimeoutMs: 30_000 }

/** 取 URL 的 netloc（host[:port]，含 userinfo）：去掉 scheme 后取 `//` 与首个 `/?#` 之间的部分；没有 `//` 时返回空串 */
export function urlNetloc(url: string): string {
  // urlsplit 会先去掉首部的 C0 控制字符与空格，并删除 \t \r \n
  const cleaned = url.replace(/^[\x00-\x20]+/, '').replace(/[\t\r\n]/g, '')
  let rest = cleaned
  const colon = cleaned.indexOf(':')
  if (colon > 0 && /^[A-Za-z][A-Za-z0-9+.-]*$/.test(cleaned.slice(0, colon))) rest = cleaned.slice(colon + 1)
  if (!rest.startsWith('//')) return ''
  const body = rest.slice(2)
  const end = body.search(/[/?#]/)
  return end === -1 ? body : body.slice(0, end)
}

/**
 * 校验 WS 握手 Origin，阻断跨站 WebSocket 劫持（CSWSH）。
 * 允许：同源（Host 与 Origin 一致）或 CORS_ORIGINS 白名单内的来源；无 Origin（非浏览器客户端）放行。
 */
export function originAllowed(origin: string | undefined, host: string | undefined, whitelist: string[]): boolean {
  if (!origin) return true
  if (host && urlNetloc(origin) === host) return true
  return whitelist.includes(origin.replace(/\/+$/, ''))
}

function headerValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

export async function registerDevtoolsRoutes(app: FastifyInstance): Promise<void> {
  // systeminformation 的 CPU 基线与网卡枚举预热（不阻塞启动）
  void warmUp()

  // ── 性能指标快照（REST 轮询）────────────────────────────────────────
  app.get('/api/admin/component-center/devtools/perf-stats', { preHandler: loginRequired }, async (request, reply) => {
    if (!(await hasMenuPermission(request, PERMISSION))) {
      return reply.status(403).send({ error: '无权限' })
    }
    return systemSnapshot()
  })

  // ── WebSocket：实时双向通信 demo ─────────────────────────────────────
  app.get('/ws/devtools', { websocket: true }, (socket: WebSocket, request: FastifyRequest) => {
    // 鉴权完成前到达的消息先缓存，避免丢失
    const pending: (string | Buffer)[] = []
    let onMessage: ((data: string | Buffer) => void) | undefined
    socket.on('message', (data, isBinary) => {
      const payload = isBinary ? (data as Buffer) : data.toString()
      if (onMessage) onMessage(payload)
      else pending.push(payload)
    })

    void (async () => {
      // WebSocket 无路由装饰器鉴权，须在处理器内校验 Origin + 会话 + 权限
      const allowed =
        originAllowed(headerValue(request.headers.origin), headerValue(request.headers.host), app.config.corsOrigins) &&
        Boolean(request.session.get('logged_in')) &&
        (await hasMenuPermission(request, PERMISSION))
      if (!allowed) {
        socket.close(NORMAL_CLOSURE)
        return
      }
      runSession(socket, pending, (handler) => {
        onMessage = handler
      })
    })().catch((err: unknown) => {
      request.log.warn({ err }, 'devtools ws 鉴权失败')
      socket.terminate()
    })
  })
}

function runSession(
  socket: WebSocket,
  pending: (string | Buffer)[],
  setHandler: (handler: (data: string | Buffer) => void) => void,
): void {
  let stopped = false
  let pushTimer: NodeJS.Timeout | undefined
  let idleTimer: NodeJS.Timeout | undefined

  const stop = () => {
    stopped = true
    clearTimeout(pushTimer)
    clearTimeout(idleTimer)
  }
  socket.on('close', stop)

  const send = (text: string) => {
    if (!stopped && socket.readyState === socket.OPEN) socket.send(text)
  }

  // 推送线程：采集 → 发送 → 等 1 秒
  const push = async () => {
    if (stopped) return
    try {
      send(metricMessage(await systemSnapshot()))
    } catch {
      return
    }
    if (!stopped) pushTimer = setTimeout(() => void push(), WS_TIMINGS.pushIntervalMs)
  }
  void push()

  // receive(timeout=30)：距上一条消息 30 秒无新消息则结束会话
  const resetIdle = () => {
    clearTimeout(idleTimer)
    idleTimer = setTimeout(() => {
      stop()
      socket.close(NORMAL_CLOSURE)
    }, WS_TIMINGS.receiveTimeoutMs)
  }

  const handle = (data: string | Buffer) => {
    if (stopped) return
    resetIdle()
    const text = typeof data === 'string' ? data : data.toString('utf8')
    let payload: unknown
    try {
      payload = JSON.parse(text)
    } catch {
      // 二进制帧无法按 JSON 解析时直接断开连接
      if (typeof data !== 'string') {
        stop()
        socket.terminate()
        return
      }
      payload = { text }
    }
    if (!isPlainObject(payload)) {
      // payload 不是对象（list/str/数字）时直接断开连接
      stop()
      socket.terminate()
      return
    }
    payload.type = 'echo'
    payload.server_ts = Date.now()
    send(pyJsonDumps(payload))
  }

  resetIdle()
  setHandler(handle)
  for (const data of pending.splice(0)) handle(data)
}
