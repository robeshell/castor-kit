import type { AppConfig } from './config'
import type { Db } from './db/client'
import type { DataScope } from './common/data-scope'
import type { MailerProvider } from './common/mailer'
import type { EventBus } from './common/webhooks'
import type { SettingsStore } from './common/settings'
import type { AdminUserWithRoles, ApiToken, SessionRow } from './db/schema'

declare module 'fastify' {
  interface FastifyInstance {
    config: AppConfig
    db: Db
    /** System settings, cached per process */
    settings: SettingsStore
    /** Outgoing mail for the current settings (`await app.mailer.get()`: null when mail isn't configured) */
    mailer: MailerProvider
    /** Domain events for webhooks: `await app.events.emit('user.created', data)` after a write (common/webhooks.ts) */
    events: EventBus
  }
  interface FastifyRequest {
    /** Per-request cache for getCurrentAdminUser(); undefined = not yet queried */
    currentAdminUser?: AdminUserWithRoles | null
    /** Per-request cache for resolveDataScope() */
    dataScope?: DataScope
    /** The `sessions` row behind the cookie, resolved once per request (null = no valid session) */
    authSession: SessionRow | null
    /** Set when the request authenticated with `Authorization: Bearer ck_…` (common/api-token.ts); no session then */
    apiToken: ApiToken | null
  }
}

/** Fields stored in the session */
declare module '@fastify/secure-session' {
  interface SessionData {
    /** Id of the `sessions` row; whether it is signed in and as whom is decided there */
    sid: string
    csrf_token: string
  }
}
