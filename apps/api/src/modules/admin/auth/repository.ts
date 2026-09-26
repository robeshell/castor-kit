/**
 * Auth module repository layer (includes login_logs queries)
 */

import { and, count, eq, gte, or, sql, type SQL } from 'drizzle-orm'
import type { Db } from '@/db/client'
import { admin_users, login_logs, operation_logs, type NewLoginLog, type NewOperationLog } from '@/db/schema'
import { utcNow } from '@/db/schema/columns'

/** `datetime.utcnow() - timedelta(minutes=n)`, computed by the DB */
const windowStart = (minutes: number) => sql`${utcNow()} - make_interval(mins => ${minutes})`

export class AuthRepository {
  constructor(private readonly db: Db) {}

  async getAdminByUsername(username: string) {
    const [row] = await this.db.select().from(admin_users).where(eq(admin_users.username, username)).limit(1)
    return row ?? null
  }

  async addLoginLog(item: NewLoginLog): Promise<void> {
    await this.db.insert(login_logs).values(item)
  }

  async addOperationLog(item: NewOperationLog): Promise<void> {
    await this.db.insert(operation_logs).values(item)
  }

  async recordLogin(userId: number, ip: string): Promise<void> {
    await this.db
      .update(admin_users)
      .set({ last_login_at: sql`${utcNow()}`, last_login_ip: ip || null })
      .where(eq(admin_users.id, userId))
  }

  async updatePasswordHash(userId: number, passwordHash: string): Promise<void> {
    await this.db.update(admin_users).set({ password_hash: passwordHash }).where(eq(admin_users.id, userId))
  }

  /** Failed login count within the recent window; `by` is the ip or username dimension */
  async countRecentFailures(by: { ip: string } | { username: string }, lockoutMinutes: number): Promise<number> {
    const dimension = 'ip' in by ? eq(login_logs.ip, by.ip) : eq(login_logs.username, by.username)
    const [row] = await this.db
      .select({ n: count() })
      .from(login_logs)
      .where(
        and(eq(login_logs.status, 'failed'), gte(login_logs.created_at, windowStart(lockoutMinutes)), dimension),
      )
    return row?.n ?? 0
  }

  /**
   * Clear failed records within the window: with both username and IP, delete by OR; with only one, filter by that dimension;
   * with neither, no dimension filter is applied.
   */
  async clearRecentFailures(username: string, ip: string, lockoutMinutes: number): Promise<void> {
    const conditions: (SQL | undefined)[] = [
      eq(login_logs.status, 'failed'),
      gte(login_logs.created_at, windowStart(lockoutMinutes)),
    ]
    if (username && ip) conditions.push(or(eq(login_logs.username, username), eq(login_logs.ip, ip)))
    else if (username) conditions.push(eq(login_logs.username, username))
    else if (ip) conditions.push(eq(login_logs.ip, ip))
    await this.db.delete(login_logs).where(and(...conditions))
  }
}
