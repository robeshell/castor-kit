/**
 * Request body validation. Each module declares its JSON body as a Zod object built from these fields, and the route
 * parses it after the permission check (a route-level `schema: { body }` would run before authentication and answer
 * 400 where the caller should get 401 / 403).
 *
 * Fields take JSON types only: text is a string, integers are numbers, booleans are true / false. A value of the wrong
 * type is the caller's error → 400「<label>的值无效」. Query strings and import-file cells are always text and have their
 * own parsers in the modules.
 *
 * ```ts
 * export const itemBody = z.object({
 *   name: field.requiredText('名称', '名称不能为空'),
 *   sort_order: field.int('排序', 0),
 *   is_active: field.bool('是否启用', true),
 * })
 * const values = parseBody(itemBody, request.body)    // create: missing fields take their defaults
 * const changes = parsePatch(itemBody, request.body)  // update: only the fields present in the body
 * ```
 */

import { z } from 'zod'
import { invalidInput, ServiceError } from './errors'

/** 「<label>的值无效」: the message for a value of the wrong type */
export const invalidMessage = (label: string) => `${label}的值无效`
const invalid = invalidMessage

export const field = {
  /** Required text, trimmed; missing / null / blank → `emptyMessage` */
  requiredText: (label: string, emptyMessage: string) =>
    z.preprocess((v) => v ?? '', z.string({ error: invalid(label) }).trim().min(1, { error: emptyMessage })),

  /** Optional text, trimmed; missing / null / blank → null */
  text: (label: string) =>
    z
      .string({ error: invalid(label) })
      .trim()
      .nullish()
      .transform((v) => v || null),

  /** A password or other secret: a string kept exactly as sent (no trimming); missing / null → null */
  secret: (label: string) =>
    z
      .string({ error: invalid(label) })
      .nullish()
      .transform((v) => v ?? null),

  /** Integer; missing / null → `fallback` */
  int: (label: string, fallback: number, options: IntRange = {}) =>
    intSchema(label, options)
      .nullish()
      .transform((v) => v ?? fallback),

  /** Optional integer; missing / null → null */
  optionalInt: (label: string, options: IntRange = {}) =>
    intSchema(label, options)
      .nullish()
      .transform((v) => v ?? null),

  /** A number (decimals allowed, finite); missing / null → `fallback` */
  number: (label: string, fallback: number) =>
    z
      .number({ error: invalid(label) })
      .refine(Number.isFinite, { error: invalid(label) })
      .nullish()
      .transform((v) => v ?? fallback),

  /** Boolean (true / false only); missing / null → `fallback` */
  bool: (label: string, fallback: boolean) =>
    z
      .boolean({ error: invalid(label) })
      .nullish()
      .transform((v) => v ?? fallback),

  /** One of `values`; missing / null / '' → `fallback` */
  choice: <const T extends readonly [string, ...string[]]>(label: string, values: T, fallback: T[number], message = invalid(label)) =>
    z.preprocess(
      (v) => (v === '' ? null : v),
      z
        .enum(values, { error: message })
        .nullish()
        .transform((v): T[number] => v ?? fallback),
    ),

  /** A calendar date `YYYY-MM-DD`; missing / null / '' → null */
  date: (label: string) =>
    z.preprocess(
      (v) => (v === '' ? null : v),
      z
        .string({ error: invalid(label) })
        .trim()
        .refine(isDate, { error: invalid(label) })
        .nullish()
        .transform((v) => v ?? null),
    ),

  /**
   * A date and time `YYYY-MM-DD HH:MM[:SS[.ffffff]]` (`T` also accepted as the separator), optionally with an offset
   * (`Z` / `±HH:MM`); returned with a space separator and `Z` as `+00:00`. Missing / null / '' → null.
   */
  dateTime: (label: string) =>
    z.preprocess(
      (v) => (v === '' ? null : v),
      z
        .string({ error: invalid(label) })
        .trim()
        .refine(isDateTime, { error: invalid(label) })
        .nullish()
        .transform((v) => (v ? v.replace('T', ' ').replace(/Z$/, '+00:00') : null)),
    ),

  /** List of strings, each trimmed, blanks dropped; missing / null → [] */
  textList: (label: string) =>
    z
      .array(z.string({ error: invalid(label) }).trim(), { error: invalid(label) })
      .nullish()
      .transform((v) => (v ?? []).filter(Boolean)),

  /** Record id (a positive int4, the id column type); missing / null → null */
  id: (label: string) => field.optionalInt(label, { min: 1, max: INT4_MAX }),

  /** List of record ids; missing / null → [] (duplicates removed) */
  ids: (label: string) =>
    z
      .array(intSchema(label, { min: 1, max: INT4_MAX }), { error: invalid(label) })
      .nullish()
      .transform((v) => [...new Set(v ?? [])]),
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/
const DATE_TIME_RE = /^(\d{4}-\d{2}-\d{2})[ T]([01]\d|2[0-3]):[0-5]\d(:[0-5]\d(\.\d{1,6})?)?(Z|[+-]([01]\d|2[0-3]):[0-5]\d)?$/

/** `YYYY-MM-DD` naming a real day (no 2026-02-30) */
export function isDate(text: string): boolean {
  const m = DATE_RE.exec(text)
  if (!m) return false
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])]
  if (year < 1 || month < 1 || month > 12 || day < 1) return false
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  return day <= [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]!
}

function isDateTime(text: string): boolean {
  const m = DATE_TIME_RE.exec(text)
  return m !== null && isDate(m[1]!)
}

const INT4_MAX = 2_147_483_647

interface IntRange {
  min?: number
  max?: number
}

function intSchema(label: string, { min, max }: IntRange) {
  let schema = z.number({ error: invalid(label) }).int({ error: invalid(label) })
  if (min !== undefined) schema = schema.min(min, { error: invalid(label) })
  if (max !== undefined) schema = schema.max(max, { error: invalid(label) })
  return schema
}

/**
 * The export request of a list page: the rows (`selected` ids or the current `filters`), the columns (`fields`, unknown
 * ones dropped by exportColumns) and the file type. `filters` is the module's own shape of filter fields.
 */
export function exportBody<F extends z.ZodRawShape>(filters: F, defaultMode: 'selected' | 'filtered' | 'all' = 'selected') {
  return z.object({
    ids: field.ids('导出记录'),
    fields: field.textList('导出字段'),
    export_mode: field.choice('导出范围', ['selected', 'filtered', 'all'], defaultMode),
    filters: z.preprocess((v) => v ?? {}, z.object(filters, { error: invalid('筛选条件') })),
    file_type: field.text('文件类型'),
  })
}

/** The requested export columns that exist, in request order; none → every column */
export function exportColumns(fields: string[], columns: Record<string, unknown>): string[] {
  const valid = fields.filter((f) => Object.hasOwn(columns, f))
  return valid.length > 0 ? valid : Object.keys(columns)
}

// ---- Text input: query strings and import-file cells are always text ----

const YES = new Set(['1', 'true', 'yes', 'on', '是', '启用'])
const NO = new Set(['0', 'false', 'no', 'off', '否', '停用'])

/** A yes / no written as text (`true` / `1` / `是` / `启用`, `false` / `0` / `否` / `停用` …); empty or unrecognised → fallback */
export function parseYesNo(text: string | null | undefined, fallback: boolean | null = null): boolean | null {
  const value = (text ?? '').trim().toLowerCase()
  if (YES.has(value)) return true
  if (NO.has(value)) return false
  return fallback
}

/** A number written as text; empty or not a number → fallback */
export function parseNumberText(text: string | null | undefined, fallback: number): number {
  const value = (text ?? '').trim()
  return /^[+-]?(\d+\.?\d*|\.\d+)$/.test(value) ? Number(value) : fallback
}

/** An integer written as text; empty or not an integer → fallback */
export function parseIntText(text: string | null | undefined, fallback: number): number {
  const value = (text ?? '').trim()
  return /^[+-]?\d+$/.test(value) ? Number.parseInt(value, 10) : fallback
}

type BodySchema = z.ZodObject<z.ZodRawShape>

function objectBody(body: unknown): Record<string, unknown> {
  if (body === null || body === undefined) return {}
  if (typeof body !== 'object' || Array.isArray(body)) throw invalidInput()
  return body as Record<string, unknown>
}

function parse<S extends BodySchema>(schema: S, data: Record<string, unknown>): z.output<S> {
  const result = schema.safeParse(data)
  if (result.success) return result.data
  // Every field above sets its own message; a bare Zod default (English) would only come from a hand-written schema
  const message = result.error.issues[0]?.message ?? ''
  throw /[一-鿿]/.test(message) ? new ServiceError(message, 400) : invalidInput()
}

/** Create: the whole body, missing fields take their defaults. Unknown keys are dropped. */
export function parseBody<S extends BodySchema>(schema: S, body: unknown): z.output<S> {
  return parse(schema, objectBody(body))
}

/** Update: only the fields present in the body (a field sent as null takes its default, e.g. text → null) */
export function parsePatch<S extends BodySchema>(schema: S, body: unknown): Partial<z.output<S>> {
  const data = objectBody(body)
  const keys = Object.keys(schema.shape).filter((key) => Object.hasOwn(data, key))
  const picked = Object.fromEntries(keys.map((key) => [key, true])) as Record<string, true>
  return parse(schema.pick(picked) as BodySchema, data) as Partial<z.output<S>>
}

/** The fields of `values` that differ from `current`, so an update that changes nothing leaves updated_at alone */
export function changedFields<T extends object>(current: T, values: Partial<T>): Partial<T> {
  return Object.fromEntries(
    Object.entries(values).filter(([key, value]) => value !== undefined && value !== (current as Record<string, unknown>)[key]),
  ) as Partial<T>
}
