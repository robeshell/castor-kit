/**
 * 列表页 schema 层（对齐 AuraStack backend/app/component_center/schema/list_page.py）
 *
 * 另含 service 里用到的 Python 语义小工具（secure_filename / str.title / json.dumps(indent=2)），
 * 只服务本模块，不要合并到 common。
 */

import { z } from 'zod'
import { pyInt, PyValueError, pyStr } from '@/common/py'
import { formatDateTime } from '@/common/serialize'
import type { QueryManagement } from '@/db/schema'

/** 移植期请求体：loose + 全可选，归一化在 service 里做 */
export const listPageBodySchema = z.record(z.string(), z.unknown()).nullish()

function exportUrlList(raw: string | null, single: string | null): string {
  let urls: string[] = []
  if (raw) {
    try {
      const parsed: unknown = JSON.parse(raw)
      if (Array.isArray(parsed)) urls = parsed.map((v) => pyStr(v).trim()).filter(Boolean)
    } catch {
      urls = []
    }
  }
  if (urls.length === 0 && single) urls = [single]
  return urls.join(',')
}

export function exportImageUrls(item: QueryManagement): string {
  return exportUrlList(item.image_urls, item.image_url)
}

export function exportFileUrls(item: QueryManagement): string {
  return exportUrlList(item.file_urls, item.file_url)
}

export const EXPORT_FIELD_MAP: Record<string, [string, (item: QueryManagement) => unknown]> = {
  id: ['ID', (item) => item.id],
  name: ['名称', (item) => item.name],
  query_code: ['编码', (item) => item.query_code],
  category: ['分类', (item) => item.category || ''],
  keyword: ['关键字', (item) => item.keyword || ''],
  data_source: ['数据源', (item) => item.data_source || ''],
  owner: ['负责人', (item) => item.owner || ''],
  image_url: ['图片URL', (item) => item.image_url || ''],
  image_urls: ['图片URL列表', exportImageUrls],
  file_url: ['文件URL', (item) => item.file_url || ''],
  file_urls: ['文件URL列表', exportFileUrls],
  priority: ['优先级', (item) => (item.priority !== null ? item.priority : 0)],
  is_active: ['状态', (item) => (item.is_active ? '启用' : '停用')],
  status: ['发布状态', (item) => item.status || 'draft'],
  condition_logic: ['条件逻辑', (item) => item.condition_logic || 'AND'],
  conditions_json: ['条件配置JSON', (item) => item.conditions_json || ''],
  display_config: ['展示配置JSON', (item) => item.display_config || ''],
  permission_config: ['权限配置JSON', (item) => item.permission_config || ''],
  schema_config: ['Schema配置', (item) => item.schema_config || ''],
  version: ['版本号', (item) => (item.version !== null ? item.version : 1)],
  published_at: ['发布时间', (item) => formatDateTime(item.published_at)],
  description: ['描述', (item) => item.description || ''],
  created_at: ['创建时间', (item) => formatDateTime(item.created_at)],
  updated_at: ['更新时间', (item) => formatDateTime(item.updated_at)],
}

export const IMPORT_HEADER_MAP: Record<string, string> = {
  名称: 'name',
  编码: 'query_code',
  分类: 'category',
  查询名称: 'name',
  查询编码: 'query_code',
  查询分类: 'category',
  关键字: 'keyword',
  数据源: 'data_source',
  负责人: 'owner',
  图片URL列表: 'image_urls',
  图片URL: 'image_url',
  图片: 'image_url',
  文件URL列表: 'file_urls',
  文件URL: 'file_url',
  文件: 'file_url',
  优先级: 'priority',
  状态: 'is_active',
  描述: 'description',
  name: 'name',
  query_code: 'query_code',
  category: 'category',
  keyword: 'keyword',
  data_source: 'data_source',
  owner: 'owner',
  image_urls: 'image_urls',
  image_url: 'image_url',
  file_urls: 'file_urls',
  file_url: 'file_url',
  priority: 'priority',
  is_active: 'is_active',
  发布状态: 'status',
  status: 'status',
  description: 'description',
}

const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on', '是', '启用'])
const FALSE_VALUES = new Set(['0', 'false', 'no', 'off', '否', '停用'])

/** Python parse_bool(value, default=None) */
export function parseBool<D>(value: unknown, defaultValue: D): boolean | D {
  if (value === null || value === undefined || value === '') return defaultValue
  if (typeof value === 'boolean') return value
  const raw = pyStr(value).trim().toLowerCase()
  if (TRUE_VALUES.has(raw)) return true
  if (FALSE_VALUES.has(raw)) return false
  return defaultValue
}

/** Python parse_int(value, default=0)：`int(value)`，TypeError/ValueError → default */
export function parseIntOr<D>(value: unknown, defaultValue: D): number | D {
  try {
    return pyInt(value)
  } catch (err) {
    if (err instanceof PyValueError) return defaultValue
    throw err
  }
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

// ---------------------------------------------------------------- Python 语义小工具

/** 等价 werkzeug.utils.secure_filename（POSIX：os.sep='/'，无 altsep，不做 Windows 设备名处理） */
export function secureFilename(filename: string): string {
  let name = filename.normalize('NFKD').replace(/[^\x00-\x7f]/g, '')
  name = name.replace(/\//g, ' ')
  // str.split()：按 ASCII 空白切分（非 ASCII 已在上一步去掉）
  name = name
    .split(/[ \t\n\r\x0b\x0c\x1c\x1d\x1e\x1f]+/)
    .filter(Boolean)
    .join('_')
  name = name.replace(/[^A-Za-z0-9_.-]/g, '')
  return name.replace(/^[._]+/, '').replace(/[._]+$/, '')
}

/** titlecase 与 uppercase 不同的字符（Python str.title 用 titlecase 映射） */
const TITLECASE_MAP: Record<string, string> = {
  Ǆ: 'ǅ', ǅ: 'ǅ', ǆ: 'ǅ', Ǉ: 'ǈ', ǈ: 'ǈ', ǉ: 'ǈ', Ǌ: 'ǋ', ǋ: 'ǋ', ǌ: 'ǋ', Ǳ: 'ǲ', ǲ: 'ǲ', ǳ: 'ǲ',
  ß: 'Ss', ﬀ: 'Ff', ﬁ: 'Fi', ﬂ: 'Fl', ﬃ: 'Ffi', ﬄ: 'Ffl', ﬅ: 'St', ﬆ: 'St',
}

function isCased(ch: string): boolean {
  return ch.toLowerCase() !== ch.toUpperCase()
}

/** 等价 Python `str.title()`：前一个字符不是“有大小写”的字符时大写，否则小写（数字也算分隔） */
export function pyTitle(text: string): string {
  let out = ''
  let previousCased = false
  for (const ch of text) {
    const converted = previousCased ? ch.toLowerCase() : (TITLECASE_MAP[ch] ?? ch.toUpperCase())
    out += converted
    previousCased = isCased(ch)
  }
  return out
}

/** `json.dumps(value, ensure_ascii=False, indent=2)`（仅 dict 调用；键分隔 ': '，项分隔 ','，与 JSON.stringify 缩进格式一致） */
export function pyJsonDumpsIndent2(value: Record<string, unknown>): string {
  return JSON.stringify(value, null, 2)
}
