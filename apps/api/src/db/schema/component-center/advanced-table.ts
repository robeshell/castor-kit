/**
 * advanced_table_rows
 *
 * Column defaults in `.default()` are DB DEFAULTs; created_at/updated_at are app-side defaults via createdAt()/updatedAt() from ../columns.
 * score is numeric(7,2) (the driver returns a string); it is a 0–100 rating the page shows and edits as a number, so toDict returns a JSON number.
 */

import { boolean, date, integer, numeric, pgTable, serial, text, unique, varchar } from 'drizzle-orm/pg-core'
import { toIso } from '@/common/serialize'
import { createdAt, updatedAt } from '../columns'

export const advanced_table_rows = pgTable('advanced_table_rows', {
  id: serial().primaryKey().notNull(),
  row_code: varchar({ length: 80 }).notNull(),
  name: varchar({ length: 120 }).notNull(),
  category: varchar({ length: 50 }).default('general'),
  owner: varchar({ length: 100 }),
  status: varchar({ length: 20 }).default('draft').notNull(),
  priority: integer().default(0),
  progress: integer().default(0),
  score: numeric({ precision: 7, scale: 2 }).default('0'),
  tags: varchar({ length: 255 }),
  is_active: boolean().default(true),
  is_pinned: boolean().default(false),
  due_date: date({ mode: 'string' }),
  sort_order: integer().default(0),
  remark: text(),
  created_at: createdAt(),
  updated_at: updatedAt(),
}, (table) => [
  unique('advanced_table_rows_row_code_unique').on(table.row_code),
])

export type AdvancedTableRow = typeof advanced_table_rows.$inferSelect

/** Advanced table row output */
export function advancedTableRowToDict(r: AdvancedTableRow) {
  return {
    id: r.id,
    row_code: r.row_code,
    name: r.name,
    category: r.category,
    owner: r.owner,
    status: r.status || 'draft',
    priority: r.priority ?? 0,
    progress: r.progress ?? 0,
    // numeric text to a JSON number (NaN becomes null)
    score: r.score !== null ? Number(r.score) : 0.0,
    tags: r.tags || '',
    is_active: r.is_active,
    is_pinned: r.is_pinned,
    due_date: r.due_date || null,
    sort_order: r.sort_order ?? 0,
    remark: r.remark,
    created_at: toIso(r.created_at),
    updated_at: toIso(r.updated_at),
  }
}
