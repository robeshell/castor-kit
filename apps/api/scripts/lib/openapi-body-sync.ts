/**
 * Request bodies in sync with the backend: each route that declares its JSON body with routeBody
 * (src/common/validation.ts) is compared with the documented requestBody, property by property.
 *
 * Per property (and inside nested objects such as export `filters`, array items such as `fields[]`, and arrays of
 * objects such as `conditions[]`):
 *   - nullability: does the Zod field accept null (probed with safeParse) vs does the documented type include null
 *   - requiredness: 'create' → required iff a missing value is rejected; 'patch' → nothing is required (absent keys
 *     are skipped); 'array' → each element is read like 'create'
 *   - type: the JSON types the field accepts vs the documented type
 *   - enum: the Zod enum (field.choice / optionalChoice) vs the documented enum
 *   - properties on one side only
 * The JSON Schema Zod writes (`z.toJSONSchema(…, { io: 'input' })`) gives types and enums; null / missing are probed with
 * real parses, since the preprocess wrappers (e.g. '' → null) make the JSON Schema alone misleading.
 *
 * Export requests' `fields[]` / `file_type` enums are allowed by design (isExportContractEnum). Other differences kept
 * on purpose are listed in BODY_SYNC_ALLOWLIST below, one entry per field with its reason. An entry that no longer
 * matches a difference is reported too, so the list can't go stale.
 *
 * Routes without a recorded declaration (hand-made route maps, e.g. scaffold's static doc tests) are not compared.
 */

import { z } from 'zod'
import type { BodyMode, BodySchema } from '../../src/common/validation'

/** A route's body declaration, as collectApiRoutes records it from the route `config` */
export interface RouteBodyDeclaration {
  schema: BodySchema
  mode: BodyMode
}

export type BodySyncKind =
  | 'body'
  | 'doc-only'
  | 'zod-only'
  | 'nullable'
  | 'not-nullable'
  | 'required-missing'
  | 'required-extra'
  | 'type'
  | 'enum-free-text'
  | 'enum-extra'
  | 'enum-missing'
  | 'enum-values'
  | 'enum-null'
  | 'items-enum'

export interface BodySyncDifference {
  /** Property path: `name`, `filters.status`, `fields[]`, `conditions[].field`; '' for the body itself */
  field: string
  kind: BodySyncKind
  message: string
}

/** A difference kept on purpose: `kind` lists every kind reported for the field */
export interface BodySyncException {
  method: 'POST' | 'PUT' | 'PATCH'
  path: string
  field: string
  kind: BodySyncKind | BodySyncKind[]
  reason: string
}

const FILTER_STATUS = "list filter: the doc lists the statuses ('' = all); any other text simply matches no row"
const SERVICE_REQUIRED = 'the service rejects it missing / null / blank with its own 400 message; the Zod field lets it through'

/**
 * Allowed by design on every export request (a body route whose path ends in `/export`): the documented `fields[]`
 * columns and `file_type` formats are the API contract, while the backend's leniency is only a fallback (it drops
 * unknown column names in exportColumns and writes xlsx for any other file type). So a documented enum there against
 * the backend's free text is not a difference; scaffolded modules document them the same way.
 */
export function isExportContractEnum(path: string, difference: Pick<BodySyncDifference, 'field' | 'kind'>): boolean {
  if (!path.endsWith('/export')) return false
  return (
    (difference.field === 'fields[]' && difference.kind === 'items-enum') ||
    (difference.field === 'file_type' && difference.kind === 'enum-free-text')
  )
}

/** Differences kept on purpose (see the header). Keep it tight: one entry per field, each with its reason. */
export const BODY_SYNC_ALLOWLIST: BodySyncException[] = [
  // Export filters: `filters.status` lists the statuses a list page filters by
  ...[
    '/api/admin/logs/login/export',
    '/api/admin/users/export',
  ].map((path): BodySyncException => ({ method: 'POST', path, field: 'filters.status', kind: 'enum-free-text', reason: FILTER_STATUS })),

  // Fields the service enforces although Zod lets them through (moving them into Zod's required(...) would change
  // which layer answers the 400 and its message)
  { method: 'POST', path: '/api/admin/change-password', field: 'old_password', kind: ['nullable', 'required-extra'], reason: SERVICE_REQUIRED },
  { method: 'POST', path: '/api/admin/change-password', field: 'new_password', kind: ['nullable', 'required-extra'], reason: SERVICE_REQUIRED },
  { method: 'POST', path: '/api/admin/reauth', field: 'password', kind: ['nullable', 'required-extra'], reason: SERVICE_REQUIRED },
  { method: 'POST', path: '/api/admin/two-factor/enable', field: 'code', kind: ['nullable', 'required-extra'], reason: SERVICE_REQUIRED },
  { method: 'POST', path: '/api/admin/two-factor/disable', field: 'password', kind: ['nullable', 'required-extra'], reason: SERVICE_REQUIRED },
  { method: 'POST', path: '/api/admin/two-factor/recovery-codes', field: 'password', kind: ['nullable', 'required-extra'], reason: SERVICE_REQUIRED },
  { method: 'POST', path: '/api/admin/users', field: 'password', kind: ['nullable', 'required-extra'], reason: SERVICE_REQUIRED },
  {
    method: 'PUT',
    path: '/api/admin/users/{user_id}/status',
    field: 'status',
    kind: ['nullable', 'required-extra', 'enum-free-text'],
    reason: `${SERVICE_REQUIRED}; values other than active / disabled are rejected there too`,
  },
  {
    method: 'POST',
    path: '/api/admin/menus/{menu_id}/sort',
    field: 'direction',
    kind: ['nullable', 'required-extra', 'enum-free-text'],
    reason: `${SERVICE_REQUIRED}; values other than up / down are rejected there too`,
  },
  { method: 'POST', path: '/api/admin/scheduled-tasks', field: 'request_url', kind: ['nullable', 'required-extra'], reason: SERVICE_REQUIRED },
  {
    method: 'PUT',
    path: '/api/admin/scheduled-tasks/{task_id}',
    field: 'request_url',
    kind: 'nullable',
    reason: 'the service rejects clearing it (null / blank) with its own 400 message; the Zod field lets it through',
  },

  // Undocumented on purpose
  {
    method: 'POST',
    path: '/api/admin/dicts/{dict_id}/items',
    field: 'dict_type_id',
    kind: 'zod-only',
    reason: 'the item schema is shared with the update route; on create the dictionary comes from the path and a dict_type_id in the body is ignored',
  },
  {
    method: 'POST',
    path: '/api/admin/component-center/ai/chat/stream',
    field: 'id',
    kind: 'doc-only',
    reason: 'sent by the page (AI SDK useChat) with every request; documented so clients see the full request, not read by the backend',
  },
  {
    method: 'POST',
    path: '/api/admin/component-center/ai/chat/stream',
    field: 'trigger',
    kind: 'doc-only',
    reason: 'sent by the page (AI SDK useChat) with every request; documented so clients see the full request, not read by the backend',
  },
]

type Json = Record<string, unknown>
const isObject = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v)

// ---------------------------------------------------------------------------
// Backend side: what a Zod field accepts
// ---------------------------------------------------------------------------

const SAMPLES: Array<[string, unknown]> = [
  ['integer', 7],
  ['number', 1.5],
  ['string', 'x'],
  ['boolean', true],
  ['array', []],
  ['object', {}],
]

interface Probe {
  missingOk: boolean
  nullOk: boolean
  /** What null is read as, when null is accepted */
  fallback?: unknown
  /** JSON types accepted (a validated string that rejects 'x' still counts, from the JSON Schema) */
  types: Set<string>
  json: Json
}

/** How one property schema reads missing / null / sample values, parsed inside an object as the body is */
function probe(schema: z.ZodType): Probe {
  const holder = z.object({ k: schema })
  const ok = (v: unknown) => holder.safeParse(v).success
  const json = z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' }) as Json
  const types = new Set<string>()
  for (const [type, value] of SAMPLES) if (ok({ k: value })) types.add(type)
  for (const type of jsonTypes(json)) if (type !== 'null') types.add(type)
  if (types.has('number')) types.add('integer')
  const parsedNull = holder.safeParse({ k: null })
  return {
    missingOk: ok({}),
    nullOk: parsedNull.success,
    fallback: parsedNull.success ? (parsedNull.data as Json).k : undefined,
    types,
    json,
  }
}

const alternatives = (s: Json) => (Array.isArray(s.anyOf) ? s.anyOf : Array.isArray(s.oneOf) ? s.oneOf : undefined)?.filter(isObject)

/** The JSON types a JSON Schema allows */
function jsonTypes(s: Json | undefined): string[] {
  if (!s) return []
  const alt = alternatives(s)
  if (alt) return alt.flatMap(jsonTypes)
  if (s.type) return [s.type].flat().map(String)
  if (Array.isArray(s.enum)) return [...new Set(s.enum.map((v) => (v === null ? 'null' : typeof v)))]
  return []
}

function jsonEnum(s: Json | undefined): unknown[] | undefined {
  if (!s) return undefined
  const alt = alternatives(s)
  if (alt) {
    const all = alt.map(jsonEnum).filter((e) => e !== undefined).flat()
    return all.length ? all : undefined
  }
  return Array.isArray(s.enum) ? s.enum : undefined
}

function jsonItems(s: Json | undefined): Json | undefined {
  if (!s) return undefined
  const alt = alternatives(s)
  if (alt) return alt.map(jsonItems).find(Boolean)
  return isObject(s.items) ? s.items : undefined
}

const WRAPPERS = new Set(['optional', 'nullable', 'default', 'prefault', 'readonly', 'nonoptional'])

/** Look through preprocess / pipe / optional wrappers for a schema of `type` (object or array) */
function unwrap(schema: z.ZodType, type: 'object' | 'array'): Json | undefined {
  let s: unknown = schema
  for (let i = 0; i < 10 && s; i++) {
    const def = (s as { _zod?: { def?: Json } })._zod?.def
    if (!def) return undefined
    if (def.type === type) return def
    if (def.type === 'pipe') {
      const out = def.out as { _zod?: { def?: Json } } | undefined
      s = out?._zod?.def?.type === 'transform' ? def.in : def.out
    } else if (WRAPPERS.has(String(def.type))) s = def.innerType
    else return undefined
  }
  return undefined
}
const objectShape = (schema: z.ZodType) => unwrap(schema, 'object')?.shape as Record<string, z.ZodType> | undefined
const arrayElement = (schema: z.ZodType) => unwrap(schema, 'array')?.element as z.ZodType | undefined

// ---------------------------------------------------------------------------
// Doc side
// ---------------------------------------------------------------------------

/** The documented types, `nullable: true` (OpenAPI 3.0) counted as null */
function docTypes(s: Json | undefined): string[] {
  if (!s) return []
  const alt = alternatives(s)
  if (alt) return alt.flatMap(docTypes)
  const types = s.type ? [s.type].flat().map(String) : []
  if (s.nullable === true) types.push('null')
  return types
}

// ---------------------------------------------------------------------------
// Comparison
// ---------------------------------------------------------------------------

const show = (v: unknown) => JSON.stringify(v)

function compareObject(
  prefix: string,
  shape: Record<string, z.ZodType>,
  docSchema: Json | undefined,
  mode: BodyMode,
  out: BodySyncDifference[],
): void {
  const add = (key: string, kind: BodySyncKind, message: string) => out.push({ field: prefix + key, kind, message })
  const props = isObject(docSchema?.properties) ? docSchema.properties : {}
  const docRequired = new Set(Array.isArray(docSchema?.required) ? docSchema.required.map(String) : [])

  for (const key of Object.keys(props)) {
    if (!Object.hasOwn(shape, key)) add(key, 'doc-only', 'documented, but the backend does not read it')
  }
  for (const [key, schema] of Object.entries(shape)) {
    const p = probe(schema)
    const d = props[key]
    if (!isObject(d)) {
      add(key, 'zod-only', `the backend reads it (${[...p.types].join(' / ')}), but it is not documented`)
      continue
    }
    const dt = docTypes(d)
    /** No type in the doc: any JSON value, null included */
    const anyType = dt.length === 0
    const docNull = anyType || dt.includes('null')
    if (p.nullOk && !docNull) add(key, 'nullable', `the backend accepts null (read as ${show(p.fallback)}), but the documented type ${show(d.type ?? dt)} has no null`)
    if (!p.nullOk && docNull) add(key, 'not-nullable', `the backend rejects null, but the documented type ${show(d.type ?? dt)} allows it`)

    const zodRequired = mode !== 'patch' && !p.missingOk
    if (zodRequired && !docRequired.has(key)) add(key, 'required-missing', 'the backend rejects a missing value, but it is not listed in required')
    if (!zodRequired && docRequired.has(key)) {
      add(key, 'required-extra', mode === 'patch' ? 'listed in required, but an update reads only the fields sent' : 'listed in required, but the backend accepts it missing')
    }

    const docNonNull = dt.filter((t) => t !== 'null')
    const zodTypes = [...p.types]
    for (const t of docNonNull) {
      const accepted = t === 'number' ? p.types.has('number') || p.types.has('integer') : p.types.has(t)
      if (!accepted) add(key, 'type', `the documented type allows ${t}, but the backend takes ${zodTypes.join(' / ') || 'nothing'}`)
    }
    if (!anyType && docNonNull.length > 0) {
      for (const t of zodTypes) {
        if (t === 'integer' && (docNonNull.includes('number') || docNonNull.includes('integer'))) continue
        if (t === 'number' && docNonNull.includes('number')) continue
        // A decimal takes a number or its text: documented as a string is fine
        if (t === 'integer' && p.types.has('number') && docNonNull.includes('string')) continue
        if (!docNonNull.includes(t)) add(key, 'type', `the backend also takes ${t}, but the documented type is ${show(docNonNull)}`)
      }
    }

    const zodEnum = jsonEnum(p.json)?.filter((v) => v !== null)
    const docEnum = Array.isArray(d.enum) ? d.enum.filter((v) => v !== null) : undefined
    if (docEnum && !zodEnum) {
      const type = zodTypes.join(' / ')
      if (type === 'string') add(key, 'enum-free-text', `documented as an enum ${show(docEnum)}, but the backend takes any text`)
      else add(key, 'enum-extra', `documented as an enum ${show(docEnum)}, but the backend has no enum (${type})`)
    } else if (zodEnum && !docEnum) {
      add(key, 'enum-missing', `the backend accepts only ${show(zodEnum)}; document it as an enum`)
    } else if (zodEnum && docEnum) {
      const backend = show([...zodEnum].map(String).sort())
      const documented = show(docEnum.filter((v) => v !== '').map(String).sort())
      if (backend !== documented) add(key, 'enum-values', `the backend accepts ${show(zodEnum)}, but the documented enum is ${show(docEnum)}`)
    }
    if (Array.isArray(d.enum) && docNull && !d.enum.includes(null)) add(key, 'enum-null', 'the documented type allows null, but its enum does not list null')

    const inner = objectShape(schema)
    if (inner) compareObject(`${prefix}${key}.`, inner, d, 'create', out)
    const element = arrayElement(schema)
    if (element) {
      const docItems = isObject(d.items) ? d.items : jsonItems(d)
      const itemEnum = Array.isArray(docItems?.enum) ? docItems.enum : undefined
      if (itemEnum && !jsonEnum(probe(element).json)) {
        add(`${key}[]`, 'items-enum', `documented items are an enum (${itemEnum.length} values), but the backend takes any text`)
      }
      const elementShape = objectShape(element)
      if (elementShape) compareObject(`${prefix}${key}[].`, elementShape, docItems, 'create', out)
    }
  }
}

/**
 * The differences between a route's body declaration and the documented operation; undefined when the operation
 * documents no JSON body to compare with (other rules report that)
 */
export function bodyDifferences(declaration: RouteBodyDeclaration, op: Json): BodySyncDifference[] | undefined {
  const requestBody = isObject(op.requestBody) ? op.requestBody : undefined
  const content = isObject(requestBody?.content) ? requestBody.content : undefined
  const media = content?.['application/json']
  const docSchema = isObject(media) && isObject(media.schema) ? media.schema : undefined
  if (!docSchema) return undefined

  // The body itself has the wrong shape: its properties can't be compared
  if (declaration.mode === 'array' && docSchema.type !== 'array') {
    return [{ field: '', kind: 'body', message: `the route reads a JSON array (routeBody 'array'), but the documented body type is ${show(docSchema.type)}` }]
  }
  if (declaration.mode !== 'array' && docSchema.type !== undefined && docSchema.type !== 'object') {
    return [{ field: '', kind: 'body', message: `the route reads a JSON object, but the documented body type is ${show(docSchema.type)}` }]
  }
  const out: BodySyncDifference[] = []
  const objectSchema = declaration.mode === 'array' ? (isObject(docSchema.items) ? docSchema.items : undefined) : docSchema
  compareObject('', declaration.schema.shape as Record<string, z.ZodType>, objectSchema, declaration.mode, out)
  return out
}

const kindsOf = (e: BodySyncException) => [e.kind].flat()

export interface BodySyncIssue {
  /** "METHOD /path" */
  operation: string
  message: string
}

/**
 * Compare every route with a recorded body declaration against the documented requestBody; allowlisted differences
 * are skipped, and allowlist entries that no longer match are reported
 */
export function lintBodySync(
  operationOf: (method: string, path: string) => Json | undefined,
  bodies: Map<string, RouteBodyDeclaration>,
  allowlist: BodySyncException[] = BODY_SYNC_ALLOWLIST,
): BodySyncIssue[] {
  const issues: BodySyncIssue[] = []
  const compared = new Map<string, BodySyncDifference[]>()
  for (const [operation, declaration] of bodies) {
    const [method, path] = operation.split(' ') as [string, string]
    const op = operationOf(method, path)
    if (!op) continue
    const differences = bodyDifferences(declaration, op)
    if (!differences) continue
    compared.set(operation, differences)
    for (const d of differences) {
      if (isExportContractEnum(path, d)) continue
      const allowed = allowlist.some((e) => `${e.method} ${e.path}` === operation && e.field === d.field && kindsOf(e).includes(d.kind))
      if (allowed) continue
      issues.push({ operation, message: `${d.field ? `body field ${d.field}` : 'body'}: ${d.message} [${d.kind}]` })
    }
  }
  for (const entry of allowlist) {
    const operation = `${entry.method} ${entry.path}`
    const where = 'BODY_SYNC_ALLOWLIST (scripts/lib/openapi-body-sync.ts)'
    if (!bodies.has(operation)) {
      issues.push({ operation, message: `allowlisted body field ${entry.field}: no route declares this body with routeBody; remove the entry from ${where}` })
      continue
    }
    const differences = compared.get(operation)
    if (!differences) continue
    for (const kind of kindsOf(entry)) {
      if (!differences.some((d) => d.field === entry.field && d.kind === kind)) {
        issues.push({ operation, message: `allowlisted body field ${entry.field} [${kind}] matches no difference any more; remove it from ${where}` })
      }
    }
  }
  return issues
}
