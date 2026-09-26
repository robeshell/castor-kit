/**
 * Server-side sessions.
 *
 * The encrypted cookie (@fastify/secure-session, cookie castor_session) only carries { sid, csrf_token }; the
 * `sessions` row decides whether the request is signed in, as whom, and until when. That makes sessions listable and
 * revocable (online users, "sign out other devices", password changes, disabled accounts).
 *
 * - resolveSessionHook (onRequest) loads the row once per request into request.authSession
 * - expiry slides: last_seen_at / expires_at are written at most once a minute per session
 * - a session in an MFA step (mfa_state 'verify' / 'setup') is not signed in; only the login-step endpoints accept it
 */

import { randomBytes } from 'node:crypto'
import { and, eq, gt, isNull, lt, ne, or, sql } from 'drizzle-orm'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import { requestPath } from '@/common/csrf'
import { ServiceError } from '@/common/errors'
import type { Executor } from '@/db/client'
import { sessions, type SessionRow } from '@/db/schema'
import { utcNow } from '@/db/schema/columns'

/** Paths that read the session (API, WebSocket, the /admin/login redirect) */
const SESSION_PATHS = /^\/(api|ws|admin)(\/|$)/

/** How often last_seen_at / expires_at are refreshed for an active session */
const TOUCH_INTERVAL_SECONDS = 60
/** Lifetime of a session waiting for the TOTP code / enrollment */
export const MFA_PENDING_MINUTES = 5
/** How long a sign-in or a re-verification covers sensitive changes (requireRecentAuth) */
export const REAUTH_WINDOW_MINUTES = 10

export type MfaState = 'verify' | 'setup'

export interface ClientInfo {
  ip: string
  userAgent: string
}

const hoursFromNow = (hours: number) => sql`${utcNow()} + make_interval(hours => ${hours})`
const minutesFromNow = (minutes: number) => sql`${utcNow()} + make_interval(mins => ${minutes})`

/** Create a session row; returns its id (the value stored in the cookie) */
export async function createSession(
  db: Executor,
  userId: number,
  client: ClientInfo,
  options: { ttlHours: number; mfaState?: MfaState | null },
): Promise<string> {
  const id = randomBytes(32).toString('hex')
  const mfaState = options.mfaState ?? null
  await db.insert(sessions).values({
    id,
    user_id: userId,
    ip: client.ip || null,
    user_agent: client.userAgent ? client.userAgent.slice(0, 500) : null,
    mfa_state: mfaState,
    last_seen_at: sql`${utcNow()}`,
    // Signing in proves who the user is: sensitive changes right after it don't ask again
    verified_at: mfaState ? null : sql`${utcNow()}`,
    expires_at: mfaState ? minutesFromNow(MFA_PENDING_MINUTES) : hoursFromNow(options.ttlHours),
  })
  return id
}

/** Turn a pending (MFA) session into a signed-in one */
export async function completeMfa(db: Executor, id: string, ttlHours: number): Promise<void> {
  await db
    .update(sessions)
    .set({ mfa_state: null, last_seen_at: sql`${utcNow()}`, expires_at: hoursFromNow(ttlHours) })
    .where(eq(sessions.id, id))
}

export async function setMfaState(db: Executor, id: string, mfaState: MfaState): Promise<void> {
  await db.update(sessions).set({ mfa_state: mfaState }).where(eq(sessions.id, id))
}

/** A session that is neither revoked nor expired */
export async function findLiveSession(db: Executor, id: string): Promise<SessionRow | null> {
  const [row] = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.id, id), isNull(sessions.revoked_at), gt(sessions.expires_at, utcNow())))
    .limit(1)
  return row ?? null
}

/** The user just proved who they are again (password, plus the 2FA code when enrolled) */
export async function markVerified(db: Executor, id: string): Promise<void> {
  await db.update(sessions).set({ verified_at: sql`${utcNow()}` }).where(eq(sessions.id, id))
}

/**
 * Sensitive changes (system settings and their test buttons) need a sign-in or re-verification within the last
 * REAUTH_WINDOW_MINUTES: a stolen session cookie alone isn't enough. Throws 403 `{ error, reauth_required: true }`;
 * the page then asks for the password (and 2FA code) through POST /api/admin/reauth and retries.
 */
export function requireRecentAuth(request: FastifyRequest): void {
  const verifiedAt = request.authSession?.verified_at
  const at = verifiedAt ? Date.parse(`${verifiedAt.replace(' ', 'T').slice(0, 23)}Z`) : 0
  if (Date.now() - at > REAUTH_WINDOW_MINUTES * 60_000) {
    throw new ServiceError('请先验证身份', 403, { reauth_required: true })
  }
}

/** Revoke sessions: one by id, or all of a user's (optionally keeping one) */
export async function revokeSessions(
  db: Executor,
  target: { id: string } | { userId: number; exceptId?: string },
): Promise<number> {
  const where =
    'id' in target
      ? eq(sessions.id, target.id)
      : and(eq(sessions.user_id, target.userId), target.exceptId ? ne(sessions.id, target.exceptId) : undefined)
  const result = await db
    .update(sessions)
    .set({ revoked_at: sql`${utcNow()}` })
    .where(and(where, isNull(sessions.revoked_at)))
  return result.rowCount ?? 0
}

/** Delete sessions that expired or were revoked more than a day ago (maintenance job) */
export async function purgeSessions(db: Executor): Promise<number> {
  const dayAgo = sql`${utcNow()} - interval '1 day'`
  const result = await db.delete(sessions).where(or(lt(sessions.expires_at, dayAgo), lt(sessions.revoked_at, dayAgo)))
  return result.rowCount ?? 0
}

/** Signed in = a live session that isn't in an MFA step */
export function isSignedIn(request: FastifyRequest): boolean {
  return Boolean(request.authSession && !request.authSession.mfa_state)
}

/** Drop the session cookie (and forget the row for the rest of this request) */
export function clearSession(request: FastifyRequest): void {
  request.authSession = null
  request.session.regenerate()
  request.session.delete()
}

/** Start a session for this request: new cookie contents (fresh CSRF token) pointing at the row */
export function attachSession(request: FastifyRequest, row: Pick<SessionRow, 'id'> & Partial<SessionRow>): void {
  request.session.regenerate()
  request.session.set('sid', row.id)
  request.authSession = row as SessionRow
}

/**
 * onRequest: resolve the cookie's sid to its row. Unknown / revoked / expired sids clear the cookie. Active sessions
 * slide their expiry (at most once a minute) and have the cookie's max age follow the configured TTL.
 */
export function registerSessionResolver(app: FastifyInstance): void {
  app.decorateRequest('authSession', null)
  app.addHook('onRequest', async (request) => {
    // Static files and the SPA never look at the session: skip the lookup (one query per asset otherwise)
    if (!SESSION_PATHS.test(requestPath(request))) return
    const sid = request.session.get('sid')
    if (!sid) return
    const row = await findLiveSession(app.db, sid)
    if (!row) {
      clearSession(request)
      return
    }
    request.authSession = row
    if (row.mfa_state) return
    const ttlHours = app.settings.peek().sessionTtlHours
    request.session.options({ maxAge: ttlHours * 3600 })
    request.session.touch()
    const lastSeen = row.last_seen_at ? Date.parse(`${row.last_seen_at.replace(' ', 'T').slice(0, 23)}Z`) : 0
    if (Date.now() - lastSeen > TOUCH_INTERVAL_SECONDS * 1000) {
      await app.db
        .update(sessions)
        .set({ last_seen_at: sql`${utcNow()}`, expires_at: hoursFromNow(ttlHours) })
        .where(eq(sessions.id, row.id))
    }
  })
}

