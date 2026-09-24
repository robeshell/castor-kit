/**
 * 公告管理 repository 层（对齐 AuraStack backend/app/admin/crud/announcement.py）
 */

import { and, asc, count, desc, eq, ilike, inArray, type SQL } from 'drizzle-orm'
import type { Executor } from '@/db/client'
import { announcements, type Announcement } from '@/db/schema'

export type AnnouncementInsert = typeof announcements.$inferInsert
export type AnnouncementUpdate = Partial<AnnouncementInsert>

export interface AnnouncementFilters {
  search: string
  status: string | null
  announceType: string | null
}

export class AnnouncementRepository {
  constructor(private readonly db: Executor) {}

  async get(id: number): Promise<Announcement | null> {
    const [row] = await this.db.select().from(announcements).where(eq(announcements.id, id)).limit(1)
    return row ?? null
  }

  async listPage(page: number, perPage: number, filters: AnnouncementFilters) {
    const conds: SQL[] = []
    if (filters.search) conds.push(ilike(announcements.title, `%${filters.search}%`))
    if (filters.status) conds.push(eq(announcements.status, filters.status))
    if (filters.announceType) conds.push(eq(announcements.announce_type, filters.announceType))
    const where = conds.length > 0 ? and(...conds) : undefined
    const [totalRow] = await this.db.select({ n: count() }).from(announcements).where(where)
    const rows = await this.db
      .select()
      .from(announcements)
      .where(where)
      .orderBy(desc(announcements.is_top), asc(announcements.sort_order), desc(announcements.id))
      .limit(perPage)
      .offset((page - 1) * perPage)
    return { total: totalRow?.n ?? 0, rows }
  }

  async listByIdsOrdered(ids: number[]): Promise<Announcement[]> {
    if (ids.length === 0) return []
    return this.db.select().from(announcements).where(inArray(announcements.id, ids)).orderBy(asc(announcements.id))
  }

  async listAllForExport(): Promise<Announcement[]> {
    return this.db.select().from(announcements).orderBy(desc(announcements.is_top), desc(announcements.id))
  }

  async insert(values: AnnouncementInsert): Promise<Announcement> {
    const [row] = await this.db.insert(announcements).values(values).returning()
    return row!
  }

  async update(id: number, values: AnnouncementUpdate): Promise<Announcement> {
    const [row] = await this.db.update(announcements).set(values).where(eq(announcements.id, id)).returning()
    return row!
  }

  async delete(id: number): Promise<void> {
    await this.db.delete(announcements).where(eq(announcements.id, id))
  }
}
