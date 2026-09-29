/**
 * Auth module repository layer (includes login_logs queries)
 */

import { and, count, eq, gte, sql } from 'drizzle-orm'
import type { Db } from '@/db/client'
import { admin_users, departments, login_logs, operation_logs, type NewLoginLog, type NewOperationLog } from '@/db/schema'
import { utcNow } from '@/db/schema/columns'

/** UTC now minus n minutes, computed by the DB */
const windowStart = (minutes: number) => sql`${utcNow()} - make_interval(mins => ${minutes})`

export class AuthRepository {
  constructor(private readonly db: Db) {}

  async deptName(deptId: number | null): Promise<string | null> {
    if (deptId === null) return null
    const [row] = await this.db.select({ name: departments.name }).from(departments).where(eq(departments.id, deptId)).limit(1)
    return row?.name ?? null
  }

  async getAdminById(id: number) {
    const [row] = await this.db.select().from(admin_users).where(eq(admin_users.id, id)).limit(1)
    return row ?? null
  }

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

  /**
   * Failed login count within the recent window; `by` is the ip or username dimension. Only failures after the last
   * successful sign-in on the same dimension count, so a success resets the lockout without deleting audit rows.
   */
  async countRecentFailures(by: { ip: string } | { username: string }, lockoutMinutes: number): Promise<number> {
    const dimension = 'ip' in by ? sql`${login_logs.ip} = ${by.ip}` : sql`${login_logs.username} = ${by.username}`
    const since = windowStart(lockoutMinutes)
    const lastSuccess = sql`(SELECT max(${login_logs.created_at}) FROM ${login_logs}
      WHERE ${login_logs.status} = 'success' AND ${login_logs.created_at} >= ${since} AND ${dimension})`
    const [row] = await this.db
      .select({ n: count() })
      .from(login_logs)
      .where(
        and(
          eq(login_logs.status, 'failed'),
          gte(login_logs.created_at, since),
          dimension,
          sql`${login_logs.created_at} > coalesce(${lastSuccess}, '-infinity'::timestamp)`,
        ),
      )
    return row?.n ?? 0
  }
}
