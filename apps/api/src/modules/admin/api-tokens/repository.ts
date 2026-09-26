/**
 * API tokens module data access
 */

import { and, count, desc, eq, gt, ilike, isNotNull, isNull, lte, or, sql, type SQL } from 'drizzle-orm'
import { dataScopeWhere, type DataScope } from '@/common/data-scope'
import type { Executor } from '@/db/client'
import { admin_users, api_tokens, menus } from '@/db/schema'
import { utcNow } from '@/db/schema/columns'

export type TokenStatus = 'active' | 'expired' | 'revoked'

export interface TokenFilters {
  search: string
  status: TokenStatus | ''
}

const COLUMNS = {
  id: api_tokens.id,
  name: api_tokens.name,
  token_prefix: api_tokens.token_prefix,
  token_hash: api_tokens.token_hash,
  scopes: api_tokens.scopes,
  expires_at: api_tokens.expires_at,
  last_used_at: api_tokens.last_used_at,
  last_used_ip: api_tokens.last_used_ip,
  created_by: api_tokens.created_by,
  created_at: api_tokens.created_at,
  revoked_at: api_tokens.revoked_at,
  creator_username: admin_users.username,
  creator_nickname: admin_users.nickname,
}

function statusWhere(status: TokenStatus | ''): SQL | undefined {
  const notExpired = or(isNull(api_tokens.expires_at), gt(api_tokens.expires_at, utcNow()))
  if (status === 'active') return and(isNull(api_tokens.revoked_at), notExpired)
  if (status === 'revoked') return isNotNull(api_tokens.revoked_at)
  if (status === 'expired') return and(isNull(api_tokens.revoked_at), lte(api_tokens.expires_at, utcNow()))
  return undefined
}

export class ApiTokenRepository {
  constructor(private readonly db: Executor) {}

  /** The user's tokens, newest first (revoked ones included, so they can see what was revoked) */
  async listOwn(userId: number) {
    return this.db
      .select(COLUMNS)
      .from(api_tokens)
      .innerJoin(admin_users, eq(admin_users.id, api_tokens.created_by))
      .where(eq(api_tokens.created_by, userId))
      .orderBy(desc(api_tokens.id))
  }

  async countActiveOwn(userId: number): Promise<number> {
    const [row] = await this.db
      .select({ n: count() })
      .from(api_tokens)
      .where(and(eq(api_tokens.created_by, userId), statusWhere('active')))
    return Number(row?.n ?? 0)
  }

  /** All tokens whose creator is inside the scope */
  async listPage(page: number, perPage: number, filters: TokenFilters, scope: DataScope) {
    const pattern = `%${filters.search}%`
    const where = and(
      dataScopeWhere(scope, { deptColumn: admin_users.dept_id, ownerColumn: admin_users.id }),
      statusWhere(filters.status),
      filters.search
        ? or(ilike(api_tokens.name, pattern), ilike(api_tokens.token_prefix, pattern), ilike(admin_users.username, pattern))
        : undefined,
    )
    const [totalRow] = await this.db
      .select({ n: count() })
      .from(api_tokens)
      .innerJoin(admin_users, eq(admin_users.id, api_tokens.created_by))
      .where(where)
    const items = await this.db
      .select(COLUMNS)
      .from(api_tokens)
      .innerJoin(admin_users, eq(admin_users.id, api_tokens.created_by))
      .where(where)
      .orderBy(desc(api_tokens.id))
      .limit(perPage)
      .offset((page - 1) * perPage)
    return { total: Number(totalRow?.n ?? 0), items }
  }

  async getById(id: number, scope?: DataScope) {
    const [row] = await this.db
      .select(COLUMNS)
      .from(api_tokens)
      .innerJoin(admin_users, eq(admin_users.id, api_tokens.created_by))
      .where(and(eq(api_tokens.id, id), scope ? dataScopeWhere(scope, { deptColumn: admin_users.dept_id, ownerColumn: admin_users.id }) : undefined))
      .limit(1)
    return row ?? null
  }

  /** `expires_at` may be a SQL expression (now + n days) */
  async insert(values: Omit<typeof api_tokens.$inferInsert, 'expires_at'> & { expires_at: SQL | null }) {
    const [row] = await this.db.insert(api_tokens).values(values).returning()
    return row!
  }

  async revoke(id: number): Promise<void> {
    await this.db
      .update(api_tokens)
      .set({ revoked_at: sql`${utcNow()}` })
      .where(and(eq(api_tokens.id, id), isNull(api_tokens.revoked_at)))
  }

  /** Active menus and buttons (what a token can be scoped to) */
  async activeMenus() {
    return this.db
      .select({ id: menus.id, parent_id: menus.parent_id, code: menus.code, name: menus.name, menu_type: menus.menu_type, sort_order: menus.sort_order })
      .from(menus)
      .where(eq(menus.is_active, true))
      .orderBy(menus.sort_order, menus.id)
  }
}
