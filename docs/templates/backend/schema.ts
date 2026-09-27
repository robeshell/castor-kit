/**
 * Schema layer template → apps/api/src/modules/<domain>/<resource>/schema.ts
 *
 * TODO: replace <Resource> with the type name (PascalCase, e.g. Customer)
 * TODO: replace <resource> with the resource name (snake_case, e.g. customer)
 *
 * Responsibilities: the request body declaration and import/export field mapping. No database access.
 * The body is declared field by field with common/validation.ts; import rows go through the same declaration (rowToBody).
 */

import { z } from 'zod'
import { formatDateTime } from '@/common/serialize'
import { field } from '@/common/validation'
import type { <Resource> } from '@/db/schema'

/**
 * Request body. Pick the builder by column type: field.requiredText / text / int / optionalInt / decimal / bool /
 * optionalBool / date / dateTime / choice / fileId; wrap with required(…) or withDefault(…) when needed.
 */
export const <resource>Body = z.object({
  name: field.requiredText('名称', '名称不能为空'),
  // TODO: add other fields, e.g. sort_order: field.int('排序', 0), status: field.choice('状态', ['draft', 'published'] as const, 'draft')
})

export type <Resource>Input = z.output<typeof <resource>Body>

/** Export request: the rows (ids; none = every row), the columns (fields; none = every column), the file type */
export const <resource>ExportBody = z.object({
  ids: field.ids('导出记录'),
  fields: field.textList('导出字段'),
  file_type: field.text('文件类型'),
})

/**
 * Export columns: a header string (value taken from the same-named field of toDict), or [header, getter] (when a conversion is needed:
 * enum labels, booleans as yes / no text, times through formatDateTime, which writes the caller's wall time from X-Time-Zone).
 * Field validation errors also use these headers as field names.
 */
export type ExportColumn = string | [header: string, value: (item: <Resource>) => unknown]

export const EXPORT_FIELD_MAP: Record<string, ExportColumn> = {
  id: 'ID',
  name: '名称',
  // TODO: add other fields, e.g. status: ['状态', (item) => STATUS_LABELS[item.status ?? ''] ?? item.status]
  created_at: ['创建时间', (item) => formatDateTime(item.created_at)],
}

/** Display (Chinese) name of a field (taken from the export header; falls back to the field name if there is no export column) */
export function fieldLabel(field: string): string {
  const column = EXPORT_FIELD_MAP[field]
  return Array.isArray(column) ? column[0] : (column ?? field)
}

/** Import header mapping (key = Chinese header, value = field name); the first column is required */
export const IMPORT_HEADER_MAP: Record<string, string> = {
  名称: 'name',
  // TODO: add other importable fields
}

/**
 * An import row (text cells) → the request-body shape, checked by the same declaration.
 * TODO: convert non-text cells, e.g. `if (row.sort_order !== undefined) body.sort_order = /^[+-]?\d+$/.test(row.sort_order) ? Number(row.sort_order) : row.sort_order`
 * and `body.is_active = parseYesNo(row.is_active) ?? row.is_active` (parseYesNo from @/common/validation); a date-time cell is the
 * importer's wall time: `body.visited_at = withZoneOffset(row.visited_at)` (common/time-zone.ts) before field.dateTime
 */
export function rowToBody(row: Record<string, string>): Record<string, unknown> {
  return { ...row }
}

export interface ErrorRow {
  line: number
  reason: string
  row: Record<string, string>
}

export function buildErrorRow(line: number, reason: string, row: Record<string, unknown>): ErrorRow {
  return {
    line,
    reason,
    row: Object.fromEntries(Object.entries(row ?? {}).map(([k, v]) => [k, v === null || v === undefined ? '' : String(v)])),
  }
}
