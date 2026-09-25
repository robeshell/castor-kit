/**
 * Dynamic form page repository layer (includes queries the service/model build directly)
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

  /** Equivalent of service._build_list_query */
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

  /** Only called when some column changed (updated_at is refreshed automatically by $onUpdateFn) */
  async update(id: number, values: DynamicFormRecordUpdate): Promise<void> {
    await this.db.update(dynamic_form_records).set(values).where(eq(dynamic_form_records.id, id))
  }

  /** Delete a record; its fields are removed via the FK's ON DELETE CASCADE (equivalent of cascade='all, delete-orphan') */
  async delete(id: number): Promise<void> {
    await this.db.delete(dynamic_form_records).where(eq(dynamic_form_records.id, id))
  }

  // ---- Dynamic fields ----

  async countFields(recordId: number): Promise<number> {
    const [row] = await this.db.select({ n: count() }).from(dynamic_form_fields).where(eq(dynamic_form_fields.record_id, recordId))
    return row?.n ?? 0
  }

  /**
   * A record's dynamic fields, `ORDER BY sort_order, sort_order` (id is not used as a tiebreaker;
   * PostgreSQL decides the order of fields with equal sort_order. The existing query shape is kept so field order of existing data doesn't change).
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
