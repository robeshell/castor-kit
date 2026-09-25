/**
 * dict_types / dict_items
 *
 * `.$default()` / createdAt() / updatedAt() 只是应用侧默认值（库里没有 DEFAULT），不进 DDL。
 * 注意插入时值为 null 的列要转成 undefined（省略该列）才会触发应用侧默认值。
 */

import { relations } from 'drizzle-orm'
import { boolean, foreignKey, index, integer, pgTable, serial, text, unique, varchar } from 'drizzle-orm/pg-core'
import { toIso } from '@/common/serialize'
import { createdAt, updatedAt } from '../columns'

export const dict_types = pgTable('dict_types', {
  id: serial().primaryKey().notNull(),
  name: varchar({ length: 100 }).notNull(),
  code: varchar({ length: 100 }).notNull(),
  description: text(),
  sort_order: integer().$default(() => 0),
  is_active: boolean().$default(() => true),
  created_at: createdAt(),
  updated_at: updatedAt(),
}, (table) => [
  unique('dict_types_code_key').on(table.code),
])

export const dict_items = pgTable('dict_items', {
  id: serial().primaryKey().notNull(),
  dict_type_id: integer().notNull(),
  label: varchar({ length: 100 }).notNull(),
  value: varchar({ length: 100 }).notNull(),
  color: varchar({ length: 30 }),
  sort_order: integer().$default(() => 0),
  is_default: boolean().$default(() => false),
  is_active: boolean().$default(() => true),
  description: text(),
  created_at: createdAt(),
  updated_at: updatedAt(),
}, (table) => [
  index('ix_dict_items_dict_type_id').using('btree', table.dict_type_id),
  foreignKey({
      columns: [table.dict_type_id],
      foreignColumns: [dict_types.id],
      name: 'dict_items_dict_type_id_fkey'
    }).onDelete('cascade'),
  unique('uq_dict_items_type_value').on(table.dict_type_id, table.value),
])

export const dict_types_relations = relations(dict_types, ({ many }) => ({
  items: many(dict_items),
}))

export const dict_items_relations = relations(dict_items, ({ one }) => ({
  dict_type: one(dict_types, { fields: [dict_items.dict_type_id], references: [dict_types.id] }),
}))

export type DictType = typeof dict_types.$inferSelect
export type DictItem = typeof dict_items.$inferSelect

/** 字典项输出：传入 dictType 时带 dict_type_code / dict_type_name */
export function dictItemToDict(item: DictItem, dictType?: Pick<DictType, 'code' | 'name'> | null) {
  const data: Record<string, unknown> = {
    id: item.id,
    dict_type_id: item.dict_type_id,
    label: item.label,
    value: item.value,
    color: item.color,
    sort_order: item.sort_order,
    is_default: item.is_default,
    is_active: item.is_active,
    description: item.description,
    created_at: toIso(item.created_at),
    updated_at: toIso(item.updated_at),
  }
  if (dictType) {
    data.dict_type_code = dictType.code
    data.dict_type_name = dictType.name
  }
  return data
}

/** 字典类型输出：item_count 由调用方查好传入；传入 items（已按 sort_order, id 升序）时附带 items */
export function dictTypeToDict(type: DictType, itemCount: number, items?: DictItem[]) {
  const data: Record<string, unknown> = {
    id: type.id,
    name: type.name,
    code: type.code,
    description: type.description,
    sort_order: type.sort_order,
    is_active: type.is_active,
    item_count: itemCount,
    created_at: toIso(type.created_at),
    updated_at: toIso(type.updated_at),
  }
  if (items) data.items = items.map((item) => dictItemToDict(item))
  return data
}
