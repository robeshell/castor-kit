/**
 * 详情标签页 repository 层（对齐 AuraStack backend/app/component_center/crud/detail_tabs_page.py）
 */

import { asc, eq, ilike, or } from 'drizzle-orm'
import type { Executor } from '@/db/client'
import { cc_detail_members, type DetailMember } from '@/db/schema'

const INT32_MIN = -2_147_483_648
const INT32_MAX = 2_147_483_647

export type DetailMemberInsert = typeof cc_detail_members.$inferInsert
export type DetailMemberPatch = Partial<Omit<DetailMember, 'id' | 'created_at' | 'updated_at'>>

export class DetailTabsRepository {
  constructor(private readonly db: Executor) {}

  async allMembers(search: string | null): Promise<DetailMember[]> {
    const like = `%${search}%`
    const where = search
      ? or(ilike(cc_detail_members.name, like), ilike(cc_detail_members.department, like), ilike(cc_detail_members.role_title, like))
      : undefined
    return this.db.select().from(cc_detail_members).where(where).orderBy(asc(cc_detail_members.sort_order))
  }

  async getMember(id: number): Promise<DetailMember | null> {
    if (!Number.isInteger(id) || id < INT32_MIN || id > INT32_MAX) return null
    const [row] = await this.db.select().from(cc_detail_members).where(eq(cc_detail_members.id, id))
    return row ?? null
  }

  async insert(values: DetailMemberInsert): Promise<DetailMember> {
    const [row] = await this.db.insert(cc_detail_members).values(values).returning()
    return row!
  }

  async update(id: number, patch: DetailMemberPatch): Promise<void> {
    await this.db.update(cc_detail_members).set(patch).where(eq(cc_detail_members.id, id))
  }

  async delete(id: number): Promise<void> {
    await this.db.delete(cc_detail_members).where(eq(cc_detail_members.id, id))
  }
}
