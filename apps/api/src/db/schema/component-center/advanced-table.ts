/**
 * cc_advanced_table_rows
 *
 * 由 drizzle-kit pull 生成后整理。category/status 等列在现库里有 DB DEFAULT（.default()）；
 * created_at/updated_at 是应用侧默认值，用 ../columns 的 createdAt()/updatedAt()。
 * score 是 numeric(7,2)，驱动返回字符串；注意 toDict 这里把它转成数字，输出 JSON 数字。
 */

import { boolean, date, integer, numeric, pgTable, serial, text, unique, varchar } from 'drizzle-orm/pg-core'
import { toIso } from '@/common/serialize'
import { createdAt, updatedAt } from '../columns'

export const cc_advanced_table_rows = pgTable('cc_advanced_table_rows', {
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
  unique('cc_advanced_table_rows_row_code_key').on(table.row_code),
])

export type AdvancedTableRow = typeof cc_advanced_table_rows.$inferSelect

/** 高级表格行输出 */
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
    // float(Decimal)：numeric 文本转 JSON 数字（NaN 经 JSON 序列化为 null）
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
