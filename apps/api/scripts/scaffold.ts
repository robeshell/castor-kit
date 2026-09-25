/**
 * castor-kit 代码骨架生成脚本（对齐 AuraStack backend/scripts/scaffold.py）
 *
 * 用法：
 *   pnpm scaffold -- --name customer --domain admin --fields "name:str,phone:str,status:str"
 *
 *   --name            资源名（snake_case，如 customer）
 *   --domain          所属域（admin 或 component_center，默认 admin）
 *   --fields          字段列表，格式 "field:type,field:type"（默认 name:str）
 *                     支持类型：str / str20 / str50 / str500 / text / int / float / bool / date / datetime
 *   --dry-run         只打印，不写文件、不改注册文件、不生成迁移
 *   --skip-migration  不调用 drizzle-kit generate（测试用）
 *   --root            仓库根目录（默认本脚本所在仓库，测试用）
 *
 * 生成文件（已存在的文件跳过，不覆盖）：
 *   apps/api/src/db/schema/<domain>/<name>.ts                         表定义 + toDict
 *   apps/api/src/modules/<domain>/<name>/{schema,repository,service,routes}.ts
 *   apps/web/src/modules/<module>/api/<name>.js
 *   apps/web/src/modules/<module>/pages/<subdir>/<name>/index.jsx   shadcn/ui 列表页（结构同 users 页）
 * 自动注册：
 *   apps/api/src/db/schema/index.ts          export * from './<domain>/<name>'
 *   apps/api/src/modules/<domain>/router.ts  import + await register<Name>Routes(app)
 * 生成迁移：
 *   drizzle-kit generate --name <name>
 *
 * 后端目录/文件名按仓库约定用小写连字符（ck_demo → ck-demo，component_center → component-center）；
 * 表名 `<name>s`、前端路径（admin/pages/<name>、component_center/pages/admin/<name>_page）与 Python 版一致。
 */

import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import { printUsage } from './lib/usage'

const DEFAULT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')

// ─── 字段类型映射 ──────────────────────────────────────────────────────────────

export interface FieldTypeSpec {
  /** Drizzle 列构造表达式 */
  column: string
  /** 需要从 drizzle-orm/pg-core 导入的构造器 */
  builder: string
  /** schema.ts 里的归一化函数 */
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

/** Python：`FIELD_TYPE_MAP.get(ftype, FIELD_TYPE_MAP['str'])` */
export function fieldSpec(type: string): FieldTypeSpec {
  return FIELD_TYPE_MAP[type] ?? FIELD_TYPE_MAP.str!
}

export type Field = [name: string, type: string]

// ─── 命名工具 ──────────────────────────────────────────────────────────────────

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

/** Python `name.replace('_', ' ').title()`：字母跟在非字母后大写，其余小写 */
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

/** 生成到 TS 单引号字符串里 */
function q(text: string): string {
  return `'${text.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
}

/** 对象字面量的键：合法标识符直接写，否则加引号 */
function key(text: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(text) ? text : q(text)
}

// ─── 推断 ──────────────────────────────────────────────────────────────────────

export interface ScaffoldSpec {
  name: string
  domain: 'admin' | 'component_center'
  fields: Field[]
  pascal: string
  camel: string
  kebab: string
  table: string
  /** 后端目录名：admin / component-center */
  domainDir: string
  /** 前端模块目录：admin / component_center */
  webModule: string
  permPrefix: string
  menuComponent: string
  apiBase: string
  nameField: string
  exportFields: Field[]
  importFields: Field[]
}

export function buildSpec(name: string, domain: 'admin' | 'component_center', fields: Field[]): ScaffoldSpec {
  const domainPrefix = domain === 'admin' ? 'system' : 'cc'
  // 名称字段（搜索、导入必填列）：第一个 str / str50 字段；str20（编码、电话、状态）与 str500（链接）不算
  const nameField = fields.find(([, t]) => t === 'str' || t === 'str50')?.[0] ?? fields[0]?.[0] ?? 'name'
  // 导入 / 导出 / 表格列覆盖全部字段（AuraStack 只取前 3 / 前 4 个，是为了与 Python 输出逐字一致，已不需要）；
  // 必填列（name 字段）排第一，非字符串字段由 buildValues 转换，转换失败记为错误行
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
  }
}

// ─── 后端代码生成 ──────────────────────────────────────────────────────────────

export function genDbSchema(s: ScaffoldSpec): string {
  const builders = new Set(['pgTable', 'serial'])
  for (const [, t] of s.fields) builders.add(fieldSpec(t).builder)
  const columnLines = s.fields.map(([f, t]) => `  ${key(f)}: ${fieldSpec(t).column},`)
  const dictLines = s.fields.map(([f, t]) =>
    fieldSpec(t).builder === 'timestamp' ? `    ${key(f)}: toIso(item.${f}),` : `    ${key(f)}: item.${f},`,
  )
  return `/**
 * ${s.table}
 * 由 scripts/scaffold.ts 生成（name=${s.name}, domain=${s.domain}）。
 *
 * - 时间列用 createdAt()/updatedAt()（应用侧默认 \`timezone('utc', now())\`），输出统一走 toIso()
 * - numeric 列保持字符串，date 列是 'YYYY-MM-DD' 文本
 * - 改完表结构后执行 \`pnpm db:generate --name <描述>\` + \`pnpm db:migrate\`
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
  toNumeric: `/** numeric 列保持字符串（不经过 parseFloat，避免精度问题） */
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
  toDate: `/** 'YYYY-MM-DD'（也接受带时间的 ISO 字符串，取日期部分） */
function toDate(field: string, value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null
  const match = typeof value === 'string' ? /^(\\d{4}-\\d{2}-\\d{2})([ T].*)?$/.exec(value.trim()) : null
  if (!match) throw invalid(field)
  return match[1]!
}`,
  toDateTime: `/** 'YYYY-MM-DD HH:mm[:ss[.ffffff]]' 或 ISO 'T' 分隔 */
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
 * ${s.pascal} 模块 schema 层（由 scripts/scaffold.ts 生成）
 *
 * 请求体宽松：\`request.get_json() or {}\` 语义由 jsonBody() 提供，这里按字段类型归一化；
 * 值无法转换成列类型时返回 400。按业务补充必填 / 唯一性等校验。
 */

import { z } from 'zod'
${needsInvalid ? `import { ServiceError } from '@/common/errors'\n` : ''}${pyImports.length > 0 ? `import { ${pyImports.join(', ')} } from '@/common/py'\n` : ''}import type { New${s.pascal} } from '@/db/schema'

/** 请求体：loose + 全可选，归一化在 buildValues 里做 */
export const ${s.camel}BodySchema = z.record(z.string(), z.unknown()).nullish()

/** 导出字段映射（key=toDict 字段名, value=表头）；表头由 AI/开发者翻译成中文 */
export const EXPORT_FIELD_MAP: Record<string, string> = {
${exportLines.join('\n')}
}

/** 导入列头映射（key=表头, value=字段名）；第一列为必填 */
export const IMPORT_HEADER_MAP: Record<string, string> = {
${importLines.join('\n')}
}

export type ${s.pascal}Values = Partial<Omit<New${s.pascal}, 'id' | 'created_at' | 'updated_at'>>
${needsInvalid ? `\nfunction invalid(field: string): ServiceError {\n  return new ServiceError(\`字段 \${field} 的值无效\`, 400)\n}\n` : ''}
${used.map((c) => COERCERS[c]).join('\n\n')}

/**
 * 请求体 → 列值。
 * - 新增（partial=false）：所有字段都写入，缺失的为 null（Python \`Model(field=data.get(field))\`）
 * - 编辑（partial=true）：只写请求体里出现的字段（Python \`if field in data\`）
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
`
}

export function genRepository(s: ScaffoldSpec): string {
  const nameType = s.fields.find(([f]) => f === s.nameField)?.[1] ?? 'str'
  const isText = fieldSpec(nameType).coerce === 'toStr'
  const searchExpr = isText
    ? `ilike(${s.table}.${s.nameField}, \`%\${search}%\`)`
    : `ilike(sql\`\${${s.table}.${s.nameField}}::text\`, \`%\${search}%\`)`
  const ormImports = ['count', 'desc', 'eq', 'ilike', 'inArray', ...(isText ? [] : ['sql']), 'type SQL']
  return `/**
 * ${s.pascal} repository 层（由 scripts/scaffold.ts 生成）：纯数据库读写，不含业务逻辑
 */

import { ${ormImports.join(', ')} } from 'drizzle-orm'
import type { Executor } from '@/db/client'
import { ${s.table}, type ${s.pascal} } from '@/db/schema'
import type { ${s.pascal}Values } from './schema'

export class ${s.pascal}Repository {
  constructor(private readonly db: Executor) {}

  private searchWhere(search: string): SQL | undefined {
    return search ? ${searchExpr} : undefined
  }

  async listPage(page: number, perPage: number, search: string) {
    const where = this.searchWhere(search)
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

  /** 导出：ids 为 null 时导出全部；按 id 倒序 */
  async listForExport(ids: number[] | null): Promise<${s.pascal}[]> {
    return this.db
      .select()
      .from(${s.table})
      .where(ids ? inArray(${s.table}.id, ids) : undefined)
      .orderBy(desc(${s.table}.id))
  }

  async getById(id: number): Promise<${s.pascal} | null> {
    const [row] = await this.db.select().from(${s.table}).where(eq(${s.table}.id, id)).limit(1)
    return row ?? null
  }

  async insert(values: ${s.pascal}Values): Promise<${s.pascal}> {
    const [row] = await this.db.insert(${s.table}).values(values).returning()
    return row!
  }

  async update(id: number, values: ${s.pascal}Values): Promise<${s.pascal} | null> {
    const [row] = await this.db.update(${s.table}).set(values).where(eq(${s.table}.id, id)).returning()
    return row ?? null
  }

  async delete(id: number): Promise<void> {
    await this.db.delete(${s.table}).where(eq(${s.table}.id, id))
  }
}
`
}

export function genService(s: ScaffoldSpec): string {
  const nameLabel = toLabel(s.importFields[0]?.[0] ?? s.nameField)
  return `/**
 * ${s.pascal} service 层（由 scripts/scaffold.ts 生成）：业务逻辑，抛 ServiceError，不碰 HTTP 对象
 */

import { ServiceError } from '@/common/errors'
import { notFound } from '@/common/http'
import { pyTruthy } from '@/common/py'
import { buildTable, normalizeTableFileType, readTableFile, TableFileError, type UploadedFile } from '@/common/tabular'
import type { Db } from '@/db/client'
import { ${s.camel}ToDict, type ${s.pascal} } from '@/db/schema'
import { ${s.pascal}Repository } from './repository'
import { buildErrorRow, buildValues, EXPORT_FIELD_MAP, IMPORT_HEADER_MAP, type ErrorRow } from './schema'

type Data = Record<string, unknown>

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
      throw new ServiceError(err instanceof Error ? err.message : String(err), 500)
    }
  }

  async listItems(page: number, perPage: number, search: string) {
    const { total, items } = await this.repo.listPage(page, perPage, search)
    return { items: items.map(${s.camel}ToDict), total, page, per_page: perPage }
  }

  async getOr404(id: number): Promise<${s.pascal}> {
    const item = await this.repo.getById(id)
    if (!item) throw notFound()
    return item
  }

  getItem(item: ${s.pascal}) {
    return ${s.camel}ToDict(item)
  }

  async createItem(data: Data) {
    const values = buildValues(data, false)
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

  /** 导出：fields 缺省为全部导出字段；ids 为空导出全部；默认 xlsx */
  async exportItems(data: Data) {
    const fileType = normalizeTableFileType(data.file_type, 'xlsx')
    const rawFields = pyTruthy(data.fields) && Array.isArray(data.fields) ? data.fields : Object.keys(EXPORT_FIELD_MAP)
    const fields = rawFields.map((f) => String(f))
    const ids =
      pyTruthy(data.ids) && Array.isArray(data.ids) ? data.ids.filter((v): v is number => Number.isInteger(v)) : null

    const items = await this.repo.listForExport(ids)
    const headers = fields.map((f) => EXPORT_FIELD_MAP[f] ?? f)
    const rows = items.map((item) => {
      const dict: Record<string, unknown> = ${s.camel}ToDict(item)
      return fields.map((f) => (f in dict ? dict[f] : ''))
    })
    return buildTable(headers, rows, ${q(`${s.name}_export`)}, fileType)
  }

  async downloadTemplate(fileTypeRaw: unknown) {
    const fileType = normalizeTableFileType(fileTypeRaw, 'xlsx')
    return buildTable(Object.keys(IMPORT_HEADER_MAP), [], ${q(`${s.name}_import_template`)}, fileType)
  }

  /** 导入：整批一个事务，存在错误行时整体回滚并返回 400 + error_rows */
  async importItems(file: UploadedFile | null) {
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
          errors.push(buildErrorRow(line, ${q(`${nameLabel}不能为空`)}, row))
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
        await repo.insert(values)
        created += 1
      }
      if (errors.length > 0) {
        // 抛错让事务整体回滚
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
  return `/**
 * ${s.pascal} 路由（由 scripts/scaffold.ts 生成）
 *
 * 权限编码：${p}（查看 / 模板）、${p}_add、${p}_edit、${p}_delete、${p}_export、${p}_import
 * 带 id 的路由先 get_or_404（404）再做权限检查（403），与 Flask 约定一致。
 */

import type { FastifyInstance } from 'fastify'
import { hasMenuPermission, loginRequired } from '@/common/auth'
import { getUploadedFile, intParam, jsonBody, parseIntParam, queryString } from '@/common/http'
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
    return service.listItems(page, per_page, queryString(request, 'search').trim())
  })

  app.post(BASE, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, ${q(`${p}_add`)}))) {
      return reply.status(403).send({ error: '无权限新增' })
    }
    return reply.status(201).send(await service.createItem(jsonBody(request)))
  })

  app.get(itemPath, opts, async (request, reply) => {
    const item = await service.getOr404(itemId(request.params))
    if (!(await hasMenuPermission(request, ${q(p)}))) {
      return reply.status(403).send({ error: '无权限' })
    }
    return service.getItem(item)
  })

  app.put(itemPath, opts, async (request, reply) => {
    const item = await service.getOr404(itemId(request.params))
    if (!(await hasMenuPermission(request, ${q(`${p}_edit`)}))) {
      return reply.status(403).send({ error: '无权限编辑' })
    }
    return service.updateItem(item, jsonBody(request))
  })

  app.delete(itemPath, opts, async (request, reply) => {
    const item = await service.getOr404(itemId(request.params))
    if (!(await hasMenuPermission(request, ${q(`${p}_delete`)}))) {
      return reply.status(403).send({ error: '无权限删除' })
    }
    return service.deleteItem(item)
  })

  app.post(\`\${BASE}/export\`, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, ${q(`${p}_export`)}))) {
      return reply.status(403).send({ error: '无权限导出' })
    }
    return sendTable(reply, await service.exportItems(jsonBody(request)))
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
    return service.importItems(await getUploadedFile(request))
  })
}
`
}

// ─── 前端代码生成（shadcn/ui 体系，结构对齐 apps/web/src/modules/admin/pages/users/index.jsx） ──────
//
// api 文件格式与 Python scaffold.py 一致；页面按 docs/frontend-redesign-plan.md 的新体系生成：
// PageHeader + FilterBar/SearchInput + DataTable + FormDialog/FormFields + ImportDialog/ExportDialog
// + ConfirmAction + toast + useCrudList。字段 → 表单组件 / 表格列渲染见 FRONTEND_FIELD_MAP。

type FrontendKind = 'str' | 'text' | 'int' | 'float' | 'bool' | 'date' | 'datetime'

export interface FrontendFieldSpec {
  /** FormFields.jsx 里的表单组件 */
  component: 'FormInput' | 'FormTextarea' | 'FormNumber' | 'FormSwitch' | 'FormDate' | 'FormDateTime'
  /** 表单组件额外属性（JSX 片段） */
  props: string
  /** useForm 默认值（JS 字面量） */
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

/** scaffold 类型 → 前端字段类别（str20 / str50 / str500 / 未知类型都按 str） */
export function frontendKind(type: string): FrontendKind {
  return type in FRONTEND_FIELD_MAP ? (type as FrontendKind) : 'str'
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

/** 编辑时 record → 表单值（时间转成 DatePicker / DateTimePicker 的格式） */
function formValueExpr(field: string, kind: FrontendKind): string {
  const v = `record.${field}`
  if (kind === 'bool') return `Boolean(${v})`
  if (kind === 'date') return `formatDate(${v}, '')`
  if (kind === 'datetime') return `formatDateTime(${v}, '')`
  if (kind === 'int' || kind === 'float') return `${v} ?? null`
  return `${v} ?? ''`
}

/** 表格列：bool → StatusBadge，日期 → formatDate / formatDateTime，数字 → tabular-nums */
function columnLines(field: string, kind: FrontendKind): string[] {
  const head = [`    {`, `      key: ${q(field)},`, `      title: ${q(toLabel(field))},`, `      dataIndex: ${q(field)},`]
  const tail = [`    },`]
  if (kind === 'bool') {
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

  // 只导入用到的组件（web 的 eslint 开了 no-unused-vars）
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
    `            编辑`,
    `          </Button>`,
    `          <ConfirmAction title="确认删除该记录？" description="删除后不可恢复。" confirmText="删除" onConfirm={() => remove(record)}>`,
    `            <Button variant="ghost" size="sm" className="text-danger hover:text-danger h-7 px-2">`,
    `              删除`,
    `            </Button>`,
    `          </ConfirmAction>`,
    `        </div>`,
    `      ),`,
    `    },`,
  ]

  return `/**
 * ${title} 列表页（由 scripts/scaffold.ts 生成，结构同 apps/web/src/modules/admin/pages/users/index.jsx）
 *
 * PageHeader → FilterBar → DataTable（分页 / 勾选 / 行操作）→ FormDialog（react-hook-form）
 * → ImportDialog / ExportDialog。标题与字段标签是英文占位，按业务改成中文，并在 rules 里补必填校验。
 */
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { AnimatePresence, motion } from 'motion/react'
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

/** 编辑：只取表单字段（id / created_at 不回传），时间转成选择器格式 */
const toFormValues = (record) => ({
${toFormLines.join('\n')}
})

export default function ${s.pascal}Page() {
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
              导入
            </Button>
            <Button variant="outline" size="sm" onClick={() => setExportOpen(true)}>
              <Download />
              导出
            </Button>
            <Button size="sm" variant="brand" onClick={openCreate}>
              <Plus />
              新增
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
                已勾选 <span className="font-medium tabular-nums">{selectedKeys.length}</span> 条，导出时将优先导出勾选数据
              </span>
              <Button variant="ghost" size="sm" className="ml-auto h-7" onClick={() => setSelectedKeys([])}>
                <X />
                清空勾选
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
        ruleHint={selectedKeys.length ? \`已勾选 \${selectedKeys.length} 条，将只导出勾选数据。\` : '未勾选数据时导出全部数据。'}
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
          toast.success(\`导入成功：新增 \${res?.created || 0} 条\`)
          fetchData()
        }}
        errorExportFileName="${k}s_import_errors.csv"
      />
    </div>
  )
}
`
}

// ─── 自动注册 ──────────────────────────────────────────────────────────────────

/** 在 db/schema/index.ts 注册 `export * from './<domainDir>/<kebab>'`；已注册返回 null */
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

/** 在 modules/<domain>/router.ts 注册 import + `await registerXRoutes(app)`；已注册返回 null */
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

// ─── 写文件 ────────────────────────────────────────────────────────────────────

export interface ScaffoldOptions {
  root?: string
  dryRun?: boolean
  skipMigration?: boolean
  log?: (line: string) => void
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

function resolveDrizzleKit(apiDir: string): string[] {
  const local = join(apiDir, 'node_modules', '.bin', 'drizzle-kit')
  return existsSync(local) ? [local] : ['npx', 'drizzle-kit']
}

// ─── 主流程 ────────────────────────────────────────────────────────────────────

/** 解析 "name:str,phone:str20,amount:float" 格式 */
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

/** 生成全部文件；返回 0 成功 / 1 失败 */
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
  const s = buildSpec(name, domain, fields)

  const apiDir = join(root, 'apps', 'api')
  const srcDir = join(apiDir, 'src')
  const moduleDir = join(srcDir, 'modules', s.domainDir, s.kebab)
  const feBase = join(root, 'apps', 'web', 'src', 'modules', s.webModule)
  // admin 域：pages/<name>/index.jsx；component_center 域：pages/admin/<name>_page/index.jsx
  const fePagePath =
    domain === 'admin' ? join(feBase, 'pages', name, 'index.jsx') : join(feBase, 'pages', 'admin', `${name}_page`, 'index.jsx')

  log(`\n🔧 Scaffolding: ${name} (domain=${domain})`)
  log(`   Fields: [${fields.map(([f, t]) => `('${f}', '${t}')`).join(', ')}]`)
  log(`   Perm prefix: ${s.permPrefix}`)
  log(`   Menu component: ${s.menuComponent}`)
  log(`   API: ${s.apiBase}`)
  log('')

  // 后端文件
  writeFile(root, join(srcDir, 'db', 'schema', s.domainDir, `${s.kebab}.ts`), genDbSchema(s), dryRun, log)
  writeFile(root, join(moduleDir, 'schema.ts'), genModuleSchema(s), dryRun, log)
  writeFile(root, join(moduleDir, 'repository.ts'), genRepository(s), dryRun, log)
  writeFile(root, join(moduleDir, 'service.ts'), genService(s), dryRun, log)
  writeFile(root, join(moduleDir, 'routes.ts'), genRoutes(s), dryRun, log)

  // 前端文件
  writeFile(root, join(feBase, 'api', `${name}.js`), genFrontendApi(s), dryRun, log)
  writeFile(root, fePagePath, genFrontendPage(s), dryRun, log)

  // 注册
  try {
    updateFile(root, join(srcDir, 'db', 'schema', 'index.ts'), (c) => registerSchemaExport(c, s.domainDir, s.kebab), dryRun, log)
    updateFile(root, join(srcDir, 'modules', s.domainDir, 'router.ts'), (c) => registerRoute(c, s.pascal, s.kebab), dryRun, log)
  } catch (err) {
    log(`❌ ${err instanceof Error ? err.message : String(err)}`)
    return 1
  }

  // 迁移
  if (dryRun) {
    log(`  [dry-run] would run: drizzle-kit generate --name ${name}`)
  } else if (options.skipMigration) {
    log('  [skip] migration（--skip-migration）')
  } else {
    log(`  [run] drizzle-kit generate --name ${name}`)
    const [cmd, ...pre] = resolveDrizzleKit(apiDir)
    const res = spawnSync(cmd!, [...pre, 'generate', '--name', name], { cwd: apiDir, encoding: 'utf8' })
    const output = `${res.stdout ?? ''}${res.stderr ?? ''}`.trim()
    // 成功时只保留结论行（drizzle-kit 会把每张表都列一遍）；失败时原样输出
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
  log(`  1. 按业务补充字段校验、中文表头（modules/${s.domainDir}/${s.kebab}/schema.ts）与前端页面文案`)
  log(`  2. 在 apps/api/scripts/seed-rbac.ts 中添加菜单（component: '${s.menuComponent}'）+ 按钮权限：`)
  log(`     ${s.permPrefix} / ${s.permPrefix}_add / _edit / _delete / _export / _import`)
  log('  3. 运行: pnpm seed:rbac -- --incremental')
  log('  4. 审查 apps/api/drizzle/ 下新生成的迁移 SQL，运行: pnpm db:migrate')
  log(`  5. 运行: psql -d <db> -c '\\d ${s.table}' 确认表已落库`)
  log(`  6. 运行: pnpm verify -- --module ${name}`)
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
  // 校验名称格式
  if (!/^[a-z][a-z0-9_]*$/.test(values.name)) {
    console.log('❌ --name 必须是 snake_case 格式（小写字母+下划线），如 customer_order')
    return 1
  }
  return scaffold(values.name, values.domain, values.fields ?? 'name:str', {
    root: values.root,
    dryRun: values['dry-run'],
    skipMigration: values['skip-migration'],
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
