/**
 * 首页仪表盘 service 层（对齐 AuraStack backend/app/admin/api/dashboard.py 的统计逻辑）
 */

import type { Db } from '@/db/client'
import { DashboardRepository } from './repository'

export class DashboardService {
  private readonly repo: DashboardRepository

  constructor(db: Db) {
    this.repo = new DashboardRepository(db)
  }

  async stats() {
    const week = await this.repo.weekLogCounts()
    return {
      user_count: await this.repo.countUsers(),
      role_count: await this.repo.countRoles(),
      menu_count: await this.repo.countMenus(),
      today_log_count: await this.repo.countTodayLogs(),
      week_log_counts: week.map((d) => d.count),
      week_labels: week.map((d) => d.label),
    }
  }
}
