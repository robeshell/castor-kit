/**
 * Per-IP request limits (@fastify/rate-limit, in-memory store).
 *
 * - Every /api and /ws request counts toward security.rate_limit_per_minute (static files and /health don't count)
 * - Sign-in style endpoints (login, 2FA code, password reset request) also share a stricter bucket:
 *   security.auth_rate_limit_per_minute; routes opt in with `onRequest: authRateLimit(app)`
 * - Limits are read from system settings on every request (cached), so changes apply within a few seconds
 * - Counts are per process: with N instances behind a load balancer the effective limit is up to N times higher
 * - RATE_LIMIT_ENABLED=false turns the whole thing off (the test suite does this; see test/rate-limit.test.ts)
 */

import rateLimit from '@fastify/rate-limit'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { requestPath } from '@/common/csrf'
import { ServiceError } from '@/common/errors'

const WINDOW_MS = 60_000
const TOO_MANY = '请求过于频繁，请稍后再试'

function counted(request: FastifyRequest): boolean {
  const path = requestPath(request)
  return path.startsWith('/api/') || path.startsWith('/ws/')
}

export async function registerRateLimit(app: FastifyInstance): Promise<void> {
  if (!app.config.rateLimitEnabled) return
  await app.register(rateLimit, {
    global: true,
    timeWindow: WINDOW_MS,
    max: () => app.settings.peek().rateLimitPerMinute,
    allowList: (request) => !counted(request),
    // Thrown by the plugin; the error handler turns a 4xx into { error: message } (translated like other messages)
    errorResponseBuilder: () => ({ statusCode: 429, message: TOO_MANY }),
  })
}

type Hook = (request: FastifyRequest, reply: FastifyReply) => Promise<void>
const authHooks = new WeakMap<FastifyInstance, Hook>()

/**
 * onRequest hook for the stricter sign-in bucket. One limiter (one counter per IP) is shared by every route using it,
 * which the plugin's per-route config can't do with the in-memory store (each route would get its own counter).
 */
export function authRateLimit(app: FastifyInstance): Hook {
  const existing = authHooks.get(app)
  if (existing) return existing
  const limiter = app.config.rateLimitEnabled
    ? app.createRateLimit({
        timeWindow: WINDOW_MS,
        max: () => app.settings.peek().authRateLimitPerMinute,
        keyGenerator: (request) => `auth:${request.ip}`,
      })
    : null
  const hook: Hook = async (request, reply) => {
    if (!limiter) return
    const result = await limiter(request)
    if (!result.isAllowed && result.isExceeded) {
      reply.header('retry-after', result.ttlInSeconds)
      throw new ServiceError(TOO_MANY, 429)
    }
  }
  authHooks.set(app, hook)
  return hook
}
