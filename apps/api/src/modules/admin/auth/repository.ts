/**
 * 认证模块 repository 层（含 login_logs 查询）
 */

import { and, count, eq, gte, or, sql, type SQL } from 'drizzle-orm'
import type { Db } from '@/db/client'
import { admin_users, login_logs, operation_logs, type NewLoginLog, type NewOperationLog } from '@/db/schema'
import { utcNow } from '@/db/schema/columns'

/** `datetime.utcnow() - timedelta(minutes=n)`，由数据库计算 */
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

  async updatePasswordHash(userId: number, passwordHash: string): Promise<void> {
    await this.db.update(admin_users).set({ password_hash: passwordHash }).where(eq(admin_users.id, userId))
  }

  /** 近窗口内失败登录次数；by 为 ip 或 username 维度 */
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
   * 清零窗口内失败记录：同时给了用户名和 IP 时按 OR 删除；只给一个按该维度；
   * 都没给时不加维度条件。
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
