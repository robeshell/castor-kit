import type { AppConfig } from './config'
import type { Db } from './db/client'
import type { AdminUserWithRoles } from './db/schema'

declare module 'fastify' {
  interface FastifyInstance {
    config: AppConfig
    db: Db
  }
  interface FastifyRequest {
    /** getCurrentAdminUser() 的请求内缓存；undefined = 尚未查询 */
    currentAdminUser?: AdminUserWithRoles | null
  }
}

/** 会话里存的字段 */
declare module '@fastify/secure-session' {
  interface SessionData {
    logged_in: boolean
    username: string
    csrf_token: string
  }
}
