/**
 * dynamic_form_records / dynamic_form_fields
 *
 * dynamic_form_fields.record_id has an ON DELETE CASCADE foreign key; see relations below for the fields/record relationship.
 */

import { relations } from 'drizzle-orm'
import { boolean, foreignKey, integer, pgTable, serial, text, unique, varchar } from 'drizzle-orm/pg-core'
import { toIso } from '@/common/serialize'
import { createdAt, updatedAt } from '../columns'

export const dynamic_form_records = pgTable('dynamic_form_records', {
  id: serial().primaryKey().notNull(),
  title: varchar({ length: 120 }).notNull(),
  record_code: varchar({ length: 120 }).notNull(),
  category: varchar({ length: 50 }).default('general'),
  status: varchar({ length: 20 }).default('draft').notNull(),
  owner: varchar({ length: 100 }),
  priority: integer().default(0),
  is_active: boolean().default(true),
  description: text(),
  created_at: createdAt(),
  updated_at: updatedAt(),
}, (table) => [
  unique('dynamic_form_records_record_code_key').on(table.record_code),
])

export const dynamic_form_fields = pgTable('dynamic_form_fields', {
  id: serial().primaryKey().notNull(),
  record_id: integer().notNull(),
  field_key: varchar({ length: 100 }),
  field_value: varchar({ length: 500 }),
  field_type: varchar({ length: 50 }).default('text'),
  sort_order: integer().default(0),
  remark: varchar({ length: 200 }),
  created_at: createdAt(),
}, (table) => [
  foreignKey({
      columns: [table.record_id],
      foreignColumns: [dynamic_form_records.id],
      name: 'dynamic_form_fields_record_id_fkey'
    }).onDelete('cascade'),
])

export const dynamic_form_records_relations = relations(dynamic_form_records, ({ many }) => ({
  fields: many(dynamic_form_fields),
}))

export const dynamic_form_fields_relations = relations(dynamic_form_fields, ({ one }) => ({
  record: one(dynamic_form_records, { fields: [dynamic_form_fields.record_id], references: [dynamic_form_records.id] }),
}))

export type DynamicFormRecord = typeof dynamic_form_records.$inferSelect
export type DynamicFormField = typeof dynamic_form_fields.$inferSelect

export function dynamicFormFieldToDict(field: DynamicFormField) {
  return {
    id: field.id,
    record_id: field.record_id,
    field_key: field.field_key || '',
    field_value: field.field_value || '',
    field_type: field.field_type || 'text',
    sort_order: field.sort_order ?? 0,
    remark: field.remark || '',
    created_at: toIso(field.created_at),
  }
}

/**
 * Record output: fields_count is the record's field count; includes a fields key when fields are passed (already sorted by sort_order).
 */
export function dynamicFormRecordToDict(record: DynamicFormRecord, fieldsCount: number, fields?: DynamicFormField[]) {
  const d: Record<string, unknown> = {
    id: record.id,
    title: record.title,
    record_code: record.record_code,
    category: record.category || 'general',
    status: record.status || 'draft',
    owner: record.owner,
    priority: record.priority ?? 0,
    is_active: record.is_active,
    description: record.description,
    fields_count: fieldsCount,
    created_at: toIso(record.created_at),
    updated_at: toIso(record.updated_at),
  }
  if (fields) d.fields = fields.map(dynamicFormFieldToDict)
  return d
}
