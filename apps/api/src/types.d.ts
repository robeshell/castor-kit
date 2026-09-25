import type { AppConfig } from './config'
import type { Db } from './db/client'
import type { AdminUserWithRoles } from './db/schema'

declare module 'fastify' {
  interface FastifyInstance {
    config: AppConfig
    db: Db
  }
  interface FastifyRequest {
    /** Per-request cache for getCurrentAdminUser(); undefined = not yet queried */
    currentAdminUser?: AdminUserWithRoles | null
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
