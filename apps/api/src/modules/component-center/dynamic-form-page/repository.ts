/**
 * 动态表单页 repository 层（含 service/model 里直接拼的查询）
 */

import { and, asc, count, desc, eq, ilike, inArray, or, sql, type SQL } from 'drizzle-orm'
import type { Executor } from '@/db/client'
import { dynamic_form_fields, dynamic_form_records, type DynamicFormField, type DynamicFormRecord } from '@/db/schema'

export interface DynamicFormListFilters {
  search: string
  category: string
  status: string
  owner: string
  isActive: boolean | null
}

export type DynamicFormRecordInsert = typeof dynamic_form_records.$inferInsert
export type DynamicFormRecordUpdate = Partial<Omit<DynamicFormRecordInsert, 'id' | 'created_at' | 'updated_at'>>
export type DynamicFormFieldInsert = typeof dynamic_form_fields.$inferInsert

export type DynamicFormRecordWithCount = DynamicFormRecord & { fields_count: number }

/** `record.fields.count()` */
const fieldsCountSql = sql<number>`(select count(*) from "dynamic_form_fields" as "f" where "f"."record_id" = "dynamic_form_records"."id")`.mapWith(Number)

export class DynamicFormPageRepository {
  constructor(private readonly db: Executor) {}

  /** 对应 service._build_list_query */
  private listWhere(f: DynamicFormListFilters): SQL | undefined {
    const conds: (SQL | undefined)[] = []
    if (f.search) {
      conds.push(
        or(
          ilike(dynamic_form_records.title, `%${f.search}%`),
          ilike(dynamic_form_records.record_code, `%${f.search}%`),
          ilike(dynamic_form_records.owner, `%${f.search}%`),
        ),
      )
    }
    if (f.category) conds.push(eq(dynamic_form_records.category, f.category))
    if (f.status) conds.push(eq(dynamic_form_records.status, f.status))
    if (f.owner) conds.push(ilike(dynamic_form_records.owner, `%${f.owner}%`))
    if (f.isActive !== null) conds.push(eq(dynamic_form_records.is_active, f.isActive))
    return conds.length > 0 ? and(...conds) : undefined
  }

  private selectWithCount() {
    return this.db.select({ record: dynamic_form_records, fields_count: fieldsCountSql }).from(dynamic_form_records)
  }

  private static flatten(rows: { record: DynamicFormRecord; fields_count: number }[]): DynamicFormRecordWithCount[] {
    return rows.map((r) => ({ ...r.record, fields_count: r.fields_count }))
  }

  async listPage(page: number, perPage: number, filters: DynamicFormListFilters) {
    const where = this.listWhere(filters)
    const [totalRow] = await this.db.select({ n: count() }).from(dynamic_form_records).where(where)
    const rows = await this.selectWithCount()
      .where(where)
      .orderBy(desc(dynamic_form_records.priority), desc(dynamic_form_records.id))
      .limit(perPage)
      .offset((page - 1) * perPage)
    return { total: totalRow?.n ?? 0, items: DynamicFormPageRepository.flatten(rows) }
  }

  async listAllOrdered(filters: DynamicFormListFilters): Promise<DynamicFormRecordWithCount[]> {
    const rows = await this.selectWithCount().where(this.listWhere(filters)).orderBy(asc(dynamic_form_records.id))
    return DynamicFormPageRepository.flatten(rows)
  }

  async listByIdsOrdered(ids: number[]): Promise<DynamicFormRecordWithCount[]> {
    if (ids.length === 0) return []
    const rows = await this.selectWithCount()
      .where(inArray(dynamic_form_records.id, ids))
      .orderBy(asc(dynamic_form_records.id))
    return DynamicFormPageRepository.flatten(rows)
  }

  async getById(id: number): Promise<DynamicFormRecord | null> {
    const [row] = await this.db.select().from(dynamic_form_records).where(eq(dynamic_form_records.id, id)).limit(1)
    return row ?? null
  }

  async getByCode(recordCode: string): Promise<DynamicFormRecord | null> {
    const [row] = await this.db
      .select()
      .from(dynamic_form_records)
      .where(eq(dynamic_form_records.record_code, recordCode))
      .limit(1)
    return row ?? null
  }

  async insert(values: DynamicFormRecordInsert): Promise<DynamicFormRecord> {
    const [row] = await this.db.insert(dynamic_form_records).values(values).returning()
    return row!
  }

  /** 只在有变更列时调用（updated_at 由 $onUpdateFn 自动刷新） */
  async update(id: number, values: DynamicFormRecordUpdate): Promise<void> {
    await this.db.update(dynamic_form_records).set(values).where(eq(dynamic_form_records.id, id))
  }

  /** 删除记录；字段由外键 ON DELETE CASCADE 一并删除（对应 cascade='all, delete-orphan'） */
  async delete(id: number): Promise<void> {
    await this.db.delete(dynamic_form_records).where(eq(dynamic_form_records.id, id))
  }

  // ---- 动态字段 ----

  async countFields(recordId: number): Promise<number> {
    const [row] = await this.db.select({ n: count() }).from(dynamic_form_fields).where(eq(dynamic_form_fields.record_id, recordId))
    return row?.n ?? 0
  }

  /**
   * 记录的动态字段，`ORDER BY sort_order, sort_order`（不加 id 作为次序键，
   * sort_order 相同的字段顺序由 PostgreSQL 决定；保持既有查询形状，避免改变已有数据的字段顺序）。
   */
  async listFields(recordId: number): Promise<DynamicFormField[]> {
    return this.db
      .select()
      .from(dynamic_form_fields)
      .where(eq(dynamic_form_fields.record_id, recordId))
      .orderBy(asc(dynamic_form_fields.sort_order), asc(dynamic_form_fields.sort_order))
  }

  async deleteFieldsByRecord(recordId: number): Promise<void> {
    await this.db.delete(dynamic_form_fields).where(eq(dynamic_form_fields.record_id, recordId))
  }

  async insertFields(rows: DynamicFormFieldInsert[]): Promise<void> {
    if (rows.length === 0) return
    await this.db.insert(dynamic_form_fields).values(rows)
  }
}
