/**
 * Public demo guard (DEMO_MODE).
 *
 * Everything outside the component gallery is read-only: accounts, roles, menus, dictionaries, scheduled tasks,
 * announcements and password changes all reject writes, so visitors can't lock others out or break the demo.
 * The gallery stays fully editable and is restored by src/demo/reset.ts.
 *
 * AI endpoints that call the upstream model get a quota on top (a public demo shares one free API key):
 * per-IP calls per hour, site-wide calls per day and a max request size. Counters live in memory — the demo runs a
 * single instance, and a restart only resets them early.
 */

import type { FastifyInstance } from 'fastify'
import type { AppConfig } from '@/config'
import { requestPath } from '@/common/csrf'

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

/** Write endpoints that stay open in the demo */
export const DEMO_WRITABLE: RegExp[] = [
  /^\/api\/admin\/(login|logout)$/,
  /^\/api\/admin\/component-center\//,
  /^\/api\/admin\/notifications\/(\d+\/read|read-all)$/,
]

export function isDemoWritable(path: string): boolean {
  return DEMO_WRITABLE.some((re) => re.test(path))
}

/** Endpoints that call the upstream AI model (prompt preview only substitutes variables locally) */
export const DEMO_AI_PATHS = new Set(['/api/admin/component-center/ai/chat/stream', '/api/admin/component-center/ai/sql/generate'])

const HOUR_MS = 3_600_000
const DAY_MS = 86_400_000

type QuotaResult = { ok: true } | { ok: false; reason: 'ip' | 'day' }

/** Fixed-window counters: per IP per clock hour, and for the whole site per UTC day */
export class DemoAiQuota {
  private readonly perIp = new Map<string, number>()
  private day = -1
  private dayCount = 0

  constructor(private readonly limits: { hourlyPerIp: number; daily: number }) {}

  take(ip: string, now = Date.now()): QuotaResult {
    const hour = Math.floor(now / HOUR_MS)
    const day = Math.floor(now / DAY_MS)
    if (day !== this.day) {
      this.day = day
      this.dayCount = 0
    }
    const key = `${hour}|${ip}`
    const used = this.perIp.get(key) ?? 0
    if (used >= this.limits.hourlyPerIp) return { ok: false, reason: 'ip' }
    if (this.dayCount >= this.limits.daily) return { ok: false, reason: 'day' }
    // Drop counters from earlier hours before the map grows
    if (this.perIp.size > 5000) {
      for (const k of this.perIp.keys()) if (!k.startsWith(`${hour}|`)) this.perIp.delete(k)
    }
    this.perIp.set(key, used + 1)
    this.dayCount += 1
    return { ok: true }
  }
}

type DemoConfig = Pick<AppConfig, 'demoMode' | 'demoAiHourlyPerIp' | 'demoAiDaily' | 'demoAiMaxInputChars'>

export function registerDemoGuard(app: FastifyInstance, config: DemoConfig): void {
  if (!config.demoMode) return
  app.addHook('onRequest', async (request, reply) => {
    if (READ_METHODS.has(request.method)) return
    const path = requestPath(request)
    if (!path.startsWith('/api/') || isDemoWritable(path)) return
    return reply.status(403).send({ error: '演示环境不允许此操作' })
  })

  const quota = new DemoAiQuota({ hourlyPerIp: config.demoAiHourlyPerIp, daily: config.demoAiDaily })
  // preHandler: the body is parsed by now. Signed-out requests are left to the route's own 401 and don't use quota.
  app.addHook('preHandler', async (request, reply) => {
    if (request.method !== 'POST' || !DEMO_AI_PATHS.has(requestPath(request))) return
    if (!request.session.get('logged_in')) return
    if (JSON.stringify(request.body ?? '').length > config.demoAiMaxInputChars) {
      return reply.status(400).send({ error: '演示环境单次输入过长，请精简后再试' })
    }
    const result = quota.take(request.ip)
    if (!result.ok) {
      const error = result.reason === 'ip' ? '演示环境 AI 调用过于频繁，请稍后再试' : '今日演示 AI 额度已用完，请明天再试'
      return reply.status(429).send({ error })
    }
  })
}

/**
 * Cap on the model's reply length in the demo (keeps the shared free quota going further).
 * Generous on purpose: for thinking models (e.g. Gemini Flash) the limit includes the thinking tokens, and a tight
 * cap ends the reply before any text is produced.
 */
export const DEMO_MAX_OUTPUT_TOKENS = { chat: 4096, sql: 2048 }
