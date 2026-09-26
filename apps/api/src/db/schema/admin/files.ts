/**
 * File center: uploaded files and the business records that reference them
 */

import { foreignKey, index, integer, pgTable, primaryKey, uuid, varchar } from 'drizzle-orm/pg-core'
import { toIso } from '@/common/serialize'
import { createdAt } from '../columns'
import { admin_users } from './rbac'

/**
 * One row per upload. Identical content shares one stored object (object_key is derived from sha256), so an object is
 * only removed with the last row pointing at it.
 */
export const files = pgTable(
  'files',
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    /** Driver that stored the object: 'local' | 's3' */
    storage: varchar({ length: 20 }).notNull(),
    /** S3 bucket (null for local) */
    bucket: varchar({ length: 100 }),
    object_key: varchar({ length: 200 }).notNull(),
    original_name: varchar({ length: 255 }).notNull(),
    mime_type: varchar({ length: 100 }).notNull(),
    size: integer().notNull(),
    sha256: varchar({ length: 64 }).notNull(),
    uploader_id: integer(),
    created_at: createdAt(),
  },
  (table) => [
    foreignKey({ columns: [table.uploader_id], foreignColumns: [admin_users.id], name: 'files_uploader_id_fkey' }).onDelete('set null'),
    index('files_sha256_idx').on(table.sha256),
    index('files_created_at_idx').on(table.created_at),
  ],
)

/** Which business record field uses which file; a file with no rows here for 24h is an orphan and gets cleaned up */
export const file_references = pgTable(
  'file_references',
  {
    file_id: uuid().notNull(),
    ref_table: varchar({ length: 50 }).notNull(),
    ref_id: varchar({ length: 50 }).notNull(),
    ref_field: varchar({ length: 50 }).notNull(),
    created_at: createdAt(),
  },
  (table) => [
    foreignKey({ columns: [table.file_id], foreignColumns: [files.id], name: 'file_references_file_id_fkey' }).onDelete('cascade'),
    primaryKey({ columns: [table.file_id, table.ref_table, table.ref_id, table.ref_field], name: 'file_references_pkey' }),
    index('file_references_ref_idx').on(table.ref_table, table.ref_id),
  ],
)

export type FileRecord = typeof files.$inferSelect
export type NewFileRecord = typeof files.$inferInsert

export function fileToDict(file: FileRecord & { uploader_name?: string | null; ref_count?: number }) {
  return {
    id: file.id,
    original_name: file.original_name,
    mime_type: file.mime_type,
    size: file.size,
    sha256: file.sha256,
    storage: file.storage,
    uploader_id: file.uploader_id,
    uploader_name: file.uploader_name ?? null,
    ref_count: file.ref_count ?? 0,
    url: `/api/admin/files/${file.id}`,
    created_at: toIso(file.created_at),
  }
}
