/**
 * System settings module data access. The values themselves are read and written by SettingsStore
 * (common/settings.ts, shared by the whole app); this layer holds the lookups the settings page needs.
 */

import { and, count, eq, inArray } from 'drizzle-orm'
import type { Executor } from '@/db/client'
import { admin_users, files, notifications, roles, user_roles } from '@/db/schema'

export class SettingsRepository {
  constructor(private readonly db: Executor) {}

  /** Which of these role codes exist */
  async existingRoleCodes(codes: string[]): Promise<Set<string>> {
    if (codes.length === 0) return new Set()
    const rows = await this.db.select({ code: roles.code }).from(roles).where(inArray(roles.code, codes))
    return new Set(rows.map((r) => r.code))
  }

  /** Active super admins (they get a notification whenever system settings change) */
  async activeSuperAdminIds(): Promise<number[]> {
    const rows = await this.db
      .selectDistinct({ id: admin_users.id })
      .from(admin_users)
      .innerJoin(user_roles, eq(user_roles.user_id, admin_users.id))
      .innerJoin(roles, eq(roles.id, user_roles.role_id))
      .where(and(eq(roles.code, 'super_admin'), eq(admin_users.status, 'active')))
    return rows.map((r) => r.id)
  }

  /** One personal notification per recipient */
  async notify(userIds: number[], values: { title: string; content: string; link: string }): Promise<void> {
    if (userIds.length === 0) return
    await this.db
      .insert(notifications)
      .values(userIds.map((user_id) => ({ ...values, noti_type: 'warning', is_global: false, user_id })))
  }

  /** Files per storage driver (the storage tab warns that changing the S3 connection strands existing s3 files) */
  async fileCountsByStorage(): Promise<Record<string, number>> {
    const rows = await this.db.select({ storage: files.storage, n: count() }).from(files).groupBy(files.storage)
    return Object.fromEntries(rows.map((r) => [r.storage, Number(r.n)]))
  }
}
