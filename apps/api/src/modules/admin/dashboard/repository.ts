/**
 * 首页仪表盘 repository 层（Python 版直接在 api/dashboard.py 里查询，这里下沉；只读）
 *
 * “今天”按 Python `datetime.utcnow().date()` 计算，全部下推到 SQL（不经过 JS Date）。
 */

import { count, sql } from 'drizzle-orm'
import type { Executor } from '@/db/client'
import { admin_users, menus, operation_logs, roles } from '@/db/schema'

const TODAY = sql`(timezone('utc', now()))::date`

export class DashboardRepository {
  constructor(private readonly db: Executor) {}

  async countUsers(): Promise<number> {
    const [row] = await this.db.select({ n: count() }).from(admin_users)
    return row?.n ?? 0
  }

  async countRoles(): Promise<number> {
    const [row] = await this.db.select({ n: count() }).from(roles)
    return row?.n ?? 0
  }

  async countMenus(): Promise<number> {
    const [row] = await this.db.select({ n: count() }).from(menus)
    return row?.n ?? 0
  }

  async countTodayLogs(): Promise<number> {
    const [row] = await this.db
      .select({ n: count() })
      .from(operation_logs)
      .where(sql`${operation_logs.created_at} >= ${TODAY}::timestamp`)
    return row?.n ?? 0
  }

  /** 近 7 天（含今天，按日期升序）每日操作日志数与 `MM/DD` 标签 */
  async weekLogCounts(): Promise<{ label: string; count: number }[]> {
    const result = await this.db.execute<{ label: string; cnt: number }>(sql`
      SELECT to_char(d.day, 'MM/DD') AS label, COALESCE(c.cnt, 0)::int AS cnt
      FROM generate_series(${TODAY} - 6, ${TODAY}, interval '1 day') AS d(day)
      LEFT JOIN (
        SELECT date(${operation_logs.created_at}) AS day, count(*) AS cnt
        FROM ${operation_logs}
        WHERE ${operation_logs.created_at} >= (${TODAY} - 6)::timestamp
        GROUP BY date(${operation_logs.created_at})
      ) AS c ON c.day = d.day::date
      ORDER BY d.day
    `)
    return result.rows.map((r) => ({ label: r.label, count: Number(r.cnt) }))
  }
}
