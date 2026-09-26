/**
 * System settings module data access. The values themselves are read and written by SettingsStore
 * (common/settings.ts, shared by the whole app); this layer holds the lookups the settings page needs.
 */

import { count, inArray } from 'drizzle-orm'
import type { Executor } from '@/db/client'
import { files, roles } from '@/db/schema'

export class SettingsRepository {
  constructor(private readonly db: Executor) {}

  /** Which of these role codes exist */
  async existingRoleCodes(codes: string[]): Promise<Set<string>> {
    if (codes.length === 0) return new Set()
    const rows = await this.db.select({ code: roles.code }).from(roles).where(inArray(roles.code, codes))
    return new Set(rows.map((r) => r.code))
  }

  /** Files per storage driver (the storage tab warns that changing the S3 connection strands existing s3 files) */
  async fileCountsByStorage(): Promise<Record<string, number>> {
    const rows = await this.db.select({ storage: files.storage, n: count() }).from(files).groupBy(files.storage)
    return Object.fromEntries(rows.map((r) => [r.storage, Number(r.n)]))
  }
}
