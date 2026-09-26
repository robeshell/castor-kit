/**
 * CSRF protection
 *
 * Session-cookie auth relies on the browser sending cookies automatically, so state-changing requests must pass a double-submit token check:
 * the frontend gets csrf_token on login / current-user fetch and sends it in the X-CSRF-Token header; the server compares it with the token in the session.
 */

import { randomBytes, timingSafeEqual } from 'node:crypto'
import type { Session } from '@fastify/secure-session'
import type { FastifyInstance, FastifyRequest } from 'fastify'

export const CSRF_ERROR_MESSAGE = 'CSRF 校验失败，请刷新页面后重试'
const PROTECTED_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

/** Generate / return the CSRF token for the current session */
export function ensureCsrfToken(session: Session): string {
  let token = session.get('csrf_token')
  if (!token) {
    token = randomBytes(16).toString('hex')
    session.set('csrf_token', token)
  }
  return token
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  return ba.length === bb.length && timingSafeEqual(ba, bb)
}

export function requestPath(request: FastifyRequest): string {
  const raw = request.url.split('?', 1)[0] ?? '/'
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

/**
 * CSRF check for state-changing requests on logged-in sessions
 * Hooked on preValidation (body already parsed) rather than onRequest: rejected requests' bodies must still reach the operation log
 * - Only intercepts POST/PUT/PATCH/DELETE under /api/
 * - The login endpoint itself is exempt (no session token exists yet)
 * - Unauthenticated requests are skipped (handled by loginRequired)
 */
export function registerCsrfProtection(app: FastifyInstance): void {
  app.addHook('preValidation', async (request, reply) => {
    if (!PROTECTED_METHODS.has(request.method)) return
    const path = requestPath(request)
    if (!path.startsWith('/api/')) return
    if (path === '/api/admin/login') return
    // Any live session (also one in an MFA step) must send its token; requests without a session are left to the routes
    if (!request.authSession) return

    const header = request.headers['x-csrf-token']
    const token = (Array.isArray(header) ? header[0] : header) ?? ''
    const expected = request.session.get('csrf_token') ?? ''
    if (!token || !expected || !safeEqual(token, expected)) {
      return reply.status(403).send({ error: CSRF_ERROR_MESSAGE })
    }
  })
}
