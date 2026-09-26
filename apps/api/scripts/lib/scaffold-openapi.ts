/**
 * OpenAPI entries for a scaffolded module — written into docs/apifox-full.openapi.json by `pnpm scaffold`, so a new
 * module passes the document check (scripts/lib/openapi-lint.ts, AGENTS.md "OpenAPI 编写规范") without hand-written docs.
 *
 * The entries describe exactly what genRoutes / genService / genModuleSchema generate: the eight routes, their
 * permission codes, the field types and rules from the spec (required, unique, default, options, dictionary), the
 * toDict response shape and the status codes. When the generated code is changed by hand, update the entries too.
 */

import type { FieldMeta, ScaffoldSpec } from '../scaffold'
import { expectedSecurity } from './openapi-lint'
import { dumpIndented, parseOrderedJson, toOrdered, type OrderedJson } from './ordered-json'

type Schema = Record<string, unknown>
type Operation = Record<string, unknown>

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
const BINARY = { type: 'string', format: 'binary' }

/** Request / response schema per scaffold field type (keys match FIELD_TYPE_MAP in scaffold.ts) */
export const FIELD_OPENAPI: Record<string, { request: Schema; response: Schema; note?: string }> = {
  str: { request: { type: ['string', 'null'], maxLength: 100 }, response: { type: ['string', 'null'] } },
  str50: { request: { type: ['string', 'null'], maxLength: 50 }, response: { type: ['string', 'null'] } },
  str20: { request: { type: ['string', 'null'], maxLength: 20 }, response: { type: ['string', 'null'] } },
  str500: { request: { type: ['string', 'null'], maxLength: 500 }, response: { type: ['string', 'null'] } },
  text: { request: { type: ['string', 'null'] }, response: { type: ['string', 'null'] } },
  int: { request: { type: ['integer', 'string', 'null'] }, response: { type: ['integer', 'null'] }, note: '整数（也接受数字字符串）' },
  float: {
    request: { type: ['number', 'string', 'null'] },
    response: { type: ['string', 'null'] },
    note: '数值（最多 2 位小数），响应中以字符串返回以免丢失精度',
  },
  bool: { request: { type: ['boolean', 'string', 'null'] }, response: { type: ['boolean', 'null'] }, note: '布尔值（也接受 1 / 0、是 / 否）' },
  date: { request: { type: ['string', 'null'], format: 'date' }, response: { type: ['string', 'null'], format: 'date' }, note: 'YYYY-MM-DD' },
  datetime: {
    request: { type: ['string', 'null'] },
    response: { type: ['string', 'null'] },
    note: 'YYYY-MM-DD HH:mm:ss（UTC）；响应为 ISO 格式',
  },
  file: { request: { type: ['string', 'null'] }, response: { type: ['string', 'null'] }, note: '文件中心的文件 ID（也可传 /api/admin/files/<id> 地址）' },
  image: { request: { type: ['string', 'null'] }, response: { type: ['string', 'null'] }, note: '文件中心的图片文件 ID（也可传 /api/admin/files/<id> 地址）' },
  enum: { request: { type: ['string', 'null'] }, response: { type: ['string', 'null'] } },
  dict: { request: { type: ['string', 'null'], maxLength: 100 }, response: { type: ['string', 'null'] } },
}

function fieldDescription(label: string, type: string, meta: FieldMeta, forRequest: boolean): string {
  const parts = [label]
  const note = FIELD_OPENAPI[type]?.note
  if (note) parts.push(note)
  if (type === 'enum' && meta.options?.length) parts.push(`可选值：${meta.options.map((o) => `${o.value}=${o.label}`).join('，')}`)
  if (type === 'dict' && meta.dict) parts.push(`数据字典「${meta.dict}」的字典项值（可选值见 GET /api/admin/dicts/options?codes=${meta.dict}）`)
  if (forRequest) {
    if (meta.required) parts.push('必填')
    if (meta.unique) parts.push('唯一')
    if (meta.default !== undefined && meta.default !== null && meta.default !== '') parts.push(`新增时缺省为 ${String(meta.default)}`)
  }
  return parts.join('；')
}

function fieldSchema(s: ScaffoldSpec, label: (field: string) => string, field: string, type: string, forRequest: boolean): Schema {
  const meta = s.meta[field] ?? {}
  const base = FIELD_OPENAPI[type] ?? FIELD_OPENAPI.str!
  const schema: Schema = { ...(forRequest ? base.request : base.response) }
  if (type === 'enum' && meta.options?.length) schema.enum = [...meta.options.map((o) => o.value), null]
  if (forRequest && meta.default !== undefined && meta.default !== null && meta.default !== '') schema.default = meta.default
  schema.description = fieldDescription(label(field), type, meta, forRequest)
  return schema
}

/** The record returned by the module's routes (xxxToDict) */
function itemSchema(s: ScaffoldSpec, label: (field: string) => string): Schema {
  const properties: Record<string, Schema> = { id: { type: 'integer' } }
  for (const [field, type] of s.fields) properties[field] = fieldSchema(s, label, field, type, false)
  if (s.dataScope) {
    properties.dept_id = { type: ['integer', 'null'], description: '所属部门（数据权限）' }
    properties.created_by = { type: ['integer', 'null'], description: '创建人用户 ID（数据权限）' }
  }
  properties.created_at = { type: ['string', 'null'], description: '创建时间（UTC，ISO 格式）' }
  properties.updated_at = { type: ['string', 'null'], description: '更新时间（UTC，ISO 格式）' }
  return { type: 'object', properties }
}

function bodySchema(s: ScaffoldSpec, label: (field: string) => string, create: boolean): Schema {
  const properties: Record<string, Schema> = {}
  for (const [field, type] of s.fields) properties[field] = fieldSchema(s, label, field, type, true)
  const required = s.fields.filter(([f]) => s.meta[f]?.required).map(([f]) => f)
  return { type: 'object', properties, ...(create && required.length ? { required } : {}) }
}

const json = (schema: Schema) => ({ 'application/json': { schema } })
const table = { 'text/csv': { schema: BINARY }, [XLSX]: { schema: BINARY } }
const errors = (...codes: Array<[string, string]>) => Object.fromEntries(codes.map(([code, description]) => [code, { description }]))

/**
 * Summary text: parts joined with a space where Chinese meets Latin letters, so an English title (a module scaffolded
 * without a Chinese one) reads 「新增 Ck Device」 / 「Ck Device 列表」 rather than being glued to the Chinese
 */
function phrase(...parts: string[]): string {
  return parts.reduce((out, part) => {
    if (!out || !part) return out + part
    const edge = `${out.at(-1)}${part[0]}`
    return /[\u3400-\u9fff][A-Za-z0-9]|[A-Za-z0-9][\u3400-\u9fff]/.test(edge) ? `${out} ${part}` : out + part
  }, '')
}

/** Routes genRoutes registers for a module: OpenAPI path → methods */
export function scaffoldRoutes(s: ScaffoldSpec): Map<string, string[]> {
  const item = `${s.apiBase}/{item_id}`
  return new Map([
    [s.apiBase, ['GET', 'POST']],
    [item, ['DELETE', 'GET', 'PUT']],
    [`${s.apiBase}/export`, ['POST']],
    [`${s.apiBase}/template`, ['GET']],
    [`${s.apiBase}/import`, ['POST']],
  ])
}

/** Tag and Apifox folder of a scaffolded module */
export function scaffoldTag(s: ScaffoldSpec): { name: string; folder: string } {
  return s.domain === 'admin'
    ? { name: `后台-${s.title}`, folder: `后台/业务管理/${s.title}` }
    : { name: `示例-${s.title}`, folder: `后台/组件示例中心/${s.title}` }
}

/** Path → method → operation for a scaffolded module */
export function scaffoldOperations(s: ScaffoldSpec, label: (field: string) => string): Record<string, Record<string, Operation>> {
  const p = s.permPrefix
  const t = s.title
  const tag = scaffoldTag(s)
  const item = itemSchema(s, label)
  const itemPath = `${s.apiBase}/{item_id}`
  const idParam = { name: 'item_id', in: 'path', required: true, schema: { type: 'integer' }, description: `${t} ID` }
  const fileType = {
    name: 'file_type',
    in: 'query',
    schema: { type: 'string', enum: ['csv', 'xlsx'], default: 'xlsx' },
    description: '文件格式，缺省或其他值按 xlsx',
  }
  const scope = s.dataScope ? '按数据权限过滤，范围外的记录视同不存在（404）。' : ''
  const lookup = `先查记录（不存在${s.dataScope ? '或不在数据权限范围内' : ''}返回 404）再查权限（403）。`
  const invalid = '唯一字段重复、值超长或类型不对返回 400。'
  const importLabels = s.importFields.map(([f]) => label(f))
  const op = (method: string, path: string, body: Operation): Operation => ({
    tags: [tag.name],
    ...body,
    'x-apifox-folder': tag.folder,
    security: expectedSecurity(method, path),
  })

  return {
    [s.apiBase]: {
      get: op('get', s.apiBase, {
        summary: phrase(t, '列表'),
        description: `需要 ${p}。search 按「${label(s.nameField)}」模糊搜索，按 ID 倒序分页。${scope}`,
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 }, description: '页码' },
          { name: 'per_page', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 200, default: 20 }, description: '每页条数，最多 200' },
          { name: 'search', in: 'query', schema: { type: 'string' }, description: `按「${label(s.nameField)}」模糊搜索` },
        ],
        responses: {
          '200': {
            description: '成功',
            content: json({
              type: 'object',
              properties: { items: { type: 'array', items: item }, total: { type: 'integer' }, page: { type: 'integer' }, per_page: { type: 'integer' } },
            }),
          },
          ...errors(['401', '未登录'], ['403', '无权限']),
        },
      }),
      post: op('post', s.apiBase, {
        summary: phrase('新增', t),
        description: `需要 ${p}_add。${invalid}${s.dataScope ? '新记录记下创建人和其所在部门。' : ''}成功后触发 ${s.name}.created 事件。`,
        requestBody: { required: true, content: json(bodySchema(s, label, true)) },
        responses: {
          '201': { description: '已创建', content: json(item) },
          ...errors(['400', '请求参数错误（必填字段为空、值无效、唯一字段重复等）'], ['401', '未登录'], ['403', '无权限']),
        },
      }),
    },
    [itemPath]: {
      get: op('get', itemPath, {
        summary: phrase(t, '详情'),
        description: `需要 ${p}。${lookup}`,
        parameters: [idParam],
        responses: { '200': { description: '成功', content: json(item) }, ...errors(['401', '未登录'], ['403', '无权限'], ['404', '记录不存在']) },
      }),
      put: op('put', itemPath, {
        summary: phrase('编辑', t),
        description: `需要 ${p}_edit。${lookup}只修改请求体中出现的字段，必填字段不能清空；${invalid}成功后触发 ${s.name}.updated 事件。`,
        parameters: [idParam],
        requestBody: { required: true, content: json(bodySchema(s, label, false)) },
        responses: {
          '200': { description: '成功', content: json(item) },
          ...errors(['400', '请求参数错误'], ['401', '未登录'], ['403', '无权限'], ['404', '记录不存在']),
        },
      }),
      delete: op('delete', itemPath, {
        summary: phrase('删除', t),
        description: `需要 ${p}_delete。${lookup}成功后触发 ${s.name}.deleted 事件。`,
        parameters: [idParam],
        responses: {
          '200': { description: '已删除', content: json({ type: 'object', properties: { message: { type: 'string' } } }) },
          ...errors(['401', '未登录'], ['403', '无权限'], ['404', '记录不存在']),
        },
      }),
    },
    [`${s.apiBase}/export`]: {
      post: op('post', `${s.apiBase}/export`, {
        summary: phrase('导出', t),
        description: `需要 ${p}_export。ids 为空时导出全部${s.dataScope ? '（数据权限范围内）' : ''}，按 ID 倒序；fields 缺省时导出所有列，枚举字段导出为选项名称。`,
        requestBody: {
          required: true,
          content: json({
            type: 'object',
            properties: {
              ids: { type: 'array', items: { type: 'integer' }, description: '要导出的记录 ID，为空导出全部' },
              fields: {
                type: 'array',
                items: { type: 'string', enum: ['id', ...s.exportFields.map(([f]) => f), 'created_at'] },
                description: '导出列，缺省导出所有列',
              },
              file_type: { type: 'string', enum: ['csv', 'xlsx'], default: 'xlsx', description: '文件格式，缺省或其他值按 xlsx' },
            },
          }),
        },
        responses: {
          '200': { description: `文件内容（${s.name}_export.xlsx / .csv）`, content: table },
          ...errors(['401', '未登录'], ['403', '无权限']),
        },
      }),
    },
    [`${s.apiBase}/template`]: {
      get: op('get', `${s.apiBase}/template`, {
        summary: phrase('下载', t, '导入模板'),
        description: `需要 ${p}_import。只含表头：${importLabels.join('、')}（第一列必填）。`,
        parameters: [fileType],
        responses: {
          '200': { description: `模板文件（${s.name}_import_template.xlsx / .csv）`, content: table },
          ...errors(['401', '未登录'], ['403', '无权限']),
        },
      }),
    },
    [`${s.apiBase}/import`]: {
      post: op('post', `${s.apiBase}/import`, {
        summary: phrase('导入', t),
        description:
          `需要 ${p}_import。表头按模板（第一列「${importLabels[0]}」必填，固定选项列可填名称），只新增不更新；` +
          '任一行出错整批回滚，400 响应带 error_rows（最多 500 条）和 error_count。',
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: { type: 'object', properties: { file: { ...BINARY, description: 'csv / xlsx 文件' } }, required: ['file'] },
            },
          },
        },
        responses: {
          '200': {
            description: '导入成功',
            content: json({
              type: 'object',
              properties: { message: { type: 'string' }, created: { type: 'integer', description: '新增条数' }, updated: { type: 'integer', description: '固定为 0' } },
            }),
          },
          ...errors(['400', '文件不合法或存在错误数据（响应含 error_rows、error_count）'], ['401', '未登录'], ['403', '无权限'], ['413', '文件过大']),
        },
      }),
    },
  }
}

/**
 * The document with the module's entries written in and its tag declared; paths stay sorted and the canonical format
 * is kept, so `pnpm openapi:generate` afterwards changes nothing. Like the generated code files, a module that is
 * already documented is left alone (the text comes back unchanged): a re-run with other fields must not describe
 * code that wasn't regenerated.
 */
export function applyScaffoldOpenApi(docText: string, s: ScaffoldSpec, label: (field: string) => string): string {
  const doc = parseOrderedJson(docText)
  if (!(doc instanceof Map)) throw new Error('OpenAPI 文档根节点必须是对象')
  const existing = doc.get('paths')
  if (existing instanceof Map && existing.has(s.apiBase)) return docText
  const tag = scaffoldTag(s)
  const tags = Array.isArray(doc.get('tags')) ? (doc.get('tags') as OrderedJson[]) : []
  if (!tags.some((t) => t instanceof Map && t.get('name') === tag.name)) {
    tags.push(toOrdered({ name: tag.name, description: `${s.title}：增删改查与导入导出（scripts/scaffold.ts 生成）` }))
  }
  doc.set('tags', tags)
  const paths = doc.get('paths') instanceof Map ? (doc.get('paths') as Map<string, OrderedJson>) : new Map<string, OrderedJson>()
  for (const [path, ops] of Object.entries(scaffoldOperations(s, label))) paths.set(path, toOrdered(ops))
  doc.set('paths', new Map([...paths].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))))
  return dumpIndented(doc)
}
