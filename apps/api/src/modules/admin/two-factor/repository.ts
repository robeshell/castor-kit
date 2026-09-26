/**
 * Two-factor module data access: the TOTP columns on admin_users and user_recovery_codes
 */

import { and, count, eq, isNull, lt, or, sql } from 'drizzle-orm'
import type { Executor } from '@/db/client'
import { admin_users, user_recovery_codes } from '@/db/schema'
import { utcNow } from '@/db/schema/columns'

export class TwoFactorRepository {
  constructor(private readonly db: Executor) {}

  async getUser(id: number) {
    const [row] = await this.db
      .select({
        id: admin_users.id,
        username: admin_users.username,
        password_hash: admin_users.password_hash,
        totp_secret: admin_users.totp_secret,
        totp_enabled_at: admin_users.totp_enabled_at,
      })
      .from(admin_users)
      .where(eq(admin_users.id, id))
      .limit(1)
    return row ?? null
  }

  /** A new secret waiting for its first code (any earlier binding is dropped) */
  async setPendingSecret(id: number, sealed: string): Promise<void> {
    await this.db
      .update(admin_users)
      .set({ totp_secret: sealed, totp_enabled_at: null, totp_last_step: null })
      .where(eq(admin_users.id, id))
  }

  async markEnabled(id: number, step: number): Promise<void> {
    await this.db
      .update(admin_users)
      .set({ totp_enabled_at: sql`${utcNow()}`, totp_last_step: step })
      .where(eq(admin_users.id, id))
  }

  /** Record a used time step; false when this step (or a later one) was already used — a replayed code */
  async claimStep(id: number, step: number): Promise<boolean> {
    const rows = await this.db
      .update(admin_users)
      .set({ totp_last_step: step })
      .where(and(eq(admin_users.id, id), or(isNull(admin_users.totp_last_step), lt(admin_users.totp_last_step, step))))
      .returning({ id: admin_users.id })
    return rows.length > 0
  }

  async clear(id: number): Promise<void> {
    await this.db
      .update(admin_users)
      .set({ totp_secret: null, totp_enabled_at: null, totp_last_step: null })
      .where(eq(admin_users.id, id))
    await this.db.delete(user_recovery_codes).where(eq(user_recovery_codes.user_id, id))
  }

  async replaceRecoveryCodes(id: number, hashes: string[]): Promise<void> {
    await this.db.delete(user_recovery_codes).where(eq(user_recovery_codes.user_id, id))
    await this.db.insert(user_recovery_codes).values(hashes.map((code_hash) => ({ user_id: id, code_hash })))
  }

  /** Use up an unused recovery code; false when there is none with this hash */
  async useRecoveryCode(id: number, hash: string): Promise<boolean> {
    const rows = await this.db
      .update(user_recovery_codes)
      .set({ used_at: sql`${utcNow()}` })
      .where(
        and(eq(user_recovery_codes.user_id, id), eq(user_recovery_codes.code_hash, hash), isNull(user_recovery_codes.used_at)),
      )
      .returning({ id: user_recovery_codes.id })
    return rows.length > 0
  }

  async countUnusedRecoveryCodes(id: number): Promise<number> {
    const [row] = await this.db
      .select({ n: count() })
      .from(user_recovery_codes)
      .where(and(eq(user_recovery_codes.user_id, id), isNull(user_recovery_codes.used_at)))
    return Number(row?.n ?? 0)
  }
}
