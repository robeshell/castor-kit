/**
 * System settings module data access. The values themselves are read and written by SettingsStore
 * (common/settings.ts, shared by the whole app); this layer holds the lookups the settings page needs.
 */

import { inArray } from 'drizzle-orm'
import type { Executor } from '@/db/client'
import { roles } from '@/db/schema'

export class SettingsRepository {
  constructor(private readonly db: Executor) {}

  /** Which of these role codes exist */
  async existingRoleCodes(codes: string[]): Promise<Set<string>> {
    if (codes.length === 0) return new Set()
    const rows = await this.db.select({ code: roles.code }).from(roles).where(inArray(roles.code, codes))
    return new Set(rows.map((r) => r.code))
  }
}
