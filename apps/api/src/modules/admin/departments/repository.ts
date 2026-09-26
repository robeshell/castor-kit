/**
 * Departments module repository layer
 */

import { and, asc, count, eq, inArray, isNull, ne } from 'drizzle-orm'
import { wouldCreateCycle } from '@/common/tree'
import type { Executor } from '@/db/client'
import { admin_users, departments, type Department } from '@/db/schema'

export type DepartmentValues = Partial<Omit<typeof departments.$inferInsert, 'id' | 'created_at' | 'updated_at'>>

export class DepartmentRepository {
  constructor(private readonly db: Executor) {}

  /** Every department, ordered for tree building: sort_order, then id */
  async listAll(): Promise<Department[]> {
    return this.db.select().from(departments).orderBy(asc(departments.sort_order), asc(departments.id))
  }

  async getById(id: number): Promise<Department | null> {
    const [row] = await this.db.select().from(departments).where(eq(departments.id, id)).limit(1)
    return row ?? null
  }

  async getByCode(code: string, excludeId?: number): Promise<Department | null> {
    const [row] = await this.db
      .select()
      .from(departments)
      .where(and(eq(departments.code, code), excludeId ? ne(departments.id, excludeId) : undefined))
      .limit(1)
    return row ?? null
  }

  async insert(values: DepartmentValues & Pick<Department, 'name' | 'code'>): Promise<Department> {
    const [row] = await this.db.insert(departments).values(values).returning()
    return row!
  }

  async update(id: number, values: DepartmentValues): Promise<void> {
    if (Object.keys(values).length === 0) return
    await this.db.update(departments).set(values).where(eq(departments.id, id))
  }

  async delete(id: number): Promise<void> {
    await this.db.delete(departments).where(eq(departments.id, id))
  }

  /** Siblings under parentId (NULL = top level), in display order */
  async listSiblings(parentId: number | null): Promise<Department[]> {
    return this.db
      .select()
      .from(departments)
      .where(parentId === null ? isNull(departments.parent_id) : eq(departments.parent_id, parentId))
      .orderBy(asc(departments.sort_order), asc(departments.id))
  }

  async countChildren(id: number): Promise<number> {
    const [row] = await this.db.select({ n: count() }).from(departments).where(eq(departments.parent_id, id))
    return row?.n ?? 0
  }

  async countUsers(id: number): Promise<number> {
    const [row] = await this.db.select({ n: count() }).from(admin_users).where(eq(admin_users.dept_id, id))
    return row?.n ?? 0
  }

  /** dept_id → number of users directly in that department */
  async userCountsByDept(): Promise<Map<number, number>> {
    const rows = await this.db
      .select({ dept_id: admin_users.dept_id, n: count() })
      .from(admin_users)
      .groupBy(admin_users.dept_id)
    return new Map(rows.filter((r) => r.dept_id !== null).map((r) => [r.dept_id!, r.n]))
  }

  /** id → display name (nickname, else username) for the given users */
  async userNames(ids: number[]): Promise<Map<number, string>> {
    if (ids.length === 0) return new Map()
    const rows = await this.db
      .select({ id: admin_users.id, username: admin_users.username, nickname: admin_users.nickname })
      .from(admin_users)
      .where(inArray(admin_users.id, ids))
    return new Map(rows.map((r) => [r.id, r.nickname || r.username]))
  }

  wouldCreateCycle(id: number, newParentId: number): Promise<boolean> {
    return wouldCreateCycle(this.db, 'departments', id, newParentId)
  }
}
