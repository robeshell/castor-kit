/**
 * Sessions module data access: signed-in sessions (not revoked, not expired, not waiting for 2FA) with their user
 */

import { and, count, desc, eq, gt, ilike, isNull, or, sql, type SQL } from 'drizzle-orm'
import { dataScopeWhere, type DataScope } from '@/common/data-scope'
import type { Executor } from '@/db/client'
import { admin_users, sessions } from '@/db/schema'
import { utcNow } from '@/db/schema/columns'

export interface SessionFilters {
  search: string
  userId?: number
}

const COLUMNS = {
  id: sessions.id,
  user_id: sessions.user_id,
  ip: sessions.ip,
  user_agent: sessions.user_agent,
  mfa_state: sessions.mfa_state,
  created_at: sessions.created_at,
  last_seen_at: sessions.last_seen_at,
  expires_at: sessions.expires_at,
  revoked_at: sessions.revoked_at,
  verified_at: sessions.verified_at,
  username: admin_users.username,
  nickname: admin_users.nickname,
}

export class SessionRepository {
  constructor(private readonly db: Executor) {}

  private where({ search, userId }: SessionFilters, scope: DataScope): SQL | undefined {
    const pattern = `%${search}%`
    return and(
      isNull(sessions.revoked_at),
      isNull(sessions.mfa_state),
      gt(sessions.expires_at, utcNow()),
      dataScopeWhere(scope, { deptColumn: admin_users.dept_id, ownerColumn: admin_users.id }),
      userId !== undefined ? eq(sessions.user_id, userId) : undefined,
      search
        ? or(ilike(admin_users.username, pattern), ilike(admin_users.nickname, pattern), ilike(sessions.ip, pattern))
        : undefined,
    )
  }

  async listPage(page: number, perPage: number, filters: SessionFilters, scope: DataScope) {
    const where = this.where(filters, scope)
    const [totalRow] = await this.db
      .select({ n: count() })
      .from(sessions)
      .innerJoin(admin_users, eq(admin_users.id, sessions.user_id))
      .where(where)
    const items = await this.db
      .select(COLUMNS)
      .from(sessions)
      .innerJoin(admin_users, eq(admin_users.id, sessions.user_id))
      .where(where)
      .orderBy(desc(sessions.last_seen_at), desc(sessions.created_at))
      .limit(perPage)
      .offset((page - 1) * perPage)
    return { total: Number(totalRow?.n ?? 0), items }
  }

  /** A signed-in session by its public key (see sessionToDict), within the scope */
  async findByKey(key: string, filters: SessionFilters, scope: DataScope) {
    const [row] = await this.db
      .select(COLUMNS)
      .from(sessions)
      .innerJoin(admin_users, eq(admin_users.id, sessions.user_id))
      .where(and(this.where(filters, scope), sql`left(${sessions.id}, 16) = ${key}`))
      .limit(1)
    return row ?? null
  }
}
