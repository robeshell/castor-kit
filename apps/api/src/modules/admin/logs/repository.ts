/**
 * 日志模块 repository 层（对齐 AuraStack backend/app/admin/crud/logs.py）
 */

import { and, asc, count, desc, eq, ilike, inArray, sql, type SQL } from 'drizzle-orm'
import type { PgInsertValue } from 'drizzle-orm/pg-core'
import type { Executor } from '@/db/client'
import { admin_users, login_logs, operation_logs, type LoginLog, type OperationLog } from '@/db/schema'

export interface LoginLogFilters {
  username: string
  status: string
}

export interface OperationLogFilters {
  username: string
  module: string
  action: string
}

export class LogsRepository {
  constructor(private readonly db: Executor) {}

  async getAdminIdByUsername(username: string): Promise<number | null> {
    const [row] = await this.db
      .select({ id: admin_users.id })
      .from(admin_users)
      .where(eq(admin_users.username, username))
      .limit(1)
    return row?.id ?? null
  }

  async addOperationLog(item: PgInsertValue<typeof operation_logs>): Promise<void> {
    await this.db.insert(operation_logs).values(item)
  }

  async addLoginLog(item: PgInsertValue<typeof login_logs>): Promise<void> {
    await this.db.insert(login_logs).values(item)
  }

  private loginWhere(f: LoginLogFilters): SQL | undefined {
    return and(
      f.username ? ilike(login_logs.username, `%${f.username}%`) : undefined,
      f.status ? eq(login_logs.status, f.status) : undefined,
    )
  }

  private operationWhere(f: OperationLogFilters): SQL | undefined {
    return and(
      f.username ? ilike(operation_logs.username, `%${f.username}%`) : undefined,
      f.module ? eq(operation_logs.module, f.module) : undefined,
      f.action ? eq(operation_logs.action, f.action) : undefined,
    )
  }

  async listLoginLogsPage(page: number, perPage: number, f: LoginLogFilters): Promise<{ total: number; items: LoginLog[] }> {
    const where = this.loginWhere(f)
    const [totalRow] = await this.db.select({ n: count() }).from(login_logs).where(where)
    const items = await this.db
      .select()
      .from(login_logs)
      .where(where)
      .orderBy(desc(login_logs.id))
      .limit(perPage)
      .offset((page - 1) * perPage)
    return { total: totalRow?.n ?? 0, items }
  }

  async listOperationLogsPage(page: number, perPage: number, f: OperationLogFilters): Promise<{ total: number; items: OperationLog[] }> {
    const where = this.operationWhere(f)
    const [totalRow] = await this.db.select({ n: count() }).from(operation_logs).where(where)
    const items = await this.db
      .select()
      .from(operation_logs)
      .where(where)
      .orderBy(desc(operation_logs.id))
      .limit(perPage)
      .offset((page - 1) * perPage)
    return { total: totalRow?.n ?? 0, items }
  }

  async listLoginLogsFiltered(f: LoginLogFilters): Promise<LoginLog[]> {
    return this.db.select().from(login_logs).where(this.loginWhere(f)).orderBy(asc(login_logs.id))
  }

  async listOperationLogsFiltered(f: OperationLogFilters): Promise<OperationLog[]> {
    return this.db.select().from(operation_logs).where(this.operationWhere(f)).orderBy(asc(operation_logs.id))
  }

  async listLoginLogsByIds(ids: number[]): Promise<LoginLog[]> {
    if (ids.length === 0) return []
    return this.db.select().from(login_logs).where(inArray(login_logs.id, ids)).orderBy(asc(login_logs.id))
  }

  async listOperationLogsByIds(ids: number[]): Promise<OperationLog[]> {
    if (ids.length === 0) return []
    return this.db.select().from(operation_logs).where(inArray(operation_logs.id, ids)).orderBy(asc(operation_logs.id))
  }
}

/** 导入时的 created_at：naive 按原样写入；带时区的先换算成 UTC 再按会话时区赋给 timestamp 列（等价 psycopg2 的 ::timestamptz） */
export function importedTimestamp(naive: string, offsetMicros: number | null): SQL {
  if (offsetMicros === null) return sql`${naive}::timestamp`
  return sql`((${naive}::timestamp - make_interval(secs => ${offsetMicros / 1_000_000})) AT TIME ZONE 'UTC')`
}
