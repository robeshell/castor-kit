/**
 * 列表页 service 层
 *
 * - Text 列里存的 JSON 字符串一律按 `json.dumps(ensure_ascii=False)` 的格式写入（分隔符带空格、非 ASCII 原样保留；导出时原样输出）
 * - 每次写操作（含版本快照）放在一个事务里，一个请求只提交一次
 * - 上传文件写入 `${instanceDir}/uploads/list_page{,_files}`
 */

import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ServiceError } from '@/common/errors'
import { notFound } from '@/common/http'
import { isPlainObject, pyStr, pyStrOrEmpty, pyTruthy } from '@/common/py'
import { pyJsonDumps } from '@/common/request-meta'
import { formatDateTime, utcNowIso } from '@/common/serialize'
import { buildTable, normalizeTableFileType, readTableFile, TableFileError, type UploadedFile } from '@/common/tabular'
import type { Db } from '@/db/client'
import {
  queryManagementToDict,
  queryManagementVersionToDict,
  type QueryManagement,
  type QueryManagementVersion,
} from '@/db/schema'
import { utcNow } from '@/db/schema/columns'
import { ListPageRepository, type ListPageFilters, type QueryManagementUpdate } from './repository'
import {
  buildErrorRow,
  EXPORT_FIELD_MAP,
  IMPORT_HEADER_MAP,
  parseBool,
  parseIntOr,
  pyJsonDumpsIndent2,
  pyTitle,
  secureFilename,
  type ErrorRow,
} from './schema'

type Data = Record<string, unknown>

export const ALLOWED_IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp'])
export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024
export const ALLOWED_FILE_EXTENSIONS = new Set([
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'txt', 'md',
  'zip', 'rar', '7z', 'json', 'ppt', 'pptx',
])
export const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024
const STATUS_VALUES = new Set(['draft', 'published'])
const LOGIC_VALUES = new Set(['AND', 'OR'])
const EMPTY_CONDITIONS = () => ({ groups: [] as unknown[], items: [] as unknown[] })
const PG_INT_MAX = 2_147_483_647

const hasOwn = (obj: object, key: string) => Object.prototype.hasOwnProperty.call(obj, key)

// ---------------------------------------------------------------- 归一化

/** service 版 parse_json_object：None → default；dict 原样；str → strip 后解析，非对象/解析失败 → default；其他 → default */
export function parseJsonObject(raw: unknown, defaultValue: Data): Data {
  if (raw === null || raw === undefined) return defaultValue
  if (isPlainObject(raw)) return raw
  if (typeof raw === 'string') {
    const text = raw.trim()
    if (!text) return defaultValue
    try {
      const parsed: unknown = JSON.parse(text)
      if (isPlainObject(parsed)) return parsed
    } catch {
      return defaultValue
    }
  }
  return defaultValue
}

export function serializeJsonObject(value: unknown, defaultValue: Data | null = null): string | null {
  if (value === null || value === undefined) {
    if (defaultValue === null) return null
    return pyJsonDumps(defaultValue)
  }
  if (isPlainObject(value)) return pyJsonDumps(value)
  if (typeof value === 'string') {
    const text = value.trim()
    if (!text) return null
    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      throw new ServiceError('JSON 配置格式错误', 400)
    }
    if (!isPlainObject(parsed)) throw new ServiceError('JSON 配置必须是对象', 400)
    return pyJsonDumps(parsed)
  }
  throw new ServiceError('JSON 配置格式错误', 400)
}

export function parseSchemaConfig(raw: unknown): string {
  if (raw === null || raw === undefined) return ''
  if (typeof raw === 'string') return raw.trim()
  if (isPlainObject(raw)) return pyJsonDumpsIndent2(raw)
  return pyStr(raw).trim()
}

/** normalize_status：注意是 `str(value)` 而不是 `str(value or '')`（0 → '0' → 400） */
export function normalizeStatus(value: unknown, defaultValue = 'draft'): string {
  if (value === null || value === undefined) return defaultValue
  const raw = pyStr(value).trim().toLowerCase()
  if (!raw) return defaultValue
  if (!STATUS_VALUES.has(raw)) throw new ServiceError('状态仅支持 draft/published', 400)
  return raw
}

function strListItems(values: unknown[]): string[] {
  return values.map((v) => pyStr(v).trim()).filter(Boolean)
}

export function normalizeImageUrls(raw: unknown): string[] {
  if (raw === null || raw === undefined) return []
  if (Array.isArray(raw)) return strListItems(raw)
  if (typeof raw === 'string') {
    const text = raw.trim()
    if (!text) return []
    try {
      const parsed: unknown = JSON.parse(text)
      if (Array.isArray(parsed)) return strListItems(parsed)
    } catch {
      /* 非 JSON，按分隔符拆 */
    }
    if (['\n', ',', '，', ';', '；'].some((sep) => text.includes(sep))) {
      const normalized = text.replace(/，/g, ',').replace(/；/g, ';').replace(/\n/g, ';')
      const chunks: string[] = []
      for (const segment of normalized.split(';')) chunks.push(...segment.split(','))
      return chunks.map((c) => c.trim()).filter(Boolean)
    }
    return [text]
  }
  return []
}

export const normalizeFileUrls = normalizeImageUrls

export function serializeUrlList(urls: string[]): string | null {
  return urls.length > 0 ? pyJsonDumps(urls) : null
}

function normalizeLogic(value: unknown): string {
  const logic = pyStr(pyTruthy(value) ? value : 'AND').trim().toUpperCase()
  return LOGIC_VALUES.has(logic) ? logic : 'AND'
}

export function normalizeConditions(rawConditions: unknown): { groups: Data[]; items: Data[] } {
  let raw = rawConditions
  if (raw === null || raw === undefined) return { groups: [], items: [] }
  if (typeof raw === 'string') {
    const text = raw.trim()
    if (!text) return { groups: [], items: [] }
    try {
      raw = JSON.parse(text)
    } catch {
      throw new ServiceError('条件配置 JSON 格式错误', 400)
    }
  }
  if (!isPlainObject(raw)) throw new ServiceError('条件配置必须是对象', 400)

  const groups = Array.isArray(raw.groups) ? raw.groups : []
  const items = Array.isArray(raw.items) ? raw.items : []

  const normalizedItems: Data[] = []
  for (const item of items) {
    if (!isPlainObject(item)) continue
    const field = pyStrOrEmpty(item.field)
    const operator = pyStrOrEmpty(item.operator)
    const value = item.value
    const logic = normalizeLogic(item.logic)
    if (!field || !operator) continue
    normalizedItems.push({ field, operator, value: value === null || value === undefined ? '' : value, logic })
  }

  const normalizedGroups: Data[] = []
  for (const group of groups) {
    if (!isPlainObject(group)) continue
    const name = pyStrOrEmpty(group.name) || `分组${normalizedGroups.length + 1}`
    const logic = normalizeLogic(group.logic)
    normalizedGroups.push({ name, logic })
  }

  return { groups: normalizedGroups, items: normalizedItems }
}

/** `str(x or '').strip() or None` */
function optionalText(value: unknown): string | null {
  return pyStrOrEmpty(value) || null
}

/** `str(x or 'general').strip() or 'general'` */
function categoryText(value: unknown): string {
  return pyStr(pyTruthy(value) ? value : 'general').trim() || 'general'
}

function operatorText(data: Data): string {
  return pyStr(pyTruthy(data.operator) ? data.operator : 'system').trim() || 'system'
}

/** 展开导出的 fields：list → 元素，str 按字符，dict 按键；不可迭代 → 500（元素为 list/dict 时由调用方返回 500） */
function pyIterate(value: unknown): unknown[] {
  if (Array.isArray(value)) return value
  if (typeof value === 'string') return [...value]
  if (isPlainObject(value)) return Object.keys(value)
  throw new ServiceError('object is not iterable', 500)
}

function validExportFields(fields: unknown): string[] {
  const valid: string[] = []
  for (const field of pyIterate(fields)) {
    if (field !== null && typeof field === 'object') throw new ServiceError('unhashable type', 500)
    if (typeof field === 'string' && hasOwn(EXPORT_FIELD_MAP, field)) valid.push(field)
  }
  return valid.length > 0 ? valid : Object.keys(EXPORT_FIELD_MAP)
}

/** `QueryManagement.id.in_(ids)` 的 PostgreSQL 语义：整数匹配、数字字符串被转换、其他类型报错（→ 500） */
function coerceIdsForIn(ids: unknown[]): number[] {
  const result: number[] = []
  for (const id of ids) {
    if (id === null || id === undefined) continue
    if (typeof id === 'number') {
      if (Number.isInteger(id) && Math.abs(id) <= PG_INT_MAX) result.push(id)
      continue
    }
    if (typeof id === 'string' && /^\s*[+-]?\d+\s*$/.test(id)) {
      const n = Number.parseInt(id.trim(), 10)
      if (Math.abs(n) > PG_INT_MAX) throw new ServiceError('value out of range for type integer', 500)
      result.push(n)
      continue
    }
    throw new ServiceError('invalid input for integer id', 500)
  }
  return result
}

function filtersFrom(source: Data): ListPageFilters {
  return {
    search: pyStrOrEmpty(source.search),
    category: pyStrOrEmpty(source.category),
    owner: pyStrOrEmpty(source.owner),
    isActive: parseBool(source.is_active, null),
    status: pyStrOrEmpty(source.status),
  }
}

function buildSnapshot(item: QueryManagement): string {
  const { created_at: _c, updated_at: _u, ...payload } = queryManagementToDict(item)
  return pyJsonDumps(payload)
}

// ---------------------------------------------------------------- service

export class ListPageService {
  private readonly repo: ListPageRepository

  constructor(
    private readonly db: Db,
    private readonly instanceDir: string,
  ) {
    this.repo = new ListPageRepository(db)
  }

  // ---- 上传目录 / 文件名

  async getImageUploadDir(): Promise<string> {
    const dir = join(this.instanceDir, 'uploads', 'list_page')
    await mkdir(dir, { recursive: true })
    return dir
  }

  async getFileUploadDir(): Promise<string> {
    const dir = join(this.instanceDir, 'uploads', 'list_page_files')
    await mkdir(dir, { recursive: true })
    return dir
  }

  static sanitizeImageFilename(filename: unknown): string {
    const safeName = secureFilename(pyStrOrEmpty(filename))
    if (!safeName) throw new ServiceError('无效的图片文件名', 400)
    return safeName
  }

  private static extractImageExt(filename: string): string {
    const safeName = ListPageService.sanitizeImageFilename(filename)
    if (!safeName.includes('.')) throw new ServiceError('仅支持 jpg/png/gif/webp 图片', 400)
    const ext = safeName.slice(safeName.lastIndexOf('.') + 1).toLowerCase()
    if (!ALLOWED_IMAGE_EXTENSIONS.has(ext)) throw new ServiceError('仅支持 jpg/png/gif/webp 图片', 400)
    return ext
  }

  private async inTx<T>(fn: (repo: ListPageRepository) => Promise<T>): Promise<T> {
    try {
      return await this.db.transaction((tx) => fn(new ListPageRepository(tx)))
    } catch (err) {
      if (err instanceof ServiceError) throw err
      throw new ServiceError(err instanceof Error ? err.message : String(err), 500)
    }
  }

  private async saveVersionSnapshot(repo: ListPageRepository, item: QueryManagement, action: string, operator: string) {
    await repo.insertVersion({
      query_management_id: item.id,
      version_no: item.version || 1,
      action,
      operator,
      snapshot_json: buildSnapshot(item),
    })
  }

  async saveImage(file: UploadedFile | null) {
    if (!file) throw new ServiceError('请先选择图片文件', 400)
    const ext = ListPageService.extractImageExt(file.filename)
    const size = file.data.length
    if (size <= 0) throw new ServiceError('图片文件不能为空', 400)
    if (size > MAX_IMAGE_SIZE_BYTES) throw new ServiceError('图片不能超过 5MB', 400)

    const finalName = `${randomUUID().replace(/-/g, '')}.${ext}`
    try {
      await writeFile(join(await this.getImageUploadDir(), finalName), file.data)
    } catch (err) {
      throw new ServiceError(err instanceof Error ? err.message : String(err), 500)
    }
    return {
      message: '上传成功',
      filename: finalName,
      url: `/api/admin/component-center/list-page/image/${finalName}`,
    }
  }

  async saveFile(file: UploadedFile | null) {
    if (!file) throw new ServiceError('请先选择文件', 400)
    const safeName = ListPageService.sanitizeImageFilename(file.filename)
    if (!safeName.includes('.')) throw new ServiceError('无效的文件类型', 400)
    const ext = safeName.slice(safeName.lastIndexOf('.') + 1).toLowerCase()
    if (!ALLOWED_FILE_EXTENSIONS.has(ext)) throw new ServiceError('仅支持常见文档/压缩包格式', 400)
    const size = file.data.length
    if (size <= 0) throw new ServiceError('文件不能为空', 400)
    if (size > MAX_FILE_SIZE_BYTES) throw new ServiceError('文件不能超过 20MB', 400)

    const finalName = `${randomUUID().replace(/-/g, '')}_${safeName}`
    try {
      await writeFile(join(await this.getFileUploadDir(), finalName), file.data)
    } catch (err) {
      throw new ServiceError(err instanceof Error ? err.message : String(err), 500)
    }
    return {
      message: '上传成功',
      filename: finalName,
      url: `/api/admin/component-center/list-page/file/${finalName}`,
    }
  }

  // ---- CRUD

  async getOr404(id: number): Promise<QueryManagement> {
    const item = await this.repo.getById(id)
    if (!item) throw notFound()
    return item
  }

  async getVersionOr404(id: number): Promise<QueryManagementVersion> {
    const version = await this.repo.getVersionById(id)
    if (!version) throw notFound()
    return version
  }

  toDict(item: QueryManagement) {
    return queryManagementToDict(item)
  }

  async listItems(page: number, perPage: number, query: Data) {
    const { total, items } = await this.repo.listPage(filtersFrom(query), page, perPage)
    return { items: items.map(queryManagementToDict), total, page, per_page: perPage }
  }

  async createItem(data: Data) {
    const name = pyStrOrEmpty(data.name)
    const queryCode = pyStrOrEmpty(data.query_code)
    if (!name) throw new ServiceError('查询名称不能为空', 400)
    if (!queryCode) throw new ServiceError('查询编码不能为空', 400)
    if (await this.repo.getByCode(queryCode)) throw new ServiceError('查询编码已存在', 400)

    const status = normalizeStatus(data.status, 'draft')
    const conditionLogic = normalizeLogic(data.condition_logic)
    const conditions = normalizeConditions(data.conditions)

    let imageUrls = normalizeImageUrls(data.image_urls)
    if (imageUrls.length === 0) imageUrls = normalizeImageUrls(data.image_url)
    let fileUrls = normalizeFileUrls(data.file_urls)
    if (fileUrls.length === 0) fileUrls = normalizeFileUrls(data.file_url)

    const values = {
      name,
      query_code: queryCode,
      category: categoryText(data.category),
      keyword: optionalText(data.keyword),
      data_source: optionalText(data.data_source),
      owner: optionalText(data.owner),
      image_url: imageUrls[0] ?? null,
      image_urls: serializeUrlList(imageUrls),
      file_url: fileUrls[0] ?? null,
      file_urls: serializeUrlList(fileUrls),
      priority: parseIntOr(data.priority, 0),
      is_active: parseBool(data.is_active, true),
      status,
      condition_logic: conditionLogic,
      conditions_json: serializeJsonObject(conditions, EMPTY_CONDITIONS()),
      display_config: serializeJsonObject(parseJsonObject(data.display_config, {}), {}),
      permission_config: serializeJsonObject(parseJsonObject(data.permission_config, {}), {}),
      schema_config: parseSchemaConfig(data.schema_config),
      version: 1,
      published_at: status === 'published' ? utcNow() : null,
      description: optionalText(data.description),
    }
    const operator = operatorText(data)

    const item = await this.inTx(async (repo) => {
      const created = await repo.insert(values)
      await this.saveVersionSnapshot(repo, created, 'create', operator)
      return created
    })
    return queryManagementToDict(item)
  }

  async updateItem(item: QueryManagement, data: Data) {
    if ('name' in data && !pyStrOrEmpty(data.name)) throw new ServiceError('查询名称不能为空', 400)

    if ('query_code' in data) {
      const nextCode = pyStrOrEmpty(data.query_code)
      if (!nextCode) throw new ServiceError('查询编码不能为空', 400)
      if (await this.repo.findDuplicateCode(nextCode, item.id)) throw new ServiceError('查询编码已存在', 400)
    }

    const set: QueryManagementUpdate = {}
    const updateMap: Record<string, (val: unknown) => unknown> = {
      name: (val) => pyStrOrEmpty(val),
      query_code: (val) => pyStrOrEmpty(val),
      category: (val) => pyStrOrEmpty(val) || 'general',
      keyword: optionalText,
      data_source: optionalText,
      owner: optionalText,
      priority: (val) => parseIntOr(val, item.priority || 0),
      is_active: (val) => parseBool(val, item.is_active),
      description: optionalText,
    }
    for (const [field, converter] of Object.entries(updateMap)) {
      if (field in data) (set as Record<string, unknown>)[field] = converter(data[field])
    }

    if ('status' in data) {
      const status = normalizeStatus(data.status, item.status || 'draft')
      set.status = status
      if (status === 'published' && !item.published_at) set.published_at = utcNow()
    }

    if ('condition_logic' in data) set.condition_logic = normalizeLogic(data.condition_logic)

    if ('conditions' in data) {
      set.conditions_json = serializeJsonObject(normalizeConditions(data.conditions), EMPTY_CONDITIONS())
    }
    if ('display_config' in data) {
      set.display_config = serializeJsonObject(parseJsonObject(data.display_config, {}), {})
    }
    if ('permission_config' in data) {
      set.permission_config = serializeJsonObject(parseJsonObject(data.permission_config, {}), {})
    }
    if ('schema_config' in data) set.schema_config = parseSchemaConfig(data.schema_config)

    if ('image_urls' in data || 'image_url' in data) {
      let imageUrls = normalizeImageUrls(data.image_urls)
      if (imageUrls.length === 0) imageUrls = normalizeImageUrls(data.image_url)
      set.image_urls = serializeUrlList(imageUrls)
      set.image_url = imageUrls[0] ?? null
    }
    if ('file_urls' in data || 'file_url' in data) {
      let fileUrls = normalizeFileUrls(data.file_urls)
      if (fileUrls.length === 0) fileUrls = normalizeFileUrls(data.file_url)
      set.file_urls = serializeUrlList(fileUrls)
      set.file_url = fileUrls[0] ?? null
    }

    set.version = (item.version || 1) + 1
    const operator = operatorText(data)

    const updated = await this.inTx(async (repo) => {
      const row = await repo.update(item.id, set)
      await this.saveVersionSnapshot(repo, row, 'update', operator)
      return row
    })
    return queryManagementToDict(updated)
  }

  async deleteItem(item: QueryManagement) {
    await this.inTx((repo) => repo.delete(item.id))
    return { message: '删除成功' }
  }

  // ---- 预览 / 版本

  runPreview(data: Data) {
    const displayConfig = parseJsonObject(data.display_config, {})
    const conditions = normalizeConditions(data.conditions)

    let selectedFields = displayConfig.selected_fields
    if (!Array.isArray(selectedFields) || selectedFields.length === 0) {
      selectedFields = ['id', 'name', 'status', 'owner', 'updated_at']
    }

    let rowCount = parseIntOr(displayConfig.preview_rows, 8)
    rowCount = Math.max(1, Math.min(rowCount, 50))

    let columns: { title: string; dataIndex: string }[] = []
    for (const field of selectedFields as unknown[]) {
      const key = pyStrOrEmpty(field)
      if (!key) continue
      columns.push({ title: pyTitle(key.replace(/_/g, ' ')), dataIndex: key })
    }
    if (columns.length === 0) {
      columns = [
        { title: 'Id', dataIndex: 'id' },
        { title: 'Name', dataIndex: 'name' },
      ]
    }

    const rows: Data[] = []
    for (let index = 0; index < rowCount; index += 1) {
      const row: Data = {}
      for (const col of columns) {
        const key = col.dataIndex
        if (key === 'id' || key === 'priority') row[key] = index + 1
        else if (key === 'is_active') row[key] = index % 2 === 0
        else if (key === 'updated_at' || key === 'created_at') row[key] = formatDateTime(utcNowIso())
        else if (key === 'status') row[key] = index % 2 === 0 ? 'published' : 'draft'
        else row[key] = `${key}_sample_${index + 1}`
      }
      rows.push(row)
    }

    const conditionCount = conditions.items.length
    return {
      message: '执行成功',
      elapsed_ms: 35 + columns.length * 6 + conditionCount * 11,
      columns,
      rows,
      total: rowCount,
      condition_count: conditionCount,
    }
  }

  async listVersions(item: QueryManagement, page: number, perPage: number) {
    const { total, items } = await this.repo.listVersionsPage(item.id, page, perPage)
    return { items: items.map(queryManagementVersionToDict), total, page, per_page: perPage }
  }

  async rollbackVersion(item: QueryManagement, versionItem: QueryManagementVersion, operator: string) {
    if (versionItem.query_management_id !== item.id) throw new ServiceError('版本不属于当前记录', 400)

    const snapshot = parseJsonObject(versionItem.snapshot_json, {})
    if (Object.keys(snapshot).length === 0) throw new ServiceError('版本快照无效', 400)

    const targetCode = pyStr(pyTruthy(snapshot.query_code) ? snapshot.query_code : item.query_code).trim()
    if (await this.repo.findDuplicateCode(targetCode, item.id)) throw new ServiceError('回滚后查询编码冲突', 400)

    const status = normalizeStatus(snapshot.status, 'draft')
    const set: QueryManagementUpdate = {
      name: pyStr(pyTruthy(snapshot.name) ? snapshot.name : item.name).trim(),
      query_code: targetCode,
      category: categoryText(snapshot.category),
      keyword: optionalText(snapshot.keyword),
      data_source: optionalText(snapshot.data_source),
      owner: optionalText(snapshot.owner),
      image_url: optionalText(snapshot.image_url),
      image_urls: serializeUrlList(normalizeImageUrls(snapshot.image_urls)),
      file_url: optionalText(snapshot.file_url),
      file_urls: serializeUrlList(normalizeFileUrls(snapshot.file_urls)),
      priority: parseIntOr(snapshot.priority, 0),
      is_active: parseBool(snapshot.is_active, true),
      status,
      condition_logic: normalizeLogic(snapshot.condition_logic),
      conditions_json: serializeJsonObject(normalizeConditions(snapshot.conditions), EMPTY_CONDITIONS()),
      display_config: serializeJsonObject(parseJsonObject(snapshot.display_config, {}), {}),
      permission_config: serializeJsonObject(parseJsonObject(snapshot.permission_config, {}), {}),
      schema_config: parseSchemaConfig(snapshot.schema_config),
      description: optionalText(snapshot.description),
      published_at: status === 'published' ? utcNow() : null,
      version: (item.version || 1) + 1,
    }

    const updated = await this.inTx(async (repo) => {
      const row = await repo.update(item.id, set)
      await this.saveVersionSnapshot(repo, row, 'rollback', operator)
      return row
    })
    return queryManagementToDict(updated)
  }

  // ---- 导入导出

  /** GET：data 为 query 参数（首值）；POST：JSON 请求体 */
  async exportItems(data: Data, requestMethod: 'GET' | 'POST') {
    let ids: unknown
    let fields: unknown
    let exportMode: string
    let filters: unknown
    if (requestMethod === 'GET') {
      ids = []
      const rawFields = pyStrOrEmpty(data.fields)
      fields = rawFields
        ? rawFields
            .split(',')
            .map((f) => f.trim())
            .filter(Boolean)
        : []
      exportMode = 'filtered'
      filters = {
        search: data.search,
        category: data.category,
        owner: data.owner,
        is_active: data.is_active,
        status: data.status,
      }
    } else {
      ids = pyTruthy(data.ids) ? data.ids : []
      fields = pyTruthy(data.fields) ? data.fields : []
      exportMode = pyStr(pyTruthy(data.export_mode) ? data.export_mode : 'selected').trim()
      filters = pyTruthy(data.filters) ? data.filters : {}
    }
    const fileType = normalizeTableFileType(data.file_type, 'csv')

    const validFields = validExportFields(fields)

    let items: QueryManagement[]
    if (exportMode === 'filtered') {
      if (!isPlainObject(filters)) throw new ServiceError("'filters' has no attribute 'get'", 500)
      items = await this.repo.listFiltered(filtersFrom(filters))
    } else {
      if (!Array.isArray(ids) || ids.length === 0) throw new ServiceError('请先勾选要导出的查询数据', 400)
      items = await this.repo.listByIds(coerceIdsForIn(ids))
    }

    const headers = validFields.map((f) => EXPORT_FIELD_MAP[f]![0])
    const rows = items.map((item) => validFields.map((f) => EXPORT_FIELD_MAP[f]![1](item)))
    return buildTable(headers, rows, 'list_page_export', fileType)
  }

  async downloadTemplate(fileTypeRaw: unknown) {
    const fileType = normalizeTableFileType(fileTypeRaw, 'csv')
    const headers = [
      '查询名称', '查询编码', '查询分类', '关键字', '数据源', '负责人',
      '图片URL列表', '文件URL列表', '优先级', '状态', '发布状态', '描述',
    ]
    const rows = [[
      '订单主查询',
      'order_main_query',
      'order',
      '订单,时间范围',
      'orders',
      'admin',
      'https://example.com/1.png,https://example.com/2.png',
      'https://example.com/a.pdf,https://example.com/b.xlsx',
      10,
      '启用',
      'draft',
      '查询模板示例',
    ]]
    return buildTable(headers, rows, 'list_page_import_template', fileType)
  }

  async importItems(file: UploadedFile | null) {
    if (!file) throw new ServiceError('请上传导入文件', 400)
    let table
    try {
      table = await readTableFile(file)
    } catch (err) {
      if (err instanceof TableFileError) throw new ServiceError(err.message, 400)
      throw err
    }
    if (table.fieldnames.length === 0) throw new ServiceError('导入内容为空', 400)

    const headerMap = new Map<string, string>()
    for (const header of table.fieldnames) {
      const key = (header ?? '').trim()
      if (hasOwn(IMPORT_HEADER_MAP, key)) headerMap.set(header, IMPORT_HEADER_MAP[key]!)
    }
    const mappedFields = new Set(headerMap.values())
    if (!mappedFields.has('name') || !mappedFields.has('query_code')) {
      throw new ServiceError('导入文件缺少“查询名称/查询编码”列', 400)
    }

    return this.inTx(async (repo) => {
      let created = 0
      let updated = 0
      const errors: ErrorRow[] = []

      for (const [line, row] of table.rows) {
        const mapped: Record<string, string> = {}
        for (const [key, value] of Object.entries(row)) {
          const field = headerMap.get(key)
          if (field) mapped[field] = value
        }

        const name = pyStrOrEmpty(mapped.name)
        const queryCode = pyStrOrEmpty(mapped.query_code)
        const category = categoryText(mapped.category)
        const keyword = optionalText(mapped.keyword)
        const dataSource = optionalText(mapped.data_source)
        const owner = optionalText(mapped.owner)
        let imageUrls = normalizeImageUrls(mapped.image_urls)
        if (imageUrls.length === 0) imageUrls = normalizeImageUrls(mapped.image_url)
        let fileUrls = normalizeFileUrls(mapped.file_urls)
        if (fileUrls.length === 0) fileUrls = normalizeFileUrls(mapped.file_url)
        const priority = parseIntOr(mapped.priority, 0)
        const isActive = parseBool(mapped.is_active, true)
        // 非法发布状态直接中断整个导入（不计入 error_rows）
        const status = normalizeStatus(mapped.status, 'draft')
        const description = optionalText(mapped.description)

        if (!name || !queryCode) {
          errors.push(buildErrorRow(line, '查询名称和查询编码不能为空', row))
          continue
        }

        const existing = await repo.getByCode(queryCode)
        if (existing) {
          const row2 = await repo.update(existing.id, {
            name,
            category,
            keyword,
            data_source: dataSource,
            owner,
            image_urls: serializeUrlList(imageUrls),
            image_url: imageUrls[0] ?? null,
            file_urls: serializeUrlList(fileUrls),
            file_url: fileUrls[0] ?? null,
            priority,
            is_active: isActive,
            status,
            description,
            version: (existing.version || 1) + 1,
            ...(status === 'published' && !existing.published_at ? { published_at: utcNow() } : {}),
          })
          await this.saveVersionSnapshot(repo, row2, 'import_update', 'import')
          updated += 1
        } else {
          const createdRow = await repo.insert({
            name,
            query_code: queryCode,
            category,
            keyword,
            data_source: dataSource,
            owner,
            image_url: imageUrls[0] ?? null,
            image_urls: serializeUrlList(imageUrls),
            file_url: fileUrls[0] ?? null,
            file_urls: serializeUrlList(fileUrls),
            priority,
            is_active: isActive,
            status,
            condition_logic: 'AND',
            conditions_json: serializeJsonObject(EMPTY_CONDITIONS(), EMPTY_CONDITIONS()),
            display_config: serializeJsonObject({}, {}),
            permission_config: serializeJsonObject({}, {}),
            schema_config: '',
            version: 1,
            published_at: status === 'published' ? utcNow() : null,
            description,
          })
          await this.saveVersionSnapshot(repo, createdRow, 'import_create', 'import')
          created += 1
        }
      }

      if (errors.length > 0) {
        // 抛错让事务整体回滚
        throw new ServiceError('导入失败，存在错误数据', 400, {
          error_rows: errors.slice(0, 500),
          error_count: errors.length,
        })
      }
      return { message: '导入成功', created, updated }
    })
  }
}
