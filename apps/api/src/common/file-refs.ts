/**
 * File references: business records declare which uploaded files they use, so the file center knows what is safe to
 * clean up (a file with no references 24h after upload is an orphan).
 *
 * Call syncFileRefs in the same transaction as the business write:
 *   await syncFileRefs(tx, 'admin_users', user.id, { avatar: values.avatar })
 * Values may be a file id or a file URL (/api/admin/files/<id>); anything else (external URLs, null) just clears the
 * reference. Call clearFileRefs when the record is deleted.
 */

import { and, eq, inArray } from 'drizzle-orm'
import type { Executor } from '@/db/client'
import { file_references, files } from '@/db/schema'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const FILE_URL_RE = /^\/api\/admin\/files\/([0-9a-f-]{36})$/i

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value)
}

/** File id behind a stored value (a bare id or a /api/admin/files/<id> URL), else null */
export function fileIdOf(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const text = value.trim()
  if (isUuid(text)) return text.toLowerCase()
  const match = FILE_URL_RE.exec(text)
  return match && isUuid(match[1]) ? match[1]!.toLowerCase() : null
}

/** URL the frontend uses to show / download a file */
export function fileUrl(id: string): string {
  return `/api/admin/files/${id}`
}

/**
 * Replace the references of the given fields of one record. Fields not listed are left alone; ids that don't exist in
 * `files` are ignored (the field value is kept as-is by the caller, it just isn't tracked).
 */
export async function syncFileRefs(
  db: Executor,
  refTable: string,
  refId: string | number,
  fields: Record<string, unknown>,
): Promise<void> {
  const id = String(refId)
  for (const [field, value] of Object.entries(fields)) {
    if (value === undefined) continue
    await db
      .delete(file_references)
      .where(and(eq(file_references.ref_table, refTable), eq(file_references.ref_id, id), eq(file_references.ref_field, field)))
    const fileIds = (Array.isArray(value) ? value : [value]).map(fileIdOf).filter((v): v is string => v !== null)
    if (fileIds.length === 0) continue
    const existing = await db.select({ id: files.id }).from(files).where(inArray(files.id, [...new Set(fileIds)]))
    if (existing.length === 0) continue
    await db
      .insert(file_references)
      .values(existing.map((f) => ({ file_id: f.id, ref_table: refTable, ref_id: id, ref_field: field })))
      .onConflictDoNothing()
  }
}

/** Drop every reference held by a record (call when it is deleted) */
export async function clearFileRefs(db: Executor, refTable: string, refId: string | number): Promise<void> {
  await db.delete(file_references).where(and(eq(file_references.ref_table, refTable), eq(file_references.ref_id, String(refId))))
}
