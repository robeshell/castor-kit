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

const invalid = (label: string) => `${label}的值无效`

export const field = {
  /** Required text, trimmed; missing / null / blank → `emptyMessage` */
  requiredText: (label: string, emptyMessage: string) =>
    z.preprocess((v) => v ?? '', z.string({ error: invalid(label) }).trim().min(1, { error: emptyMessage })),

  /** Optional text, trimmed; missing / null → null */
  text: (label: string) =>
    z
      .string({ error: invalid(label) })
      .trim()
      .nullish()
      .transform((v) => v ?? null),

  /** Integer; missing / null → `fallback` */
  int: (label: string, fallback: number, options: { min?: number } = {}) =>
    intSchema(label, options)
      .nullish()
      .transform((v) => v ?? fallback),

  /** Optional integer; missing / null → null */
  optionalInt: (label: string, options: { min?: number } = {}) =>
    intSchema(label, options)
      .nullish()
      .transform((v) => v ?? null),

  /** Boolean (true / false only); missing / null → `fallback` */
  bool: (label: string, fallback: boolean) =>
    z
      .boolean({ error: invalid(label) })
      .nullish()
      .transform((v) => v ?? fallback),

  /** One of `values`; missing / null → `fallback` */
  choice: <const T extends readonly [string, ...string[]]>(label: string, values: T, fallback: T[number], message = invalid(label)) =>
    z
      .enum(values, { error: message })
      .nullish()
      .transform((v): T[number] => v ?? fallback),

  /** Record id (positive integer); missing / null → null */
  id: (label: string) => field.optionalInt(label, { min: 1 }),

  /** List of record ids; missing / null → [] (duplicates removed) */
  ids: (label: string) =>
    z
      .array(z.number({ error: invalid(label) }).int({ error: invalid(label) }), { error: invalid(label) })
      .nullish()
      .transform((v) => [...new Set(v ?? [])]),
}

function intSchema(label: string, { min }: { min?: number }) {
  const schema = z.number({ error: invalid(label) }).int({ error: invalid(label) })
  return min === undefined ? schema : schema.min(min, { error: invalid(label) })
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
