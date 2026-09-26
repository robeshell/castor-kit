/**
 * castor-kit code scaffold: generates a backend module, a frontend page and a migration from field definitions
 *
 * Usage:
 *   pnpm scaffold -- --name customer --domain admin --fields "name:str,phone:str,status:str"
 *
 *   --name            resource name (snake_case, e.g. customer)
 *   --domain          owning domain (admin or component_center, default admin)
 *   --fields          field list, formatted "field:type,field:type" (default name:str)
 *                     supported types: str / str20 / str50 / str500 / text / int / float / bool / date / datetime
 *   --dry-run         print only: write no files, change no registration files, generate no migration
 *   --skip-migration  don't run drizzle-kit generate (for tests)
 *   --data-scope      rows follow data scope: adds dept_id / created_by (stamped on create) and filters list / detail /
 *                     edit / delete / export by the caller's scope (common/data-scope.ts)
 *   --root            repository root (default: the repo this script lives in; for tests)
 *
 * Generated files (existing files are skipped, never overwritten):
 *   apps/api/src/db/schema/<domain>/<name>.ts                         table definition + toDict
 *   apps/api/src/modules/<domain>/<name>/{schema,repository,service,routes}.ts
 *   apps/api/test/<admin|cc>-<name>.test.ts                           basic API tests
 *   apps/web/src/modules/<module>/api/<name>.js
 *   apps/web/src/modules/<module>/pages/<subdir>/<name>/index.jsx   shadcn/ui list page (same structure as the users page)
 *   apps/web/src/modules/<module>/pages/<subdir>/<name>/locales/{en-US,ja-JP}.json
 *                     only when the page uses fixed Chinese text that apps/web/src/locales doesn't translate
 * Auto-registration:
 *   apps/api/src/db/schema/index.ts          export * from './<domain>/<name>'
 *   apps/api/src/modules/<domain>/router.ts  import + await register<Name>Routes(app)
 * Migration:
 *   drizzle-kit generate --name <name>
 *
 * Backend directory / file names use lowercase hyphens per repo convention (ck_demo → ck-demo, component_center → component-center);
 * the table name is `<name>s`; the frontend path is admin/pages/<name> or component_center/pages/admin/<name>_page.
 *
 * i18n: generated pages follow apps/web/src/modules/admin/pages/users/index.jsx (Chinese source text is the key,
 * see apps/web/src/i18n/index.js); backend error messages stay Chinese and are translated by apps/api/src/i18n/messages.ts.
 * Generated code comments are English.
 */

import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import { printUsage } from './lib/usage'

const DEFAULT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')

// ─── Field type mapping ────────────────────────────────────────────────────────

export interface FieldTypeSpec {
  /** Drizzle column builder expression */
  column: string
  /** Builder to import from drizzle-orm/pg-core */
  builder: string
  /** Normalizer function in schema.ts */
  coerce: 'toStr' | 'toInt' | 'toNumeric' | 'toBool' | 'toDate' | 'toDateTime'
}

export const FIELD_TYPE_MAP: Record<string, FieldTypeSpec> = {
  str: { column: 'varchar({ length: 100 })', builder: 'varchar', coerce: 'toStr' },
  str50: { column: 'varchar({ length: 50 })', builder: 'varchar', coerce: 'toStr' },
  str20: { column: 'varchar({ length: 20 })', builder: 'varchar', coerce: 'toStr' },
  str500: { column: 'varchar({ length: 500 })', builder: 'varchar', coerce: 'toStr' },
  text: { column: 'text()', builder: 'text', coerce: 'toStr' },
  int: { column: 'integer()', builder: 'integer', coerce: 'toInt' },
  float: { column: 'numeric({ precision: 10, scale: 2 })', builder: 'numeric', coerce: 'toNumeric' },
  bool: { column: 'boolean()', builder: 'boolean', coerce: 'toBool' },
  date: { column: "date({ mode: 'string' })", builder: 'date', coerce: 'toDate' },
  datetime: { column: "timestamp({ mode: 'string' })", builder: 'timestamp', coerce: 'toDateTime' },
}

/** Field type spec; unknown types are treated as str */
export function fieldSpec(type: string): FieldTypeSpec {
  return FIELD_TYPE_MAP[type] ?? FIELD_TYPE_MAP.str!
}

export type Field = [name: string, type: string]

// ─── Naming helpers ────────────────────────────────────────────────────────────

/** Python `''.join(w.capitalize() for w in name.split('_'))` */
export function toPascal(name: string): string {
  return name
    .split('_')
    .map((w) => (w ? w[0]!.toUpperCase() + w.slice(1).toLowerCase() : ''))
    .join('')
}

export function toCamel(name: string): string {
  const pascal = toPascal(name)
  return pascal ? pascal[0]!.toLowerCase() + pascal.slice(1) : pascal
}

export function toKebab(name: string): string {
  return name.replace(/_/g, '-')
}

/** Python `name.replace('_', ' ').title()`: a letter following a non-letter is upper-cased, the rest lower-cased */
export function toLabel(name: string): string {
  let prevIsLetter = false
  let out = ''
  for (const ch of name.replace(/_/g, ' ')) {
    const isLetter = ch.toLowerCase() !== ch.toUpperCase()
    out += isLetter ? (prevIsLetter ? ch.toLowerCase() : ch.toUpperCase()) : ch
    prevIsLetter = isLetter
  }
  return out
}

/** Emit as a single-quoted TS string literal */
function q(text: string): string {
  return `'${text.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
}

/** Object literal key: bare when it's a valid identifier, quoted otherwise */
function key(text: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(text) ? text : q(text)
}

// ─── Inference ─────────────────────────────────────────────────────────────────

export interface ScaffoldSpec {
  name: string
  domain: 'admin' | 'component_center'
  fields: Field[]
  pascal: string
  camel: string
  kebab: string
  table: string
  /** Backend directory name: admin / component-center */
  domainDir: string
  /** Frontend module directory: admin / component_center */
  webModule: string
  permPrefix: string
  menuComponent: string
  apiBase: string
  nameField: string
  exportFields: Field[]
  importFields: Field[]
  /** --data-scope: dept_id / created_by columns and scope filtering */
  dataScope: boolean
}

export function buildSpec(
  name: string,
  domain: 'admin' | 'component_center',
  fields: Field[],
  options: { dataScope?: boolean } = {},
): ScaffoldSpec {
  const domainPrefix = domain === 'admin' ? 'system' : 'cc'
  // Name field (search, required import column): the first str / str50 field; str20 (codes, phones, statuses) and str500 (links) don't count
  const nameField = fields.find(([, t]) => t === 'str' || t === 'str50')?.[0] ?? fields[0]?.[0] ?? 'name'
  // Import / export / table columns cover all fields;
  // the required column (name field) comes first; non-string fields are converted by buildValues, and conversion failures become error rows
  const importFields = [...fields.filter(([f]) => f === nameField), ...fields.filter(([f]) => f !== nameField)]
  return {
    name,
    domain,
    fields,
    pascal: toPascal(name),
    camel: toCamel(name),
    kebab: toKebab(name),
    table: `${name}s`,
    domainDir: domain === 'admin' ? 'admin' : 'component-center',
    webModule: domain === 'admin' ? 'admin' : 'component_center',
    permPrefix: `${domainPrefix}_${name}`,
    menuComponent: domain === 'admin' ? `admin/${name}` : `component_center/admin/${name}_page`,
    apiBase: `/api/admin/${toKebab(name)}s`,
    nameField,
    exportFields: fields,
    importFields: importFields.length > 0 ? importFields : [[nameField, 'str']],
    dataScope: options.dataScope ?? false,
  }
}

// ─── Backend code generation ───────────────────────────────────────────────────

export function genDbSchema(s: ScaffoldSpec): string {
  const builders = new Set(['pgTable', 'serial'])
  for (const [, t] of s.fields) builders.add(fieldSpec(t).builder)
  const columnLines = s.fields.map(([f, t]) => `  ${key(f)}: ${fieldSpec(t).column},`)
  const dictLines = s.fields.map(([f, t]) =>
    fieldSpec(t).builder === 'timestamp' ? `    ${key(f)}: toIso(item.${f}),` : `    ${key(f)}: item.${f},`,
  )
  if (s.dataScope) {
    builders.add('integer')
    columnLines.push(
      '  /** Data scope: owning department and creator, stamped on create (see DATA_SCOPE in the module schema) */',
      '  dept_id: integer(),',
      '  created_by: integer(),',
    )
    dictLines.push('    dept_id: item.dept_id,', '    created_by: item.created_by,')
  }
  return `/**
 * ${s.table}
 * Generated by scripts/scaffold.ts (name=${s.name}, domain=${s.domain}).
 *
 * - Timestamp columns use createdAt()/updatedAt() (app-side default \`timezone('utc', now())\`); output always goes through toIso()
 * - numeric columns stay strings; date columns are 'YYYY-MM-DD' text
 * - After changing the table, run \`pnpm db:generate --name <description>\` + \`pnpm db:migrate\`
 */

import { ${[...builders].sort().join(', ')} } from 'drizzle-orm/pg-core'
import { toIso } from '@/common/serialize'
import { createdAt, updatedAt } from '../columns'

export const ${s.table} = pgTable(${q(s.table)}, {
  id: serial().primaryKey().notNull(),
${columnLines.join('\n')}
  created_at: createdAt(),
  updated_at: updatedAt(),
})

export type ${s.pascal} = typeof ${s.table}.$inferSelect
export type New${s.pascal} = typeof ${s.table}.$inferInsert

export function ${s.camel}ToDict(item: ${s.pascal}) {
  return {
    id: item.id,
${dictLines.join('\n')}
    created_at: toIso(item.created_at),
    updated_at: toIso(item.updated_at),
  }
}
`
}

const COERCERS: Record<FieldTypeSpec['coerce'], string> = {
  toStr: `function toStr(value: unknown): string | null {
  return value === null || value === undefined ? null : pyStr(value)
}`,
  toInt: `function toInt(field: string, value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  try {
    return pyInt(value)
  } catch {
    throw invalid(field)
  }
}`,
  toNumeric: `/** numeric columns stay strings (no parseFloat, to avoid precision loss) */
function toNumeric(field: string, value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value === 'string' && /^[+-]?(\\d+\\.?\\d*|\\.\\d+)$/.test(value.trim())) return value.trim()
  throw invalid(field)
}`,
  toBool: `function toBool(field: string, value: unknown): boolean | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'boolean') return value
  if (value === 1 || value === 0) return value === 1
  const text = String(value).trim().toLowerCase()
  if (['1', 'true', 'yes', 'on', '是'].includes(text)) return true
  if (['0', 'false', 'no', 'off', '否'].includes(text)) return false
  throw invalid(field)
}`,
  toDate: `/** 'YYYY-MM-DD' (ISO strings with a time part are accepted; the date part is kept) */
function toDate(field: string, value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null
  const match = typeof value === 'string' ? /^(\\d{4}-\\d{2}-\\d{2})([ T].*)?$/.exec(value.trim()) : null
  if (!match) throw invalid(field)
  return match[1]!
}`,
  toDateTime: `/** 'YYYY-MM-DD HH:mm[:ss[.ffffff]]' or ISO with a 'T' separator */
function toDateTime(field: string, value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null
  const text = typeof value === 'string' ? value.trim() : ''
  if (!/^\\d{4}-\\d{2}-\\d{2}([ T]\\d{2}:\\d{2}(:\\d{2}(\\.\\d{1,6})?)?)?$/.test(text)) throw invalid(field)
  return text.replace('T', ' ')
}`,
}

export function genModuleSchema(s: ScaffoldSpec): string {
  const used = [...new Set(s.fields.map(([, t]) => fieldSpec(t).coerce))]
  const pyImports = [
    ...(used.includes('toInt') ? ['pyInt'] : []),
    ...(used.includes('toStr') ? ['pyStr'] : []),
  ]
  const needsInvalid = used.some((c) => c !== 'toStr')
  const exportLines = [
    `  id: 'ID',`,
    ...s.exportFields.map(([f]) => `  ${key(f)}: ${q(toLabel(f))},`),
    `  created_at: '创建时间',`,
  ]
  const importLines = s.importFields.map(([f]) => `  ${key(toLabel(f))}: ${q(f)},`)
  const valueLines = s.fields.map(([f, t]) => {
    const c = fieldSpec(t).coerce
    const call = c === 'toStr' ? `toStr(data[${q(f)}])` : `${c}(${q(f)}, data[${q(f)}])`
    return `  if (!partial || Object.hasOwn(data, ${q(f)})) values.${f} = ${call}`
  })

  return `/**
 * ${s.pascal} module schema layer (generated by scripts/scaffold.ts)
 *
 * Request bodies are lenient: jsonBody() provides the \`request.get_json() or {}\` semantics; values are normalized by field type here,
 * and a value that can't be converted to its column type returns 400. Add required / uniqueness checks as the business needs.
 */

import { z } from 'zod'
${needsInvalid ? `import { ServiceError } from '@/common/errors'\n` : ''}${pyImports.length > 0 ? `import { ${pyImports.join(', ')} } from '@/common/py'\n` : ''}import type { ${s.pascal}, New${s.pascal} } from '@/db/schema'

/** Request body: loose and fully optional; normalization happens in buildValues */
export const ${s.camel}BodySchema = z.record(z.string(), z.unknown()).nullish()

/**
 * Export columns: a header string (value taken from the toDict field of the same name), or [header, value function]
 * (when a conversion is needed, e.g. enum values shown as Chinese labels, booleans shown as yes / no text).
 * Headers are translated into Chinese by the AI / developer; field validation errors also use these headers as field names.
 */
export type ExportColumn = string | [header: string, value: (item: ${s.pascal}) => unknown]

export const EXPORT_FIELD_MAP: Record<string, ExportColumn> = {
${exportLines.join('\n')}
}

/** Chinese name of a field (the export header; falls back to the field name when there is no export column) */
export function fieldLabel(field: string): string {
  const column = EXPORT_FIELD_MAP[field]
  return Array.isArray(column) ? column[0] : (column ?? field)
}

/** Import header map (key = header, value = field name); the first column is required */
export const IMPORT_HEADER_MAP: Record<string, string> = {
${importLines.join('\n')}
}

/** Column values after normalizing the request body: every field may be absent or null; required / unique is enforced by DB constraints (the service turns violations into 400) */
export type ${s.pascal}Values = { [K in keyof Omit<New${s.pascal}, 'id' | 'created_at' | 'updated_at'>]?: New${s.pascal}[K] | null }
${needsInvalid ? `\nfunction invalid(field: string): ServiceError {\n  return new ServiceError(\`\${fieldLabel(field)}的值无效\`, 400)\n}\n` : ''}
${used.map((c) => COERCERS[c]).join('\n\n')}

/**
 * Request body → column values.
 * - Create (partial=false): every field is written; missing ones become null
 * - Edit (partial=true): only fields present in the request body are written
 */
export function buildValues(data: Record<string, unknown>, partial: boolean): ${s.pascal}Values {
  const values: ${s.pascal}Values = {}
${valueLines.join('\n')}
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
${s.dataScope ? DATA_SCOPE_MARKER : ''}`
}

const DATA_SCOPE_MARKER = `
/**
 * Data scope declaration (checked by \`pnpm verify\`): rows belong to dept_id, and "own data" means created_by.
 * The repository must filter with dataScopeWhere.
 */
export const DATA_SCOPE = { deptColumn: 'dept_id', ownerColumn: 'created_by' } as const
`

export function genRepository(s: ScaffoldSpec): string {
  const nameType = s.fields.find(([f]) => f === s.nameField)?.[1] ?? 'str'
  const isText = fieldSpec(nameType).coerce === 'toStr'
  const searchExpr = isText
    ? `ilike(${s.table}.${s.nameField}, \`%\${search}%\`)`
    : `ilike(sql\`\${${s.table}.${s.nameField}}::text\`, \`%\${search}%\`)`
  const ds = s.dataScope
  const ormImports = [...(ds ? ['and'] : []), 'count', 'desc', 'eq', 'ilike', 'inArray', ...(isText ? [] : ['sql']), 'type SQL']
  const t = s.table
  const scopeParam = ds ? ', scope: DataScope' : ''
  const listWhere = ds ? 'and(this.searchWhere(search), this.scopeWhere(scope))' : 'this.searchWhere(search)'
  const exportWhere = ds
    ? `and(ids ? inArray(${t}.id, ids) : undefined, this.scopeWhere(scope))`
    : `ids ? inArray(${t}.id, ids) : undefined`
  const getWhere = ds ? `and(eq(${t}.id, id), this.scopeWhere(scope))` : `eq(${t}.id, id)`
  const scopeMethod = ds
    ? `
  /** Data scope: rows of the caller's visible departments, plus rows they created */
  private scopeWhere(scope: DataScope): SQL | undefined {
    return dataScopeWhere(scope, { deptColumn: ${t}.dept_id, ownerColumn: ${t}.created_by })
  }
`
    : ''
  return `/**
 * ${s.pascal} repository layer (generated by scripts/scaffold.ts): plain database reads / writes, no business logic
 */

import { ${ormImports.join(', ')} } from 'drizzle-orm'
${ds ? `import { dataScopeWhere, UNRESTRICTED, type DataScope } from '@/common/data-scope'\n` : ''}import type { Executor } from '@/db/client'
import { ${s.table}, type ${s.pascal}, type New${s.pascal} } from '@/db/schema'
import type { ${s.pascal}Values } from './schema'

export class ${s.pascal}Repository {
  constructor(private readonly db: Executor) {}

  private searchWhere(search: string): SQL | undefined {
    return search ? ${searchExpr} : undefined
  }
${scopeMethod}
  async listPage(page: number, perPage: number, search: string${scopeParam}) {
    const where = ${listWhere}
    const [totalRow] = await this.db.select({ n: count() }).from(${s.table}).where(where)
    const items = await this.db
      .select()
      .from(${s.table})
      .where(where)
      .orderBy(desc(${s.table}.id))
      .limit(perPage)
      .offset((page - 1) * perPage)
    return { total: totalRow?.n ?? 0, items }
  }

  /** Export: all rows when ids is null; ordered by id descending */
  async listForExport(ids: number[] | null${scopeParam}): Promise<${s.pascal}[]> {
    return this.db
      .select()
      .from(${s.table})
      .where(${exportWhere})
      .orderBy(desc(${s.table}.id))
  }

  async getById(id: number${ds ? ', scope: DataScope = UNRESTRICTED' : ''}): Promise<${s.pascal} | null> {
    const [row] = await this.db.select().from(${s.table}).where(${getWhere}).limit(1)
    return row ?? null
  }

  /**
   * values come from buildValues (every field optional); once a column gets .notNull() the database rejects missing values,
   * and the service turns not-null / unique constraint errors into 400, so accepting them as the insert type is fine here.
   */
  async insert(values: ${s.pascal}Values): Promise<${s.pascal}> {
    const [row] = await this.db
      .insert(${s.table})
      .values(values as New${s.pascal})
      .returning()
    return row!
  }

  async update(id: number, values: ${s.pascal}Values): Promise<${s.pascal} | null> {
    const [row] = await this.db
      .update(${s.table})
      .set(values as Partial<New${s.pascal}>)
      .where(eq(${s.table}.id, id))
      .returning()
    return row ?? null
  }

  async delete(id: number): Promise<void> {
    await this.db.delete(${s.table}).where(eq(${s.table}.id, id))
  }
}
`
}

export function genService(s: ScaffoldSpec): string {
  const ds = s.dataScope
  const scopeParam = ds ? ', scope: DataScope = UNRESTRICTED' : ''
  const scopeArg = ds ? ', scope' : ''
  const stampHelper = ds
    ? `
/** Owner columns of a new row (data scope): the creator and their department */
function stamp(actor: Actor | undefined) {
  return actor ? { created_by: actor.userId, dept_id: actor.deptId } : {}
}
`
    : ''
  return `/**
 * ${s.pascal} service layer (generated by scripts/scaffold.ts): business logic; throws ServiceError and never touches HTTP objects
 */

import { ServiceError } from '@/common/errors'
import { notFound } from '@/common/http'
import { pyTruthy } from '@/common/py'
import { dbConstraintError } from '@/common/db-errors'
import { buildTable, normalizeTableFileType, readTableFile, TableFileError, type UploadedFile } from '@/common/tabular'
${ds ? `import { UNRESTRICTED, type Actor, type DataScope } from '@/common/data-scope'\n` : ''}import type { Db } from '@/db/client'
import { ${s.camel}ToDict, type ${s.pascal} } from '@/db/schema'
import { ${s.pascal}Repository } from './repository'
import { buildErrorRow, buildValues, EXPORT_FIELD_MAP, fieldLabel, IMPORT_HEADER_MAP, type ErrorRow } from './schema'

type Data = Record<string, unknown>
${stampHelper}
export class ${s.pascal}Service {
  private readonly repo: ${s.pascal}Repository

  constructor(private readonly db: Db) {
    this.repo = new ${s.pascal}Repository(db)
  }

  private async inTx<T>(fn: (repo: ${s.pascal}Repository) => Promise<T>): Promise<T> {
    try {
      return await this.db.transaction((tx) => fn(new ${s.pascal}Repository(tx)))
    } catch (err) {
      if (err instanceof ServiceError) throw err
      // Input problems such as unique conflicts / values too long / numeric overflow → 400; anything else → 500
      throw dbConstraintError(err) ?? new ServiceError(err instanceof Error ? err.message : String(err), 500)
    }
  }

  async listItems(page: number, perPage: number, search: string${scopeParam}) {
    const { total, items } = await this.repo.listPage(page, perPage, search${scopeArg})
    return { items: items.map(${s.camel}ToDict), total, page, per_page: perPage }
  }

  async getOr404(id: number${scopeParam}): Promise<${s.pascal}> {
    const item = await this.repo.getById(id${scopeArg})
    if (!item) throw notFound()
    return item
  }

  getItem(item: ${s.pascal}) {
    return ${s.camel}ToDict(item)
  }

  async createItem(data: Data${ds ? ', actor?: Actor' : ''}) {
    const values = ${ds ? '{ ...buildValues(data, false), ...stamp(actor) }' : 'buildValues(data, false)'}
    const created = await this.inTx((repo) => repo.insert(values))
    return ${s.camel}ToDict(created)
  }

  async updateItem(item: ${s.pascal}, data: Data) {
    const values = buildValues(data, true)
    if (Object.keys(values).length === 0) return ${s.camel}ToDict(item)
    const updated = await this.inTx((repo) => repo.update(item.id, values))
    if (!updated) throw notFound()
    return ${s.camel}ToDict(updated)
  }

  async deleteItem(item: ${s.pascal}) {
    await this.inTx((repo) => repo.delete(item.id))
    return { message: '删除成功' }
  }

  /** Export: fields default to all export fields; empty ids exports everything; xlsx by default */
  async exportItems(data: Data${scopeParam}) {
    const fileType = normalizeTableFileType(data.file_type, 'xlsx')
    const rawFields = pyTruthy(data.fields) && Array.isArray(data.fields) ? data.fields : Object.keys(EXPORT_FIELD_MAP)
    const fields = rawFields.map((f) => String(f))
    const ids =
      pyTruthy(data.ids) && Array.isArray(data.ids) ? data.ids.filter((v): v is number => Number.isInteger(v)) : null

    const items = await this.repo.listForExport(ids${scopeArg})
    const headers = fields.map((f) => fieldLabel(f))
    const rows = items.map((item) => {
      const dict: Record<string, unknown> = ${s.camel}ToDict(item)
      return fields.map((f) => {
        const column = EXPORT_FIELD_MAP[f]
        if (Array.isArray(column)) return column[1](item)
        return f in dict ? dict[f] : ''
      })
    })
    return buildTable(headers, rows, ${q(`${s.name}_export`)}, fileType)
  }

  async downloadTemplate(fileTypeRaw: unknown) {
    const fileType = normalizeTableFileType(fileTypeRaw, 'xlsx')
    return buildTable(Object.keys(IMPORT_HEADER_MAP), [], ${q(`${s.name}_import_template`)}, fileType)
  }

  /** Import: the whole batch is one transaction; any error row rolls it all back and returns 400 + error_rows */
  async importItems(file: UploadedFile | null${ds ? ', actor?: Actor' : ''}) {
    let table
    try {
      table = await readTableFile(file)
    } catch (err) {
      if (err instanceof TableFileError) throw new ServiceError(err.message, 400)
      throw err
    }
    const requiredHeader = Object.keys(IMPORT_HEADER_MAP)[0] ?? ''

    return this.inTx(async (repo) => {
      let created = 0
      const errors: ErrorRow[] = []
      for (const [line, row] of table.rows) {
        if (!(row[requiredHeader] ?? '').trim()) {
          errors.push(buildErrorRow(line, \`\${requiredHeader}不能为空\`, row))
          continue
        }
        const mapped: Data = {}
        for (const [header, value] of Object.entries(row)) {
          const field = IMPORT_HEADER_MAP[header]
          if (field && value) mapped[field] = value
        }
        let values
        try {
          values = buildValues(mapped, true)
        } catch (err) {
          if (!(err instanceof ServiceError)) throw err
          errors.push(buildErrorRow(line, err.message, row))
          continue
        }
        try {
          await repo.insert(${ds ? '{ ...values, ...stamp(actor) }' : 'values'})
        } catch (err) {
          // The database rejected this row (unique conflict, too long, ...): the transaction is aborted, so return it with the error rows found so far
          const rowError = dbConstraintError(err)
          if (!rowError) throw err
          errors.push(buildErrorRow(line, rowError.message, row))
          throw new ServiceError('导入失败，存在错误数据', 400, { error_rows: errors.slice(0, 500), error_count: errors.length })
        }
        created += 1
      }
      if (errors.length > 0) {
        // Throw so the whole transaction rolls back
        throw new ServiceError('导入失败，存在错误数据', 400, {
          error_rows: errors.slice(0, 500),
          error_count: errors.length,
        })
      }
      return { message: '导入成功', created, updated: 0 }
    })
  }
}
`
}

export function genRoutes(s: ScaffoldSpec): string {
  const p = s.permPrefix
  const ds = s.dataScope
  const scope = ds ? ', await resolveDataScope(request)' : ''
  const actor = ds ? ', await currentActor(request)' : ''
  return `/**
 * ${s.pascal} routes (generated by scripts/scaffold.ts)
 *
 * Permission codes: ${p} (view / template), ${p}_add, ${p}_edit, ${p}_delete, ${p}_export, ${p}_import
 * Routes with an id load the record first (404 when missing), then check permissions (403).${
    ds ? '\n * Data scope: records outside the caller\'s scope are a 404, like missing ones; new records are stamped with the creator.' : ''
  }
 */

import type { FastifyInstance } from 'fastify'
import { hasMenuPermission, loginRequired } from '@/common/auth'
${ds ? `import { currentActor, resolveDataScope } from '@/common/data-scope'\n` : ''}import { getUploadedFile, intParam, jsonBody, parseIntParam, queryString } from '@/common/http'
import { parsePagination } from '@/common/pagination'
import { sendTable } from '@/common/tabular'
import { ${s.pascal}Service } from './service'

const BASE = ${q(s.apiBase)}

export async function register${s.pascal}Routes(app: FastifyInstance): Promise<void> {
  const service = new ${s.pascal}Service(app.db)
  const opts = { preHandler: loginRequired }
  const itemPath = \`\${BASE}/\${intParam('item_id')}\`
  const itemId = (params: unknown) => parseIntParam((params as { item_id: string }).item_id)

  app.get(BASE, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, ${q(p)}))) {
      return reply.status(403).send({ error: '无权限' })
    }
    const { page, per_page } = parsePagination(request.query as Record<string, unknown>)
    return service.listItems(page, per_page, queryString(request, 'search').trim()${scope})
  })

  app.post(BASE, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, ${q(`${p}_add`)}))) {
      return reply.status(403).send({ error: '无权限新增' })
    }
    return reply.status(201).send(await service.createItem(jsonBody(request)${actor}))
  })

  app.get(itemPath, opts, async (request, reply) => {
    const item = await service.getOr404(itemId(request.params)${scope})
    if (!(await hasMenuPermission(request, ${q(p)}))) {
      return reply.status(403).send({ error: '无权限' })
    }
    return service.getItem(item)
  })

  app.put(itemPath, opts, async (request, reply) => {
    const item = await service.getOr404(itemId(request.params)${scope})
    if (!(await hasMenuPermission(request, ${q(`${p}_edit`)}))) {
      return reply.status(403).send({ error: '无权限编辑' })
    }
    return service.updateItem(item, jsonBody(request))
  })

  app.delete(itemPath, opts, async (request, reply) => {
    const item = await service.getOr404(itemId(request.params)${scope})
    if (!(await hasMenuPermission(request, ${q(`${p}_delete`)}))) {
      return reply.status(403).send({ error: '无权限删除' })
    }
    return service.deleteItem(item)
  })

  app.post(\`\${BASE}/export\`, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, ${q(`${p}_export`)}))) {
      return reply.status(403).send({ error: '无权限导出' })
    }
    return sendTable(reply, await service.exportItems(jsonBody(request)${scope}))
  })

  app.get(\`\${BASE}/template\`, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, ${q(p)}))) {
      return reply.status(403).send({ error: '无权限' })
    }
    return sendTable(reply, await service.downloadTemplate(queryString(request, 'file_type', 'xlsx')))
  })

  app.post(\`\${BASE}/import\`, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, ${q(`${p}_import`)}))) {
      return reply.status(403).send({ error: '无权限导入' })
    }
    return service.importItems(await getUploadedFile(request)${actor})
  })
}
`
}

// ─── Backend test generation ───────────────────────────────────────────────────

/** Sample value per scaffold type (TS source snippet); strings carry a tag so repeated creates don't hit unique constraints */
function sampleExpr(field: string, type: string): string {
  const maxLen: Record<string, number> = { str: 100, str20: 20, str50: 50, str500: 500 }
  switch (fieldSpec(type).coerce) {
    case 'toInt':
      return '3'
    case 'toNumeric':
      return "'12.5'"
    case 'toBool':
      return 'true'
    case 'toDate':
      return "'2026-01-15'"
    case 'toDateTime':
      return "'2026-01-15 08:30:00'"
    default: {
      const text = `('ck-' + tag + '-${field}')`
      const len = maxLen[type] ?? (type === 'text' ? 0 : 100)
      return len > 0 ? `${text}.slice(0, ${len})` : text
    }
  }
}

export function testFilePath(s: ScaffoldSpec): string {
  return `${s.domain === 'admin' ? 'admin' : 'cc'}-${s.kebab}.test.ts`
}

export function genApiTest(s: ScaffoldSpec): string {
  const sampleLines = s.fields.map(([f, t]) => `    ${key(f)}: ${sampleExpr(f, t)},`)
  const ds = s.dataScope
  const helperImports = ds
    ? 'buildTestApp, cleanupFixture, multipartFile, openTestDb, scopedSession, superAdminSession, type AuthedSession'
    : 'buildTestApp, multipartFile, openTestDb, superAdminSession, type AuthedSession'
  const dataScopeTest = ds
    ? `

  it('数据权限：仅本人范围只看到自己创建的记录，别人的记录 404', async () => {
    const own = await scopedSession(app, handle, {
      name: ${q(`${s.name}_ds_self`)},
      codes: [${q(s.permPrefix)}, ${q(`${s.permPrefix}_add`)}, ${q(`${s.permPrefix}_edit`)}, ${q(`${s.permPrefix}_export`)}],
      dataScope: 'self',
    })
    const mine = await own.inject({ method: 'POST', url: BASE, payload: sample('ds-mine') })
    expect(mine.statusCode, mine.body).toBe(201)
    expect(mine.json().created_by).toBe(own.userId)
    const theirs = (await s.inject({ method: 'POST', url: BASE, payload: sample('ds-theirs') })).json()

    const listed = (await own.inject({ url: BASE + '?per_page=200' })).json().items.map((i: { id: number }) => i.id)
    expect(listed).toContain(mine.json().id)
    expect(listed).not.toContain(theirs.id)
    expect((await own.inject({ url: BASE + '/' + theirs.id })).statusCode).toBe(404)
    expect((await own.inject({ method: 'PUT', url: BASE + '/' + theirs.id, payload: sample('ds-x') })).statusCode).toBe(404)
    const exported = await own.inject({ method: 'POST', url: BASE + '/export', payload: { file_type: 'csv', fields: ['id'] } })
    expect(exported.body.split('\\r\\n').filter(Boolean).slice(1)).toEqual([String(mine.json().id)])
  })`
    : ''
  return `/**
 * ${s.pascal} basic API tests (generated by scripts/scaffold.ts)
 *
 * Covers: CRUD, list pagination and search, 404, export, import template, successful import / whole-batch rollback on an empty required column.
 * After adding business rules (required / unique / enum / defaults ...), update sample() and the assertions, and add the matching failure cases.
 * Test data is cleaned up by id: only rows created while this file runs are deleted.
 */

import type { FastifyInstance } from 'fastify'
import { gt, max } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DbHandle } from '@/db/client'
import { ${s.table} } from '@/db/schema'
import { IMPORT_HEADER_MAP } from '@/modules/${s.domainDir}/${s.kebab}/schema'
import { ${helperImports} } from './helpers'

const BASE = ${q(s.apiBase)}

/** Sample value per field (the tag makes strings differ on every call) */
function sample(tag: string): Record<string, unknown> {
  return {
${sampleLines.join('\n')}
  }
}

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value)
  return /[",\\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text
}

function importCsv(rows: Record<string, unknown>[]): string {
  const headers = Object.keys(IMPORT_HEADER_MAP)
  const lines = rows.map((values) => headers.map((h) => csvCell(values[IMPORT_HEADER_MAP[h]!])).join(','))
  return [headers.map(csvCell).join(','), ...lines].join('\\n') + '\\n'
}

let app: FastifyInstance
let handle: DbHandle
let s: AuthedSession
let baselineId = 0

async function countNew(): Promise<number> {
  return (await handle.db.select({ id: ${s.table}.id }).from(${s.table}).where(gt(${s.table}.id, baselineId))).length
}

beforeAll(async () => {
  handle = openTestDb()
  app = await buildTestApp()
  const [row] = await handle.db.select({ id: max(${s.table}.id) }).from(${s.table})
  baselineId = row?.id ?? 0
  s = await superAdminSession(app, handle)
})

afterAll(async () => {
  await handle.db.delete(${s.table}).where(gt(${s.table}.id, baselineId))
${ds ? '  await cleanupFixture(handle)\n' : ''}  await app.close()
  await handle.pool.end()
})

describe(${q(`${s.table} 接口`)}, () => {
  it('新增 → 详情 → 编辑 → 删除', async () => {
    const created = await s.inject({ method: 'POST', url: BASE, payload: sample('a') })
    expect(created.statusCode, created.body).toBe(201)
    const item = created.json()
    expect(item.id).toBeGreaterThan(baselineId)
    expect((await s.inject({ url: BASE + '/' + item.id })).json()).toEqual(item)

    const updated = await s.inject({ method: 'PUT', url: BASE + '/' + item.id, payload: sample('b') })
    expect(updated.statusCode, updated.body).toBe(200)
    expect((await s.inject({ url: BASE + '/' + item.id })).json()).toEqual(updated.json())

    expect((await s.inject({ method: 'DELETE', url: BASE + '/' + item.id })).json()).toEqual({ message: '删除成功' })
    expect((await s.inject({ url: BASE + '/' + item.id })).statusCode).toBe(404)
  })

  it('列表：分页形状；按 ${s.nameField} 搜索', async () => {
    const created = (await s.inject({ method: 'POST', url: BASE, payload: sample('list') })).json()
    const page = await s.inject({ url: BASE + '?page=1&per_page=5' })
    expect(page.statusCode).toBe(200)
    expect(page.json()).toMatchObject({ page: 1, per_page: 5 })
    expect(page.json().items.length).toBeLessThanOrEqual(5)
    const found = await s.inject({ url: BASE + '?search=' + encodeURIComponent(String(created.${s.nameField})) })
    expect(found.json().items.map((i: { id: number }) => i.id)).toContain(created.id)
  })

  it('不存在的记录返回 404', async () => {
    expect((await s.inject({ url: BASE + '/99999999' })).statusCode).toBe(404)
  })

  it('导出 csv 与导入模板', async () => {
    const exported = await s.inject({ method: 'POST', url: BASE + '/export', payload: { file_type: 'csv' } })
    expect(exported.statusCode).toBe(200)
    expect(exported.headers['content-type']).toContain('csv')
    const template = await s.inject({ url: BASE + '/template?file_type=csv' })
    expect(template.statusCode).toBe(200)
    expect(template.body).toContain(Object.keys(IMPORT_HEADER_MAP)[0])
  })

  it('导入 csv：合法行新增；必填列为空时整批回滚', async () => {
    const ok = await s.inject({ method: 'POST', url: BASE + '/import', ...multipartFile('import.csv', importCsv([sample('imp')])) })
    expect(ok.json()).toEqual({ message: '导入成功', created: 1, updated: 0 })

    const before = await countNew()
    const requiredField = IMPORT_HEADER_MAP[Object.keys(IMPORT_HEADER_MAP)[0]!]!
    const bad = await s.inject({
      method: 'POST',
      url: BASE + '/import',
      ...multipartFile('import.csv', importCsv([sample('imp2'), { ...sample('imp3'), [requiredField]: '' }])),
    })
    expect(bad.statusCode).toBe(400)
    expect(bad.json().error_count).toBe(1)
    expect(await countNew()).toBe(before)
  })${dataScopeTest}
})
`
}

// ─── Frontend code generation (shadcn/ui, same structure as apps/web/src/modules/admin/pages/users/index.jsx) ──
//
// The api file comes from a fixed template; the page follows docs/frontend-redesign-plan.md:
// PageHeader + FilterBar/SearchInput + DataTable + FormDialog/FormFields + ImportDialog/ExportDialog
// + ConfirmAction + toast + useCrudList. Field → form component / table column rendering: see FRONTEND_FIELD_MAP.
//
// i18n (see apps/web/src/i18n/index.js): Chinese source text is the key. Strings passed to shared components stay
// plain Chinese (the components translate them); JSX text, native attributes and interpolated text go through
// t() / <Trans>. Every fixed Chinese string the page emits must have an entry in PAGE_TEXTS; the ones missing from
// apps/web/src/locales are written to the page's own locales/ (see genFrontendLocales).

type FrontendKind = 'str' | 'text' | 'int' | 'float' | 'bool' | 'date' | 'datetime'

export interface FrontendFieldSpec {
  /** Form component from FormFields.jsx */
  component: 'FormInput' | 'FormTextarea' | 'FormNumber' | 'FormSwitch' | 'FormDate' | 'FormDateTime'
  /** Extra props for the form component (JSX snippet) */
  props: string
  /** useForm default value (JS literal) */
  empty: string
}

export const FRONTEND_FIELD_MAP: Record<FrontendKind, FrontendFieldSpec> = {
  str: { component: 'FormInput', props: '', empty: "''" },
  text: { component: 'FormTextarea', props: '', empty: "''" },
  int: { component: 'FormNumber', props: ' step={1}', empty: 'null' },
  float: { component: 'FormNumber', props: ' step={0.01}', empty: 'null' },
  bool: { component: 'FormSwitch', props: '', empty: 'false' },
  date: { component: 'FormDate', props: '', empty: "''" },
  datetime: { component: 'FormDateTime', props: '', empty: "''" },
}

/** scaffold type → frontend field kind (str20 / str50 / str500 / unknown types all map to str) */
export function frontendKind(type: string): FrontendKind {
  return type in FRONTEND_FIELD_MAP ? (type as FrontendKind) : 'str'
}

export const PAGE_LANGS = ['en-US', 'ja-JP'] as const
export type PageLang = (typeof PAGE_LANGS)[number]
/** Translation catalog per language: { Chinese source text → translation } */
export type Catalogs = Partial<Record<PageLang, Record<string, string>>>

/**
 * Translations of every fixed Chinese string a generated page can contain.
 * Most of them are shared CRUD strings already in apps/web/src/locales; the values must match those files exactly
 * (a key translated differently in two locales files is a conflict, see apps/web/test/i18n.test.js).
 * They are still listed here so a checkout whose shared locales lack a string gets it in the page's own locales.
 */
export const PAGE_TEXTS: Record<string, Record<PageLang, string>> = {
  创建时间: { 'en-US': 'Created at', 'ja-JP': '作成日時' },
  是: { 'en-US': 'Yes', 'ja-JP': 'はい' },
  否: { 'en-US': 'No', 'ja-JP': 'いいえ' },
  加载失败: { 'en-US': 'Failed to load', 'ja-JP': '読み込みに失敗しました' },
  更新成功: { 'en-US': 'Updated', 'ja-JP': '更新しました' },
  创建成功: { 'en-US': 'Created', 'ja-JP': '作成しました' },
  操作失败: { 'en-US': 'Operation failed', 'ja-JP': '操作に失敗しました' },
  删除成功: { 'en-US': 'Deleted', 'ja-JP': '削除しました' },
  删除失败: { 'en-US': 'Delete failed', 'ja-JP': '削除に失敗しました' },
  导出成功: { 'en-US': 'Export complete', 'ja-JP': 'エクスポートしました' },
  导出失败: { 'en-US': 'Export failed', 'ja-JP': 'エクスポートに失敗しました' },
  编辑: { 'en-US': 'Edit', 'ja-JP': '編集' },
  删除: { 'en-US': 'Delete', 'ja-JP': '削除' },
  '确认删除该记录？': { 'en-US': 'Delete this record?', 'ja-JP': 'このレコードを削除しますか？' },
  '删除后不可恢复。': { 'en-US': "This can't be undone.", 'ja-JP': '削除すると元に戻せません。' },
  导入: { 'en-US': 'Import', 'ja-JP': 'インポート' },
  导出: { 'en-US': 'Export', 'ja-JP': 'エクスポート' },
  新增: { 'en-US': 'Add', 'ja-JP': '追加' },
  '搜索…': { 'en-US': 'Search…', 'ja-JP': '検索…' },
  '已勾选 <0>{{count}}</0> 条，导出时将优先导出勾选数据': {
    'en-US': '<0>{{count}}</0> selected. Export will use the selected rows.',
    'ja-JP': '<0>{{count}}</0> 件を選択中。エクスポート時は選択したデータが優先されます',
  },
  清空勾选: { 'en-US': 'Clear selection', 'ja-JP': '選択を解除' },
  暂无数据: { 'en-US': 'No data', 'ja-JP': 'データがありません' },
  换个关键词试试: { 'en-US': 'Try a different keyword', 'ja-JP': '別のキーワードでお試しください' },
  '点击右上角「新增」添加第一条数据': {
    'en-US': 'Click "Add" in the top right to add the first record',
    'ja-JP': '右上の「追加」から最初のデータを追加してください',
  },
  导出设置: { 'en-US': 'Export settings', 'ja-JP': 'エクスポート設定' },
  '已勾选 {{count}} 条，将优先导出勾选数据。': {
    'en-US': '{{count}} selected. Only the selected rows will be exported.',
    'ja-JP': '{{count}} 件を選択中です。選択したデータが優先してエクスポートされます。',
  },
  '未勾选数据时导出全部数据。': {
    'en-US': 'With nothing selected, all data is exported.',
    'ja-JP': '何も選択していない場合は、すべてのデータをエクスポートします。',
  },
  导入数据: { 'en-US': 'Import data', 'ja-JP': 'データのインポート' },
  模板已下载: { 'en-US': 'Template downloaded', 'ja-JP': 'テンプレートをダウンロードしました' },
  模板下载失败: { 'en-US': 'Template download failed', 'ja-JP': 'テンプレートのダウンロードに失敗しました' },
  '导入成功：新增 {{created}} 条，更新 {{updated}} 条': {
    'en-US': 'Imported: {{created}} added, {{updated}} updated',
    'ja-JP': 'インポートしました：追加 {{created}} 件、更新 {{updated}} 件',
  },
}

export function genFrontendApi(s: ScaffoldSpec): string {
  return `import request from '@/shared/api/request'

const BASE = '/admin/${s.kebab}s'

export const getItems = (params) => request.get(BASE, { params })
export const createItem = (data) => request.post(BASE, data)
export const updateItem = (id, data) => request.put(\`\${BASE}/\${id}\`, data)
export const deleteItem = (id) => request.delete(\`\${BASE}/\${id}\`)

export const exportItems = (data) =>
  request.post(\`\${BASE}/export\`, data, { responseType: 'blob' })

export const downloadTemplate = (fileType = 'xlsx') =>
  request.get(\`\${BASE}/template\`, { params: { file_type: fileType }, responseType: 'blob' })

export const importItems = (file) => {
  const formData = new FormData()
  formData.append('file', file)
  return request.post(\`\${BASE}/import\`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}
`
}

/** Edit: record → form value (dates converted to the DatePicker / DateTimePicker format) */
function formValueExpr(field: string, kind: FrontendKind): string {
  const v = `record.${field}`
  if (kind === 'bool') return `Boolean(${v})`
  if (kind === 'date') return `formatDate(${v}, '')`
  if (kind === 'datetime') return `formatDateTime(${v}, '')`
  if (kind === 'int' || kind === 'float') return `${v} ?? null`
  return `${v} ?? ''`
}

/** Table column: bool → StatusBadge, dates → formatDate / formatDateTime, numbers → tabular-nums */
function columnLines(field: string, kind: FrontendKind): string[] {
  const head = [`    {`, `      key: ${q(field)},`, `      title: ${q(toLabel(field))},`, `      dataIndex: ${q(field)},`]
  const tail = [`    },`]
  if (kind === 'bool') {
    // StatusBadge translates string children, so the Chinese stays plain
    return [
      ...head,
      `      width: 100,`,
      `      render: (value) => (`,
      `        <StatusBadge tone={value ? 'success' : 'neutral'} dot>`,
      `          {value ? '是' : '否'}`,
      `        </StatusBadge>`,
      `      ),`,
      ...tail,
    ]
  }
  if (kind === 'date') {
    return [...head, `      width: 120,`, `      className: 'text-muted-foreground tabular-nums',`, `      render: (value) => formatDate(value),`, ...tail]
  }
  if (kind === 'datetime') {
    return [...head, `      width: 180,`, `      className: 'text-muted-foreground tabular-nums',`, `      render: (value) => formatDateTime(value),`, ...tail]
  }
  if (kind === 'int' || kind === 'float') {
    return [...head, `      align: 'right',`, `      className: 'tabular-nums',`, ...tail]
  }
  if (kind === 'text') return [...head, `      ellipsis: true,`, ...tail]
  return [`    { key: ${q(field)}, title: ${q(toLabel(field))}, dataIndex: ${q(field)} },`]
}

export function genFrontendPage(s: ScaffoldSpec): string {
  const fields = s.fields.map(([f, t]) => [f, frontendKind(t)] as const)
  const columnFields = s.exportFields.map(([f, t]) => [f, frontendKind(t)] as const)
  const kinds = new Set(fields.map(([, k]) => k))
  const title = toLabel(s.name)
  const k = s.kebab

  // Import only the components in use (apps/web's eslint enables no-unused-vars)
  const formComponents = [...new Set(fields.map(([, kind]) => FRONTEND_FIELD_MAP[kind].component))].sort()
  const formatImports = [...(kinds.has('date') ? ['formatDate'] : []), 'formatDateTime']
  const needsStatusBadge = columnFields.some(([, kind]) => kind === 'bool')

  const exportFields = [
    "  { label: 'ID', value: 'id' },",
    ...s.exportFields.map(([f]) => `  { label: ${q(toLabel(f))}, value: ${q(f)} },`),
    "  { label: '创建时间', value: 'created_at' },",
  ]
  const emptyLines = fields.map(([f, kind]) => `  ${key(f)}: ${FRONTEND_FIELD_MAP[kind].empty},`)
  const toFormLines = fields.map(([f, kind]) => `  ${key(f)}: ${formValueExpr(f, kind)},`)
  const formLines = fields.map(([f, kind]) => {
    const spec = FRONTEND_FIELD_MAP[kind]
    return `        <${spec.component} control={form.control} name="${f}" label="${toLabel(f)}"${spec.props} />`
  })
  const columns = [
    `    { key: 'id', title: 'ID', dataIndex: 'id', width: 72, className: 'text-muted-foreground tabular-nums' },`,
    ...columnFields.flatMap(([f, kind]) => columnLines(f, kind)),
    `    {`,
    `      key: 'created_at',`,
    `      title: '创建时间',`,
    `      dataIndex: 'created_at',`,
    `      width: 180,`,
    `      className: 'text-muted-foreground tabular-nums',`,
    `      render: (value) => formatDateTime(value),`,
    `    },`,
    `    {`,
    `      key: 'actions',`,
    `      title: '',`,
    `      align: 'right',`,
    `      width: 132,`,
    `      render: (_, record) => (`,
    `        <div className="flex justify-end gap-0.5">`,
    `          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => openEdit(record)}>`,
    `            {t('编辑')}`,
    `          </Button>`,
    `          <ConfirmAction title="确认删除该记录？" description="删除后不可恢复。" confirmText="删除" onConfirm={() => remove(record)}>`,
    `            <Button variant="ghost" size="sm" className="text-danger hover:text-danger h-7 px-2">`,
    `              {t('删除')}`,
    `            </Button>`,
    `          </ConfirmAction>`,
    `        </div>`,
    `      ),`,
    `    },`,
  ]

  return `/**
 * ${title} list page (generated by scripts/scaffold.ts; same structure as apps/web/src/modules/admin/pages/users/index.jsx)
 *
 * PageHeader -> FilterBar -> DataTable (pagination / selection / row actions) -> FormDialog (react-hook-form)
 * -> ImportDialog / ExportDialog. The title and field labels are English placeholders: replace them with Chinese
 * for the business and add required checks in rules.
 *
 * i18n: Chinese source text is the key. Strings passed to shared components (PageHeader, DataTable columns,
 * FormDialog, FormFields, ExportDialog, toast, ...) are translated inside them; text written in JSX, native
 * attributes and interpolated strings go through t() / <Trans>. Shared CRUD strings are translated in
 * src/locales; add page-specific translations (e.g. the Chinese title and labels) to ./locales/<lang>.json.
 */
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { AnimatePresence, motion } from 'motion/react'
import { Trans, useTranslation } from 'react-i18next'
import { Download, Plus, Upload, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ${formatImports.join(', ')} } from '@/lib/format'
import { toast } from '@/lib/toast'
import {
  createItem,
  deleteItem,
  downloadTemplate,
  exportItems,
  getItems,
  importItems,
  updateItem,
} from '@/modules/${s.webModule}/api/${s.name}'
import ConfirmAction from '@/shared/components/ConfirmAction'
import DataTable from '@/shared/components/DataTable'
import ExportDialog from '@/shared/components/data-transfer/ExportDialog'
import ImportDialog from '@/shared/components/data-transfer/ImportDialog'
import { FilterBar, SearchInput } from '@/shared/components/Filters'
import { FormDialog } from '@/shared/components/FormDialog'
import { ${formComponents.join(', ')} } from '@/shared/components/FormFields'
import PageHeader from '@/shared/components/PageHeader'
${needsStatusBadge ? "import StatusBadge from '@/shared/components/StatusBadge'\n" : ''}import { useCrudList } from '@/shared/hooks/useCrudList'
import { downloadBlobFile } from '@/shared/utils/file'

const EXPORT_FIELDS = [
${exportFields.join('\n')}
]
const normalizeFileType = (raw) => (['csv', 'xlsx'].includes(raw) ? raw : 'xlsx')

const EMPTY_VALUES = {
${emptyLines.join('\n')}
}

/** Edit: take only the form fields (id / created_at are not sent back); dates converted to the picker format */
const toFormValues = (record) => ({
${toFormLines.join('\n')}
})

export default function ${s.pascal}Page() {
  const { t } = useTranslation()
  const list = useCrudList(
    (params) =>
      getItems(params).catch((err) => {
        toast.apiError(err, '加载失败')
        return { items: [], total: 0 }
      }),
    { defaultPerPage: 20 },
  )
  const { data, total, loading, page, perPage, filters, fetchData, handlePageChange } = list
  const [search, setSearch] = useState('')
  const [selectedKeys, setSelectedKeys] = useState([])
  const [editing, setEditing] = useState(null)
  const [formOpen, setFormOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)

  const form = useForm({ defaultValues: EMPTY_VALUES })

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const openCreate = () => {
    setEditing(null)
    form.reset(EMPTY_VALUES)
    setFormOpen(true)
  }

  const openEdit = (record) => {
    setEditing(record)
    form.reset(toFormValues(record))
    setFormOpen(true)
  }

  const submit = async (values) => {
    try {
      if (editing) {
        await updateItem(editing.id, values)
        toast.success('更新成功')
      } else {
        await createItem(values)
        toast.success('创建成功')
      }
      setFormOpen(false)
      fetchData()
    } catch (err) {
      toast.apiError(err, '操作失败')
      throw err
    }
  }

  const remove = async (record) => {
    try {
      await deleteItem(record.id)
      toast.success('删除成功')
      setSelectedKeys((keys) => keys.filter((k) => k !== record.id))
      fetchData()
    } catch (err) {
      toast.apiError(err, '删除失败')
      throw err
    }
  }

  const runSearch = () => {
    setSelectedKeys([])
    list.handleSearch({ search: search.trim() })
  }
  const reset = () => {
    setSearch('')
    setSelectedKeys([])
    list.handleReset()
  }

  const handleExport = async ({ fields, fileType }) => {
    const type = normalizeFileType(fileType)
    const payload = { fields, file_type: type }
    if (selectedKeys.length) payload.ids = selectedKeys
    try {
      const blob = await exportItems(payload)
      downloadBlobFile(blob, \`${k}s_export.\${type}\`)
      toast.success('导出成功')
      setExportOpen(false)
    } catch (err) {
      toast.apiError(err, '导出失败')
    }
  }

  const columns = [
${columns.join('\n')}
  ]

  return (
    <div>
      <PageHeader
        title="${title}"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
              <Upload />
              {t('导入')}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setExportOpen(true)}>
              <Download />
              {t('导出')}
            </Button>
            <Button size="sm" variant="brand" onClick={openCreate}>
              <Plus />
              {t('新增')}
            </Button>
          </>
        }
      />

      <FilterBar onSearch={runSearch} onReset={reset}>
        <SearchInput value={search} onChange={setSearch} onSubmit={runSearch} placeholder="搜索…" />
      </FilterBar>

      <AnimatePresence>
        {selectedKeys.length > 0 ? (
          <motion.div
            initial={{ opacity: 0, y: -6, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -6, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-brand-soft mb-3 flex items-center gap-3 rounded-lg px-3 py-2 text-[13px]">
              <span>
                <Trans
                  i18nKey="已勾选 <0>{{count}}</0> 条，导出时将优先导出勾选数据"
                  values={{ count: selectedKeys.length }}
                  components={[<span className="font-medium tabular-nums" />]}
                />
              </span>
              <Button variant="ghost" size="sm" className="ml-auto h-7" onClick={() => setSelectedKeys([])}>
                <X />
                {t('清空勾选')}
              </Button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <DataTable
        columns={columns}
        data={data}
        loading={loading}
        selectable
        selectedKeys={selectedKeys}
        onSelectionChange={setSelectedKeys}
        pagination={{ page, perPage, total, onChange: handlePageChange }}
        emptyTitle="暂无数据"
        emptyDescription={filters.search ? '换个关键词试试' : '点击右上角「新增」添加第一条数据'}
      />

      <FormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        title={editing ? '编辑' : '新增'}
        form={form}
        onSubmit={submit}
      >
${formLines.join('\n')}
      </FormDialog>

      <ExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        title="导出设置"
        ruleHint={
          selectedKeys.length
            ? t('已勾选 {{count}} 条，将优先导出勾选数据。', { count: selectedKeys.length })
            : '未勾选数据时导出全部数据。'
        }
        fieldOptions={EXPORT_FIELDS}
        onConfirm={handleExport}
      />

      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        title="导入数据"
        targetLabel="${title}"
        onDownloadTemplate={(fileType) =>
          downloadTemplate(normalizeFileType(fileType))
            .then((blob) => {
              downloadBlobFile(blob, \`${k}s_import_template.\${normalizeFileType(fileType)}\`)
              toast.success('模板已下载')
            })
            .catch((err) => toast.apiError(err, '模板下载失败'))
        }
        onImport={(file) => importItems(file)}
        onImported={(res) => {
          toast.success(t('导入成功：新增 {{created}} 条，更新 {{updated}} 条', { created: res?.created || 0, updated: res?.updated || 0 }))
          fetchData()
        }}
        errorExportFileName="${k}s_import_errors.csv"
      />
    </div>
  )
}
`
}

const CJK = /[㐀-鿿豈-﫿]/

/** Fixed Chinese strings in generated page code: the contents of '…' / "…" literals that contain CJK characters */
export function pageTexts(code: string): string[] {
  const texts = new Set<string>()
  // Drop comments first so an apostrophe in prose can't pair up with a real quote
  const source = code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  for (const [, , text] of source.matchAll(/(['"])((?:(?!\1)[^\\\n])*)\1/g)) {
    if (text && CJK.test(text)) texts.add(text)
  }
  return [...texts].sort()
}

/**
 * Page locales: translations of the page's fixed Chinese strings that the shared catalogs (apps/web/src/locales) lack.
 * Both languages get the same keys (a string missing in either shared catalog goes into both page files).
 * Returns null when the shared catalogs already cover everything.
 */
export function genFrontendLocales(s: ScaffoldSpec, shared: Catalogs = {}): Record<PageLang, Record<string, string>> | null {
  const missing = pageTexts(genFrontendPage(s)).filter((text) => PAGE_LANGS.some((lang) => !shared[lang]?.[text]))
  if (missing.length === 0) return null
  const unknown = missing.filter((text) => !PAGE_TEXTS[text])
  if (unknown.length > 0) throw new Error(`PAGE_TEXTS has no translation for: ${unknown.join(', ')}`)
  return Object.fromEntries(
    PAGE_LANGS.map((lang) => [lang, Object.fromEntries(missing.map((text) => [text, PAGE_TEXTS[text]![lang]]))]),
  ) as Record<PageLang, Record<string, string>>
}

/** Shared catalogs of the target repo (a missing / unreadable file counts as empty) */
export function readSharedCatalogs(root: string): Catalogs {
  const catalogs: Catalogs = {}
  for (const lang of PAGE_LANGS) {
    try {
      catalogs[lang] = JSON.parse(readFileSync(join(root, 'apps', 'web', 'src', 'locales', `${lang}.json`), 'utf8')) as Record<string, string>
    } catch {
      catalogs[lang] = {}
    }
  }
  return catalogs
}

// ─── Auto-registration ─────────────────────────────────────────────────────────

/** Register `export * from './<domainDir>/<kebab>'` in db/schema/index.ts; returns null when already registered */
export function registerSchemaExport(content: string, domainDir: string, kebab: string): string | null {
  const line = `export * from './${domainDir}/${kebab}'`
  const escaped = `./${domainDir}/${kebab}`.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  if (new RegExp(`from\\s+['"]${escaped}['"]`).test(content)) return null
  const lines = content.split('\n')
  let insertAt = -1
  lines.forEach((l, i) => {
    if (l.startsWith(`export * from './${domainDir}/`)) insertAt = i
  })
  if (insertAt >= 0) {
    lines.splice(insertAt + 1, 0, line)
    return lines.join('\n')
  }
  const trimmed = content.replace(/\s+$/, '')
  return `${trimmed}\n\n// ${domainDir.replace(/-/g, '_')}\n${line}\n`
}

/** Register the import + `await registerXRoutes(app)` in modules/<domain>/router.ts; returns null when already registered */
export function registerRoute(content: string, pascal: string, kebab: string): string | null {
  const fn = `register${pascal}Routes`
  if (new RegExp(`\\b${fn}\\b`).test(content)) return null
  const lines = content.split('\n')

  let lastImport = -1
  lines.forEach((l, i) => {
    if (/^import\s/.test(l) || /\bfrom\s+['"][^'"]+['"];?\s*$/.test(l)) lastImport = i
  })
  let lastCall = -1
  lines.forEach((l, i) => {
    if (/^\s*await\s+register\w+Routes\(\s*app\s*\)/.test(l)) lastCall = i
  })
  if (lastCall < 0) {
    throw new Error('router.ts 中找不到 `await registerXxxRoutes(app)` 调用，无法自动注册，请手动添加')
  }
  const indent = /^(\s*)/.exec(lines[lastCall]!)?.[1] ?? '  '
  lines.splice(lastCall + 1, 0, `${indent}await ${fn}(app)`)
  lines.splice(lastImport + 1, 0, `import { ${fn} } from './${kebab}/routes'`)
  return lines.join('\n')
}

// ─── File writing ──────────────────────────────────────────────────────────────

export interface ScaffoldOptions {
  root?: string
  dryRun?: boolean
  skipMigration?: boolean
  log?: (line: string) => void
  /** --data-scope */
  dataScope?: boolean
}

function writeFile(root: string, path: string, content: string, dryRun: boolean, log: (l: string) => void): void {
  const rel = relative(root, path)
  if (dryRun) {
    log(`  [dry-run] would write: ${rel}`)
    return
  }
  mkdirSync(dirname(path), { recursive: true })
  if (existsSync(path)) {
    log(`  [skip] already exists: ${rel}`)
    return
  }
  writeFileSync(path, content, 'utf8')
  log(`  [create] ${rel}`)
}

function updateFile(
  root: string,
  path: string,
  transform: (content: string) => string | null,
  dryRun: boolean,
  log: (l: string) => void,
): void {
  const rel = relative(root, path)
  if (!existsSync(path)) throw new Error(`注册文件不存在：${rel}`)
  if (dryRun) {
    log(`  [dry-run] would update: ${rel}`)
    return
  }
  const next = transform(readFileSync(path, 'utf8'))
  if (next === null) {
    log(`  [skip] already registered: ${rel}`)
    return
  }
  writeFileSync(path, next, 'utf8')
  log(`  [update] ${rel}`)
}

function sortKeys(obj: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.keys(obj).sort().map((k) => [k, obj[k]!]))
}

function resolveDrizzleKit(apiDir: string): string[] {
  const local = join(apiDir, 'node_modules', '.bin', 'drizzle-kit')
  return existsSync(local) ? [local] : ['npx', 'drizzle-kit']
}

// ─── Main flow ─────────────────────────────────────────────────────────────────

/** Parse the "name:str,phone:str20,amount:float" format */
export function parseFields(fieldsStr: string): Field[] {
  if (!fieldsStr) return [['name', 'str']]
  const result: Field[] = []
  for (const raw of fieldsStr.split(',')) {
    const part = raw.trim()
    const idx = part.indexOf(':')
    if (idx >= 0) result.push([part.slice(0, idx).trim(), part.slice(idx + 1).trim()])
    else result.push([part, 'str'])
  }
  return result
}

/** Generate all files; returns 0 on success / 1 on failure */
export function scaffold(
  name: string,
  domain: 'admin' | 'component_center',
  fieldsStr: string,
  options: ScaffoldOptions = {},
): number {
  const root = resolve(options.root ?? DEFAULT_ROOT)
  const dryRun = options.dryRun ?? false
  const log = options.log ?? ((l: string) => console.log(l))
  const fields = parseFields(fieldsStr)
  const s = buildSpec(name, domain, fields, { dataScope: options.dataScope })

  const apiDir = join(root, 'apps', 'api')
  const srcDir = join(apiDir, 'src')
  const moduleDir = join(srcDir, 'modules', s.domainDir, s.kebab)
  const feBase = join(root, 'apps', 'web', 'src', 'modules', s.webModule)
  // admin domain: pages/<name>/index.jsx; component_center domain: pages/admin/<name>_page/index.jsx
  const fePagePath =
    domain === 'admin' ? join(feBase, 'pages', name, 'index.jsx') : join(feBase, 'pages', 'admin', `${name}_page`, 'index.jsx')

  log(`\n🔧 Scaffolding: ${name} (domain=${domain})`)
  log(`   Fields: [${fields.map(([f, t]) => `('${f}', '${t}')`).join(', ')}]`)
  log(`   Perm prefix: ${s.permPrefix}`)
  log(`   Menu component: ${s.menuComponent}`)
  log(`   API: ${s.apiBase}`)
  log('')

  // Backend files
  writeFile(root, join(srcDir, 'db', 'schema', s.domainDir, `${s.kebab}.ts`), genDbSchema(s), dryRun, log)
  writeFile(root, join(moduleDir, 'schema.ts'), genModuleSchema(s), dryRun, log)
  writeFile(root, join(moduleDir, 'repository.ts'), genRepository(s), dryRun, log)
  writeFile(root, join(moduleDir, 'service.ts'), genService(s), dryRun, log)
  writeFile(root, join(moduleDir, 'routes.ts'), genRoutes(s), dryRun, log)
  writeFile(root, join(apiDir, 'test', testFilePath(s)), genApiTest(s), dryRun, log)

  // Frontend files
  writeFile(root, join(feBase, 'api', `${name}.js`), genFrontendApi(s), dryRun, log)
  writeFile(root, fePagePath, genFrontendPage(s), dryRun, log)
  const locales = genFrontendLocales(s, readSharedCatalogs(root))
  if (locales) {
    for (const lang of PAGE_LANGS) {
      const json = `${JSON.stringify(sortKeys(locales[lang]), null, 2)}\n`
      writeFile(root, join(dirname(fePagePath), 'locales', `${lang}.json`), json, dryRun, log)
    }
  } else {
    log('  [skip] page locales: every page string is translated in apps/web/src/locales')
  }

  // Registration
  try {
    updateFile(root, join(srcDir, 'db', 'schema', 'index.ts'), (c) => registerSchemaExport(c, s.domainDir, s.kebab), dryRun, log)
    updateFile(root, join(srcDir, 'modules', s.domainDir, 'router.ts'), (c) => registerRoute(c, s.pascal, s.kebab), dryRun, log)
  } catch (err) {
    log(`❌ ${err instanceof Error ? err.message : String(err)}`)
    return 1
  }

  // Migration
  if (dryRun) {
    log(`  [dry-run] would run: drizzle-kit generate --name ${name}`)
  } else if (options.skipMigration) {
    log('  [skip] migration（--skip-migration）')
  } else {
    log(`  [run] drizzle-kit generate --name ${name}`)
    const [cmd, ...pre] = resolveDrizzleKit(apiDir)
    const res = spawnSync(cmd!, [...pre, 'generate', '--name', name], { cwd: apiDir, encoding: 'utf8' })
    const output = `${res.stdout ?? ''}${res.stderr ?? ''}`.trim()
    // On success keep only the summary lines (drizzle-kit lists every table); on failure print everything
    const shown =
      res.status === 0 ? output.split('\n').filter((l) => /\[✓\]|No schema changes|warn/i.test(l)) : output.split('\n')
    if (shown.length > 0) log(shown.map((l) => `      ${l.trim()}`).join('\n'))
    if (res.status !== 0) {
      log(`❌ drizzle-kit generate 失败（exit ${res.status ?? res.error?.message}）`)
      return 1
    }
  }

  log('')
  log('✅ 骨架文件生成完成！')
  log('')
  log('后续手动步骤：')
  log(`  1. 按业务补充字段校验、中文表头（modules/${s.domainDir}/${s.kebab}/schema.ts）与前端页面文案（页面专属译文写在页面目录 locales/）`)
  log(`  2. 在 apps/api/scripts/seed-rbac.ts 中添加菜单（component: '${s.menuComponent}'）+ 按钮权限：`)
  log(`     ${s.permPrefix} / ${s.permPrefix}_add / _edit / _delete / _export / _import`)
  log('  3. 运行: pnpm seed:rbac -- --incremental')
  log('  4. 审查 apps/api/drizzle/ 下新生成的迁移 SQL，运行: pnpm db:migrate')
  log(`  5. 运行: psql -d <db> -c '\\d ${s.table}' 确认表已落库`)
  log(`  6. 按业务规则更新 apps/api/test/${testFilePath(s)}（生成的基础用例），补上必填 / 唯一等失败用例`)
  log(`  7. 运行: pnpm verify -- --module ${name}`)
  return 0
}

export function main(argv: string[] = process.argv.slice(2)): number {
  const { values } = parseArgs({
    args: argv.filter((a) => a !== '--'),
    options: {
      name: { type: 'string' },
      domain: { type: 'string', default: 'admin' },
      fields: { type: 'string', default: 'name:str' },
      'dry-run': { type: 'boolean', default: false },
      'skip-migration': { type: 'boolean', default: false },
      'data-scope': { type: 'boolean', default: false },
      root: { type: 'string' },
      help: { type: 'boolean', short: 'h', default: false },
    },
    strict: true,
  })
  if (values.help) {
    printUsage(import.meta.url)
    return 0
  }
  if (!values.name) {
    console.error('❌ 缺少 --name（资源名，snake_case，如 customer）')
    return 2
  }
  if (values.domain !== 'admin' && values.domain !== 'component_center') {
    console.error(`❌ --domain 只能是 admin 或 component_center（当前：${values.domain}）`)
    return 2
  }
  // Validate the name format
  if (!/^[a-z][a-z0-9_]*$/.test(values.name)) {
    console.log('❌ --name 必须是 snake_case 格式（小写字母+下划线），如 customer_order')
    return 1
  }
  return scaffold(values.name, values.domain, values.fields ?? 'name:str', {
    root: values.root,
    dryRun: values['dry-run'],
    skipMigration: values['skip-migration'],
    dataScope: values['data-scope'],
  })
}

const isMain = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href
if (isMain) {
  try {
    process.exitCode = main()
  } catch (err) {
    console.error(`❌ ${err instanceof Error ? err.message : String(err)}`)
    process.exitCode = 2
  }
}
