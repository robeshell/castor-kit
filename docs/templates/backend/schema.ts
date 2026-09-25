/**
 * schema 层模板 → apps/api/src/modules/<domain>/<resource>/schema.ts
 *
 * TODO: 替换 <Resource> 为类型名（大驼峰，如 Customer）
 * TODO: 替换 <resource> 为资源名（下划线，如 customer）
 *
 * 职责：请求体归一化、导入导出字段映射。不做数据库操作。
 * 请求体宽松：`request.get_json() or {}` 语义由 common/http 的 jsonBody() 提供，
 * 这里按字段类型把 unknown 归一化成列值；值无法转换时抛 ServiceError(400)。
 */

import { z } from 'zod'
import { ServiceError } from '@/common/errors'
import { pyStr } from '@/common/py'
import type { <Resource>, New<Resource> } from '@/db/schema'

/** 请求体：loose + 全可选（驱动 OpenAPI），归一化在 buildValues 里做 */
export const <resource>BodySchema = z.record(z.string(), z.unknown()).nullish()

/**
 * 导出列：表头字符串（值取 toDict 的同名字段），或 [表头, 取值函数]（需要转换时用，如枚举显示中文、布尔显示是/否）。
 * 字段校验报错也用这里的表头作为字段名。
 */
export type ExportColumn = string | [header: string, value: (item: <Resource>) => unknown]

export const EXPORT_FIELD_MAP: Record<string, ExportColumn> = {
  id: 'ID',
  name: '名称',
  // TODO: 补充其他字段，如 status: ['状态', (item) => STATUS_LABELS[item.status ?? ''] ?? item.status]
  created_at: '创建时间',
}

/** 字段的中文名（取导出表头；没有导出列时退回字段名） */
export function fieldLabel(field: string): string {
  const column = EXPORT_FIELD_MAP[field]
  return Array.isArray(column) ? column[0] : (column ?? field)
}

/** 导入列头映射（key=中文表头, value=字段名）；第一列为必填 */
export const IMPORT_HEADER_MAP: Record<string, string> = {
  名称: 'name',
  // TODO: 补充其他可导入字段
}

export type <Resource>Values = Partial<Omit<New<Resource>, 'id' | 'created_at' | 'updated_at'>>

function invalid(field: string): ServiceError {
  return new ServiceError(`${fieldLabel(field)}的值无效`, 400)
}

function toStr(value: unknown): string | null {
  return value === null || value === undefined ? null : pyStr(value)
}

/** 示例：整数字段（按整数解析），空值为 null */
export function toInt(field: string, value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number' && Number.isInteger(value)) return value
  if (typeof value === 'string' && /^[+-]?\d+$/.test(value.trim())) return Number.parseInt(value.trim(), 10)
  throw invalid(field)
}

/**
 * 请求体 → 列值。
 * - 新增（partial=false）：所有字段都写入，缺失的为 null
 * - 编辑（partial=true）：只写请求体里出现的字段（`'x' in data`）
 */
export function buildValues(data: Record<string, unknown>, partial: boolean): <Resource>Values {
  const values: <Resource>Values = {}
  if (!partial || Object.hasOwn(data, 'name')) values.name = toStr(data.name) ?? ''
  // TODO: 补充其他字段，如
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
