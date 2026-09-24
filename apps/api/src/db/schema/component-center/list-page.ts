/**
 * query_managements / query_management_versions
 * 对齐 AuraStack backend/app/component_center/model/entities_list_page.py
 *
 * 由 drizzle-kit pull 生成后整理。`$default` / `createdAt()` / `updatedAt()` 只在运行时生效，不进 DDL。
 */

import { relations } from 'drizzle-orm'
import { boolean, foreignKey, index, integer, pgTable, serial, text, timestamp, unique, varchar } from 'drizzle-orm/pg-core'
import { pyStr } from '@/common/py'
import { toIso } from '@/common/serialize'
import { createdAt, updatedAt } from '../columns'

export const query_managements = pgTable('query_managements', {
  id: serial().primaryKey().notNull(),
  name: varchar({ length: 120 }).notNull(),
  query_code: varchar({ length: 120 }).notNull(),
  category: varchar({ length: 50 }).$default(() => 'general'),
  keyword: varchar({ length: 200 }),
  data_source: varchar({ length: 100 }),
  owner: varchar({ length: 100 }),
  priority: integer().$default(() => 0),
  is_active: boolean().$default(() => true),
  description: text(),
  created_at: createdAt(),
  updated_at: updatedAt(),
  image_url: varchar({ length: 500 }),
  image_urls: text(),
  file_url: varchar({ length: 500 }),
  file_urls: text(),
  status: varchar({ length: 20 }).default('draft').notNull(),
  condition_logic: varchar({ length: 10 }).default('AND'),
  conditions_json: text(),
  display_config: text(),
  permission_config: text(),
  schema_config: text(),
  version: integer().default(1).notNull(),
  published_at: timestamp({ mode: 'string' }),
}, (table) => [
  index('ix_query_managements_category').using('btree', table.category),
  index('ix_query_managements_is_active').using('btree', table.is_active),
  index('ix_query_managements_owner').using('btree', table.owner),
  unique('query_managements_query_code_key').on(table.query_code),
])

export const query_management_versions = pgTable('query_management_versions', {
  id: serial().primaryKey().notNull(),
  query_management_id: integer().notNull(),
  version_no: integer().notNull(),
  action: varchar({ length: 20 }).$default(() => 'save'),
  snapshot_json: text().notNull(),
  operator: varchar({ length: 100 }),
  created_at: createdAt(),
}, (table) => [
  index('ix_query_management_versions_query_management_id').using('btree', table.query_management_id),
  foreignKey({
      columns: [table.query_management_id],
      foreignColumns: [query_managements.id],
      name: 'query_management_versions_query_management_id_fkey'
    }).onDelete('cascade'),
])

// ---- relations（对应 QueryManagementVersion.query_management / backref versions） ----

export const query_managements_relations = relations(query_managements, ({ many }) => ({
  versions: many(query_management_versions),
}))

export const query_management_versions_relations = relations(query_management_versions, ({ one }) => ({
  query_management: one(query_managements, {
    fields: [query_management_versions.query_management_id],
    references: [query_managements.id],
  }),
}))

// ---- 类型 ----

export type QueryManagement = typeof query_managements.$inferSelect
export type QueryManagementVersion = typeof query_management_versions.$inferSelect

// ---- toDict（对齐 Python to_dict 的键与值） ----

/** 模型内的 parse_json_url_list：空值 → []；JSON 数组 → 逐项 str().strip() 去空；其余 → [] */
function parseJsonUrlList(raw: string | null): string[] {
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed.map((v) => pyStr(v).trim()).filter(Boolean)
  } catch {
    return []
  }
  return []
}

/** 模型内的 parse_json_object：空值 → default；JSON 对象 → 对象；其余 → default */
function parseJsonObject<T>(raw: string | null, defaultValue: T): Record<string, unknown> | T {
  if (!raw) return defaultValue
  try {
    const parsed: unknown = JSON.parse(raw)
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>
  } catch {
    return defaultValue
  }
  return defaultValue
}

export function queryManagementToDict(item: QueryManagement) {
  let imageUrls = parseJsonUrlList(item.image_urls)
  let fileUrls = parseJsonUrlList(item.file_urls)
  if (imageUrls.length === 0 && item.image_url) imageUrls = [item.image_url]
  if (fileUrls.length === 0 && item.file_url) fileUrls = [item.file_url]

  return {
    id: item.id,
    name: item.name,
    query_code: item.query_code,
    category: item.category,
    keyword: item.keyword,
    data_source: item.data_source,
    owner: item.owner,
    image_url: item.image_url || (imageUrls.length > 0 ? imageUrls[0]! : null),
    image_urls: imageUrls,
    file_url: item.file_url || (fileUrls.length > 0 ? fileUrls[0]! : null),
    file_urls: fileUrls,
    priority: item.priority,
    is_active: item.is_active,
    status: item.status || 'draft',
    condition_logic: item.condition_logic || 'AND',
    conditions: parseJsonObject(item.conditions_json, { groups: [], items: [] }),
    display_config: parseJsonObject(item.display_config, {}),
    permission_config: parseJsonObject(item.permission_config, {}),
    schema_config: item.schema_config || '',
    version: item.version || 1,
    published_at: toIso(item.published_at),
    description: item.description,
    created_at: toIso(item.created_at),
    updated_at: toIso(item.updated_at),
  }
}

export type QueryManagementDict = ReturnType<typeof queryManagementToDict>

export function queryManagementVersionToDict(version: QueryManagementVersion) {
  let snapshot: Record<string, unknown> = {}
  try {
    const parsed: unknown = JSON.parse(version.snapshot_json || '{}')
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) snapshot = parsed as Record<string, unknown>
  } catch {
    snapshot = {}
  }
  return {
    id: version.id,
    query_management_id: version.query_management_id,
    version_no: version.version_no,
    action: version.action,
    operator: version.operator,
    snapshot,
    created_at: toIso(version.created_at),
  }
}
