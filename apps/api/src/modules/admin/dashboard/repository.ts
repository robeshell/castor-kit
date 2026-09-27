/**
 * Home dashboard repository layer (read-only)
 *
 * Days are the caller's (common/time-zone.ts): "today" and the week's buckets are dates in that zone, computed in SQL.
 * Timestamps are stored as UTC without a zone, so a row's local day is timezone(zone, timezone('utc', created_at)).
 */

import { count, sql, type SQL } from 'drizzle-orm'
import type { Executor } from '@/db/client'
import { admin_users, menus, operation_logs, roles } from '@/db/schema'

/** Today's date in the zone */
const today = (zone: string) => sql`(timezone(${zone}, now()))::date`
/** The UTC timestamp at which a local date (in the zone) starts */
const dayStart = (zone: string, day: SQL) => sql`timezone('utc', timezone(${zone}, (${day})::timestamp))`
/** The local date (in the zone) of a UTC timestamp column */
const localDay = (zone: string, column: SQL | typeof operation_logs.created_at) => sql`(timezone(${zone}, timezone('utc', ${column})))::date`

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

  async countTodayLogs(zone: string): Promise<number> {
    const [row] = await this.db
      .select({ n: count() })
      .from(operation_logs)
      .where(
        sql`${operation_logs.created_at} >= ${dayStart(zone, today(zone))} AND ${operation_logs.created_at} < ${dayStart(zone, sql`${today(zone)} + 1`)}`,
      )
    return row?.n ?? 0
  }

  /** Daily operation log counts and `MM/DD` labels for the last 7 days (including today, ascending by date) */
  async weekLogCounts(zone: string): Promise<{ label: string; count: number }[]> {
    const day = localDay(zone, operation_logs.created_at)
    const result = await this.db.execute<{ label: string; cnt: number }>(sql`
      SELECT to_char(d.day, 'MM/DD') AS label, COALESCE(c.cnt, 0)::int AS cnt
      FROM generate_series(${today(zone)} - 6, ${today(zone)}, interval '1 day') AS d(day)
      LEFT JOIN (
        SELECT ${day} AS day, count(*) AS cnt
        FROM ${operation_logs}
        WHERE ${operation_logs.created_at} >= ${dayStart(zone, sql`${today(zone)} - 6`)}
          AND ${operation_logs.created_at} < ${dayStart(zone, sql`${today(zone)} + 1`)}
        GROUP BY 1
      ) AS c ON c.day = d.day::date
      ORDER BY d.day
    `)
    return result.rows.map((r) => ({ label: r.label, count: Number(r.cnt) }))
  }
}
