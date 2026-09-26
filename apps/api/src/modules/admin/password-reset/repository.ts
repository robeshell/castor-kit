/**
 * Password reset data access: password_reset_tokens (only sha256 hashes of the tokens are stored)
 */

import { and, eq, gt, isNull, lt, or, sql } from 'drizzle-orm'
import type { Executor } from '@/db/client'
import { admin_users, password_reset_tokens } from '@/db/schema'
import { utcNow } from '@/db/schema/columns'

export const TOKEN_MINUTES = 30

export class PasswordResetRepository {
  constructor(private readonly db: Executor) {}

  /** Active account with this email (case-insensitive) */
  async findActiveByEmail(email: string) {
    const [row] = await this.db
      .select({ id: admin_users.id, username: admin_users.username, email: admin_users.email })
      .from(admin_users)
      .where(and(sql`lower(${admin_users.email}) = ${email.toLowerCase()}`, eq(admin_users.status, 'active')))
      .limit(1)
    return row ?? null
  }

  /** A new token for the user; earlier unused ones stop working */
  async issue(userId: number, tokenHash: string, ip: string): Promise<void> {
    await this.db
      .update(password_reset_tokens)
      .set({ used_at: sql`${utcNow()}` })
      .where(and(eq(password_reset_tokens.user_id, userId), isNull(password_reset_tokens.used_at)))
    await this.db.insert(password_reset_tokens).values({
      user_id: userId,
      token_hash: tokenHash,
      requested_ip: ip || null,
      expires_at: sql`${utcNow()} + make_interval(mins => ${TOKEN_MINUTES})`,
    })
  }

  /** Use up a valid token (unused, not expired, account active); returns its user id, or null */
  async consume(tokenHash: string): Promise<number | null> {
    const rows = await this.db
      .update(password_reset_tokens)
      .set({ used_at: sql`${utcNow()}` })
      .where(
        and(
          eq(password_reset_tokens.token_hash, tokenHash),
          isNull(password_reset_tokens.used_at),
          gt(password_reset_tokens.expires_at, utcNow()),
          sql`exists (select 1 from ${admin_users} where ${admin_users.id} = ${password_reset_tokens.user_id} and ${admin_users.status} = 'active')`,
        ),
      )
      .returning({ userId: password_reset_tokens.user_id })
    return rows[0]?.userId ?? null
  }

  async setPasswordHash(userId: number, passwordHash: string): Promise<void> {
    await this.db.update(admin_users).set({ password_hash: passwordHash }).where(eq(admin_users.id, userId))
  }

  /** Delete tokens that were used or expired more than a day ago (maintenance job) */
  async purge(): Promise<number> {
    const dayAgo = sql`${utcNow()} - interval '1 day'`
    const result = await this.db
      .delete(password_reset_tokens)
      .where(or(lt(password_reset_tokens.expires_at, dayAgo), lt(password_reset_tokens.used_at, dayAgo)))
    return result.rowCount ?? 0
  }
}
