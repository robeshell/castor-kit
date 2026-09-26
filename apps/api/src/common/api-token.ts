/**
 * API tokens: `Authorization: Bearer ck_…` on /api requests, for scripts and other systems.
 *
 * - A token acts as its creator, limited to its scopes (checked before the super admin shortcut, see auth.ts);
 *   the creator's data scope applies
 * - Bearer requests never look at the session cookie, create no session and skip the CSRF check
 * - Revoked / expired tokens, disabled creators and the switch in system settings (security.api_tokens_enabled)
 *   are checked on every request, so each takes effect immediately
 * - Account and security endpoints refuse tokens (API_TOKEN_DENIED): a leaked token can't change passwords, strip
 *   two-step verification, mint more tokens, repoint system settings or add webhooks
 */

import { createHash, randomBytes } from 'node:crypto'
import { and, eq, gt, isNull, or, sql } from 'drizzle-orm'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import { requestPath } from '@/common/csrf'
import { getClientIp } from '@/common/request-meta'
import type { Executor } from '@/db/client'
import { api_tokens, type ApiToken } from '@/db/schema'
import { utcNow } from '@/db/schema/columns'

export const API_TOKEN_PREFIX = 'ck_'
/** How often last_used_at / last_used_ip are written for a busy token */
const TOUCH_INTERVAL_MS = 60_000

/** A new token: the plain text (shown once), what lists show, and what is stored */
export function newApiToken(): { token: string; prefix: string; hash: string } {
  const token = `${API_TOKEN_PREFIX}${randomBytes(32).toString('base64url')}`
  return { token, prefix: token.slice(0, API_TOKEN_PREFIX.length + 8), hash: hashApiToken(token) }
}

export function hashApiToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/** `[method or '*', path pattern]` pairs that don't accept API tokens */
export const API_TOKEN_DENIED: Array<[string, RegExp]> = [
  ['*', /^\/api\/admin\/(login|logout|reauth|change-password)(\/|$)/],
  ['*', /^\/api\/admin\/password-reset(\/|$)/],
  ['*', /^\/api\/admin\/two-factor(\/|$)/],
  ['*', /^\/api\/admin\/users\/\d+\/two-factor$/],
  ['*', /^\/api\/admin\/profile(\/|$)/],
  ['*', /^\/api\/admin\/sessions(\/|$)/],
  ['*', /^\/api\/admin\/api-tokens(\/|$)/],
  ['*', /^\/api\/admin\/modeler(\/|$)/],
  ['PUT', /^\/api\/admin\/settings$/],
  ['*', /^\/api\/admin\/settings\/test(\/|$)/],
  ['POST', /^\/api\/admin\/webhooks(\/|$)/],
  ['PUT', /^\/api\/admin\/webhooks(\/|$)/],
  ['DELETE', /^\/api\/admin\/webhooks(\/|$)/],
  ['GET', /^\/api\/admin\/webhooks\/\d+\/secret$/],
]

export function apiTokenDenied(method: string, path: string): boolean {
  return API_TOKEN_DENIED.some(([m, re]) => (m === '*' || m === method) && re.test(path))
}

/** The token text of `Authorization: Bearer ck_…`, or null */
export function bearerToken(request: FastifyRequest): string | null {
  const header = request.headers.authorization
  if (typeof header !== 'string') return null
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim())
  return match && match[1]!.startsWith(API_TOKEN_PREFIX) ? match[1]! : null
}

/** A token that is neither revoked nor expired */
export async function findActiveApiToken(db: Executor, token: string): Promise<ApiToken | null> {
  const [row] = await db
    .select()
    .from(api_tokens)
    .where(
      and(
        eq(api_tokens.token_hash, hashApiToken(token)),
        isNull(api_tokens.revoked_at),
        or(isNull(api_tokens.expires_at), gt(api_tokens.expires_at, utcNow())),
      ),
    )
    .limit(1)
  return row ?? null
}

/**
 * onRequest (before the session resolver): authenticate Bearer requests to /api. The creator's status is checked
 * by getCurrentAdminUser like for sessions.
 */
export function registerApiTokenResolver(app: FastifyInstance): void {
  app.decorateRequest('apiToken', null)
  app.addHook('onRequest', async (request, reply) => {
    const path = requestPath(request)
    if (!path.startsWith('/api/')) return
    const token = bearerToken(request)
    if (!token) return
    const settings = await app.settings.get()
    if (!app.settings.isAvailable('security.api_tokens_enabled', settings)) {
      return reply.status(401).send({ error: 'API Token 未开启' })
    }
    const row = await findActiveApiToken(app.db, token)
    if (!row) return reply.status(401).send({ error: 'API Token 无效或已过期' })
    if (apiTokenDenied(request.method, path)) return reply.status(403).send({ error: '该接口不支持 API Token' })
    request.apiToken = row
    const last = row.last_used_at ? Date.parse(`${row.last_used_at.replace(' ', 'T').slice(0, 23)}Z`) : 0
    if (Date.now() - last > TOUCH_INTERVAL_MS) {
      await app.db
        .update(api_tokens)
        .set({ last_used_at: sql`${utcNow()}`, last_used_ip: getClientIp(request) || null })
        .where(eq(api_tokens.id, row.id))
    }
  })
}
