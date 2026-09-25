/**
 * Schema layer template → apps/api/src/modules/<domain>/<resource>/schema.ts
 *
 * TODO: replace <Resource> with the type name (PascalCase, e.g. Customer)
 * TODO: replace <resource> with the resource name (snake_case, e.g. customer)
 *
 * Responsibilities: request body normalization and import/export field mapping. No database access.
 * Request bodies are lenient: the `request.get_json() or {}` semantics come from jsonBody() in common/http;
 * here unknown values are normalized into column values by field type; throws ServiceError(400) when a value can't be converted.
 */

import { z } from 'zod'
import { ServiceError } from '@/common/errors'
import { pyStr } from '@/common/py'
import type { <Resource>, New<Resource> } from '@/db/schema'

/** Request body: loose + all optional (drives OpenAPI); normalization happens in buildValues */
export const <resource>BodySchema = z.record(z.string(), z.unknown()).nullish()

/**
 * Export columns: a header string (value taken from the same-named field of toDict), or [header, getter] (when a conversion is needed, e.g. showing enum labels in Chinese or booleans as yes/no).
 * Field validation errors also use these headers as field names.
 */
export type ExportColumn = string | [header: string, value: (item: <Resource>) => unknown]

export const EXPORT_FIELD_MAP: Record<string, ExportColumn> = {
  id: 'ID',
  name: '名称',
  // TODO: add other fields, e.g. status: ['状态', (item) => STATUS_LABELS[item.status ?? ''] ?? item.status]
  created_at: '创建时间',
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

export type <Resource>Values = Partial<Omit<New<Resource>, 'id' | 'created_at' | 'updated_at'>>

function invalid(field: string): ServiceError {
  return new ServiceError(`${fieldLabel(field)}的值无效`, 400)
}

function toStr(value: unknown): string | null {
  return value === null || value === undefined ? null : pyStr(value)
}

/** Example: integer field (parsed as an integer); empty values become null */
export function toInt(field: string, value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number' && Number.isInteger(value)) return value
  if (typeof value === 'string' && /^[+-]?\d+$/.test(value.trim())) return Number.parseInt(value.trim(), 10)
  throw invalid(field)
}

/**
 * Request body → column values.
 * - Create (partial=false): all fields are written; missing ones become null
 * - Update (partial=true): only fields present in the request body are written (`'x' in data`)
 */
export function buildValues(data: Record<string, unknown>, partial: boolean): <Resource>Values {
  const values: <Resource>Values = {}
  if (!partial || Object.hasOwn(data, 'name')) values.name = toStr(data.name) ?? ''
  // TODO: add other fields, e.g.
  // if (!partial || Object.hasOwn(data, 'sort_order')) values.sort_order = toInt('sort_order', data.sort_order)
  return values
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
