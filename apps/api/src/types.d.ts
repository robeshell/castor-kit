import type { AppConfig } from './config'
import type { Db } from './db/client'
import type { DataScope } from './common/data-scope'
import type { Mailer } from './common/mailer'
import type { SettingsStore } from './common/settings'
import type { AdminUserWithRoles, SessionRow } from './db/schema'

declare module 'fastify' {
  interface FastifyInstance {
    config: AppConfig
    db: Db
    /** System settings (系统设置), cached per process */
    settings: SettingsStore
    /** Outgoing mail; null when MAIL_DRIVER / SMTP_HOST isn't configured */
    mailer: Mailer | null
  }
  interface FastifyRequest {
    /** Per-request cache for getCurrentAdminUser(); undefined = not yet queried */
    currentAdminUser?: AdminUserWithRoles | null
    /** Per-request cache for resolveDataScope() */
    dataScope?: DataScope
    /** The `sessions` row behind the cookie, resolved once per request (null = no valid session) */
    authSession: SessionRow | null
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
