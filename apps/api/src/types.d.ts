import type { AppConfig } from './config'
import type { Db } from './db/client'
import type { DataScope } from './common/data-scope'
import type { SettingsStore } from './common/settings'
import type { AdminUserWithRoles } from './db/schema'

declare module 'fastify' {
  interface FastifyInstance {
    config: AppConfig
    db: Db
    /** System settings (系统设置), cached per process */
    settings: SettingsStore
  }
  interface FastifyRequest {
    /** Per-request cache for getCurrentAdminUser(); undefined = not yet queried */
    currentAdminUser?: AdminUserWithRoles | null
    /** Per-request cache for resolveDataScope() */
    dataScope?: DataScope
  }
}

/** Fields stored in the session */
declare module '@fastify/secure-session' {
  interface SessionData {
    logged_in: boolean
    username: string
    csrf_token: string
  }
}
