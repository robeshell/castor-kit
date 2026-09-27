/**
 * saved_queries / saved_query_versions
 *
 * `$default` / `createdAt()` / `updatedAt()` are app-side defaults: they apply at runtime and don't go into the DDL.
 */

import { relations } from 'drizzle-orm'
import { boolean, foreignKey, index, integer, pgTable, serial, text, timestamp, unique, varchar } from 'drizzle-orm/pg-core'
import { toIso } from '@/common/serialize'
import { createdAt, updatedAt } from '../columns'

export const saved_queries = pgTable('saved_queries', {
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
  image_urls: text(),
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
  index('saved_queries_category_idx').using('btree', table.category),
  index('saved_queries_is_active_idx').using('btree', table.is_active),
  index('saved_queries_owner_idx').using('btree', table.owner),
  unique('saved_queries_query_code_unique').on(table.query_code),
])

export const saved_query_versions = pgTable('saved_query_versions', {
  id: serial().primaryKey().notNull(),
  query_id: integer().notNull(),
  version_no: integer().notNull(),
  action: varchar({ length: 20 }).$default(() => 'save'),
  snapshot_json: text().notNull(),
  operator: varchar({ length: 100 }),
  created_at: createdAt(),
}, (table) => [
  index('saved_query_versions_query_id_idx').using('btree', table.query_id),
  foreignKey({
      columns: [table.query_id],
      foreignColumns: [saved_queries.id],
      name: 'saved_query_versions_query_id_fk'
    }).onDelete('cascade'),
])

// ---- relations: a saved query has many versions ----

export const saved_queries_relations = relations(saved_queries, ({ many }) => ({
  versions: many(saved_query_versions),
}))

export const saved_query_versions_relations = relations(saved_query_versions, ({ one }) => ({
  query: one(saved_queries, {
    fields: [saved_query_versions.query_id],
    references: [saved_queries.id],
  }),
}))

// ---- Types ----

export type SavedQuery = typeof saved_queries.$inferSelect
export type SavedQueryVersion = typeof saved_query_versions.$inferSelect

// ---- toDict (API output keys and values) ----

/** A stored JSON URL list: empty or not an array → []; each string item trimmed, blanks dropped */
function parseJsonUrlList(raw: string | null): string[] {
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed.filter((v): v is string => typeof v === 'string').map((v) => v.trim()).filter(Boolean)
  } catch {
    return []
  }
  return []
}

/** A stored JSON object: empty → default; JSON object → the object; anything else → default */
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

export function savedQueryToDict(item: SavedQuery) {
  return {
    id: item.id,
    name: item.name,
    query_code: item.query_code,
    category: item.category,
    keyword: item.keyword,
    data_source: item.data_source,
    owner: item.owner,
    image_urls: parseJsonUrlList(item.image_urls),
    file_urls: parseJsonUrlList(item.file_urls),
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

export type SavedQueryDict = ReturnType<typeof savedQueryToDict>

export function savedQueryVersionToDict(version: SavedQueryVersion) {
  let snapshot: Record<string, unknown> = {}
  try {
    const parsed: unknown = JSON.parse(version.snapshot_json || '{}')
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) snapshot = parsed as Record<string, unknown>
  } catch {
    snapshot = {}
  }
  return {
    id: version.id,
    query_id: version.query_id,
    version_no: version.version_no,
    action: version.action,
    operator: version.operator,
    snapshot,
    created_at: toIso(version.created_at),
  }
}
