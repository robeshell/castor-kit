/**
 * Dev tools API:
 * performance monitor snapshot (REST) + real-time push over WebSocket `/ws/devtools`.
 *
 * WebSocket behavior:
 * - after connecting, first validate the Origin (same Host or in the CORS_ORIGINS allowlist; no Origin is allowed), a logged-in session
 *   and the `cc_devtools_perf_monitor` permission; if any check fails, close normally (1000)
 * - push once immediately, then `{...snapshot, type:'metric'}` every second
 * - reply to each message with `{...payload, type:'echo', server_ts}` (non-JSON text is wrapped as `{text}`);
 *   JSON that is not an object closes the connection
 * - disconnect after 30 s without any incoming message (normal close 1000)
 */

import type { FastifyInstance, FastifyRequest } from 'fastify'
import type { WebSocket } from 'ws'
import { hasMenuPermission, loginRequired } from '@/common/auth'
import { isPlainObject } from '@/common/py'
import { pyJsonDumps } from '@/common/request-meta'
import { isSignedIn } from '@/common/session'
import { metricMessage, systemSnapshot, warmUp } from './service'

const PERMISSION = 'cc_devtools_perf_monitor'
const NORMAL_CLOSURE = 1000

/** Push interval (1 s) and receive timeout (30 s); exported only so tests can shorten them */
export const WS_TIMINGS = { pushIntervalMs: 1000, receiveTimeoutMs: 30_000 }

/** Get a URL's netloc (host[:port], including userinfo): after the scheme, the part between `//` and the first `/?#`; empty string when there is no `//` */
export function urlNetloc(url: string): string {
  // urlsplit first strips leading C0 control chars and spaces, and removes \t \r \n
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
 * Validate the WS handshake Origin to block cross-site WebSocket hijacking (CSWSH).
 * Allowed: same origin (Host matches Origin) or an origin in the CORS_ORIGINS allowlist; a missing Origin (non-browser client) is allowed.
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
  // Warm up systeminformation's CPU baseline and NIC enumeration (without blocking startup)
  void warmUp()

  // ── Performance metrics snapshot (REST polling) ──────────────────────────
  app.get('/api/admin/component-center/devtools/perf-stats', { preHandler: loginRequired }, async (request, reply) => {
    if (!(await hasMenuPermission(request, PERMISSION))) {
      return reply.status(403).send({ error: '无权限' })
    }
    return systemSnapshot()
  })

  // ── WebSocket: real-time bidirectional demo ─────────────────────────────
  app.get('/ws/devtools', { websocket: true }, (socket: WebSocket, request: FastifyRequest) => {
    // Buffer messages that arrive before auth completes so they aren't lost
    const pending: (string | Buffer)[] = []
    let onMessage: ((data: string | Buffer) => void) | undefined
    socket.on('message', (data, isBinary) => {
      const payload = isBinary ? (data as Buffer) : data.toString()
      if (onMessage) onMessage(payload)
      else pending.push(payload)
    })

    void (async () => {
      // WebSocket routes have no auth decorator, so Origin + session + permission must be checked in the handler
      const allowed =
        originAllowed(headerValue(request.headers.origin), headerValue(request.headers.host), app.config.corsOrigins) &&
        isSignedIn(request) &&
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

  // Push loop: collect → send → wait 1 s
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

  // receive(timeout=30): end the session after 30 s without a new message since the last one
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
      // Close the connection when a binary frame can't be parsed as JSON
      if (typeof data !== 'string') {
        stop()
        socket.terminate()
        return
      }
      payload = { text }
    }
    if (!isPlainObject(payload)) {
      // Close the connection when the payload is not an object (list/str/number)
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
