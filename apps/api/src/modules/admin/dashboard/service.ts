/**
 * Home dashboard service layer: statistics logic
 */

import type { Db } from '@/db/client'
import { DashboardRepository } from './repository'

export class DashboardService {
  private readonly repo: DashboardRepository

  constructor(db: Db) {
    this.repo = new DashboardRepository(db)
  }

  /** Counts; "today" and the week's days are dates in the caller's time zone */
  async stats(zone: string) {
    const week = await this.repo.weekLogCounts(zone)
    return {
      user_count: await this.repo.countUsers(),
      role_count: await this.repo.countRoles(),
      menu_count: await this.repo.countMenus(),
      today_log_count: await this.repo.countTodayLogs(zone),
      week_log_counts: week.map((d) => d.count),
      week_labels: week.map((d) => d.label),
    }
  }
}
