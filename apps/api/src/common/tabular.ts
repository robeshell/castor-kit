/**
 * 表格文件读写（CSV / XLSX）
 *
 * - 不支持 `.xls`：上传 .xls 返回明确 400，导出/模板 file_type=xls 按默认 csv 处理
 * - CSV 输出按 excel 方言：`\r\n` 行尾、最小引用、UTF-8 BOM
 * - 公式注入防护：以 = + @ 或制表符/回车开头，或 - 后跟非数字的单元格加 `'` 前缀
 * - 导入文件上限 5MB
 */

import ExcelJS from 'exceljs'
import { parse as parseCsv } from 'csv-parse/sync'
import type { FastifyReply } from 'fastify'

export const MAX_TABLE_FILE_BYTES = 5 * 1024 * 1024
export const SUPPORTED_TABLE_FILE_TYPES = ['csv', 'xlsx'] as const
export type TableFileType = (typeof SUPPORTED_TABLE_FILE_TYPES)[number]

const FORMULA_RE = /^[=@+\t\r]|^-(?![0-9.])/

const MIME_MAP: Record<TableFileType, string> = {
  csv: 'text/csv; charset=utf-8',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}

/** 读取/校验失败，调用方转成 400 */
export class TableFileError extends Error {}

export interface UploadedFile {
  filename: string
  data: Buffer
}

export type CellValue = string | number | boolean | null | undefined | Date

export function sanitizeFormula(value: unknown): string {
  const text = String(value)
  return FORMULA_RE.test(text) ? `'${text}` : text
}

export function normalizeTableFileType(raw: unknown, fallback: TableFileType = 'csv'): TableFileType {
  const value = String(raw ?? '')
    .trim()
    .toLowerCase()
  return (SUPPORTED_TABLE_FILE_TYPES as readonly string[]).includes(value) ? (value as TableFileType) : fallback
}

function extensionOf(filename: string | null | undefined): string | null {
  const name = String(filename ?? '')
    .trim()
    .toLowerCase()
  if (!name || !name.includes('.')) return null
  return name.slice(name.lastIndexOf('.') + 1)
}

export function inferTableFileType(filename: string | null | undefined): TableFileType | null {
  const ext = extensionOf(filename)
  return ext && (SUPPORTED_TABLE_FILE_TYPES as readonly string[]).includes(ext) ? (ext as TableFileType) : null
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** 单元格取值转文本：null→''，日期时间→'YYYY-MM-DD HH:mm:ss'，整数值浮点→整数文本，其余转字符串后去首尾空白 */
export function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) {
    return (
      `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())} ` +
      `${pad(value.getUTCHours())}:${pad(value.getUTCMinutes())}:${pad(value.getUTCSeconds())}`
    )
  }
  if (typeof value === 'boolean') return value ? 'True' : 'False'
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : String(value)
  return String(value).trim()
}

// ---------------------------------------------------------------- 读取

export interface TableReadResult {
  fieldnames: string[]
  /** [行号, 行字典]；行号从表头下一行 = 2 开始 */
  rows: [number, Record<string, string>][]
  fileType: TableFileType
}

function readCsv(content: Buffer): TableReadResult {
  let text: string
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(content)
  } catch {
    throw new TableFileError('CSV 编码错误，请使用 UTF-8 编码')
  }
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1)

  // csv.DictReader：空行直接跳过（不计行号），列数不齐的行宽松处理
  const records = parseCsv(text, {
    relax_column_count: true,
    relax_quotes: true,
    skip_empty_lines: true,
  }) as string[][]
  const [header = [], ...body] = records
  const fieldnames = header.map((h) => String(h ?? ''))

  const rows: [number, Record<string, string>][] = []
  let line = 1
  for (const record of body) {
    line += 1
    const row: Record<string, string> = {}
    fieldnames.forEach((name, i) => {
      row[name] = String(record[i] ?? '').trim()
    })
    if (!Object.values(row).some((v) => v.trim())) continue
    rows.push([line, row])
  }
  return { fieldnames, rows, fileType: 'csv' }
}

/** exceljs 单元格值 → 与 openpyxl data_only=True 读出的值等价的原始值 */
function xlsxCellRaw(value: ExcelJS.CellValue): unknown {
  if (value === null || value === undefined) return null
  if (value instanceof Date) return value
  if (typeof value !== 'object') return value
  if ('result' in value) return xlsxCellRaw((value as ExcelJS.CellFormulaValue).result as ExcelJS.CellValue)
  if ('richText' in value) return (value as ExcelJS.CellRichTextValue).richText.map((t) => t.text).join('')
  if ('text' in value) return (value as ExcelJS.CellHyperlinkValue).text
  if ('error' in value) return (value as ExcelJS.CellErrorValue).error
  return String(value)
}

async function readXlsx(content: Buffer): Promise<TableReadResult> {
  const workbook = new ExcelJS.Workbook()
  try {
    await workbook.xlsx.load(content as unknown as ArrayBuffer)
  } catch {
    throw new TableFileError('xlsx 文件解析失败，请确认文件格式')
  }
  const activeIndex = workbook.views?.[0]?.activeTab ?? 0
  const sheet = workbook.worksheets[activeIndex] ?? workbook.worksheets[0]
  if (!sheet || sheet.rowCount === 0) return { fieldnames: [], rows: [], fileType: 'xlsx' }

  const rowValues = (rowNumber: number): unknown[] => {
    const row = sheet.getRow(rowNumber)
    const values: unknown[] = []
    for (let col = 1; col <= Math.max(row.cellCount, sheet.columnCount); col += 1) {
      values.push(xlsxCellRaw(row.getCell(col).value))
    }
    return values
  }

  const headers = rowValues(1).map((v) => formatCellValue(v).trim())
  const rows: [number, Record<string, string>][] = []
  for (let r = 2; r <= sheet.rowCount; r += 1) {
    const values = rowValues(r)
    const row: Record<string, string> = {}
    let hasData = false
    headers.forEach((header, i) => {
      if (!header) return
      const text = formatCellValue(values[i])
      row[header] = text
      if (text !== '') hasData = true
    })
    if (hasData) rows.push([r, row])
  }
  return { fieldnames: headers, rows, fileType: 'xlsx' }
}

/** 读取上传的表格文件；校验失败抛 TableFileError（→ 400） */
export async function readTableFile(file: UploadedFile | null | undefined): Promise<TableReadResult> {
  if (!file) throw new TableFileError('请上传导入文件')
  if (extensionOf(file.filename) === 'xls') {
    throw new TableFileError('不支持 .xls 格式，请另存为 .xlsx 后重新上传')
  }
  const fileType = inferTableFileType(file.filename)
  if (!fileType) throw new TableFileError('仅支持 csv/xlsx 文件')
  if (file.data.length > MAX_TABLE_FILE_BYTES) throw new TableFileError('文件过大，最大支持 5MB')
  if (file.data.length === 0) throw new TableFileError('导入文件内容为空')
  return fileType === 'csv' ? readCsv(file.data) : readXlsx(file.data)
}

// ---------------------------------------------------------------- 写出

/** CSV（excel 方言，最小引用）单字段编码 */
function csvField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

function csvRow(fields: string[]): string {
  // “只有一个空字段”的行写成 ""，避免被读成空行
  if (fields.length === 1 && fields[0] === '') return '""\r\n'
  return `${fields.map(csvField).join(',')}\r\n`
}

export interface TablePayload {
  payload: Buffer
  contentType: string
  filename: string
}

export async function buildTable(
  headers: unknown[],
  rows: Iterable<unknown[]>,
  baseFilename: string,
  fileTypeRaw: unknown = 'csv',
): Promise<TablePayload> {
  const fileType = normalizeTableFileType(fileTypeRaw)
  const safeHeaders = headers.map(sanitizeFormula)
  const safeRows = [...rows].map((row) => (row ?? []).map((v) => sanitizeFormula(formatCellValue(v))))

  let payload: Buffer
  if (fileType === 'csv') {
    const text = [safeHeaders, ...safeRows].map(csvRow).join('')
    payload = Buffer.from(`﻿${text}`, 'utf8')
  } else {
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('Sheet')
    // 空字符串单元格不写 <c> 元素：exceljs 写 '' 会生成空字符串单元格，这里转成 null
    const blankToNull = (row: string[]) => row.map((v) => (v === '' ? null : v))
    sheet.addRow(blankToNull(safeHeaders))
    for (const row of safeRows) sheet.addRow(blankToNull(row))
    payload = Buffer.from(await workbook.xlsx.writeBuffer())
  }
  return { payload, contentType: MIME_MAP[fileType], filename: `${baseFilename}.${fileType}` }
}

/** 发送表格文件（设置 Content-Type / 下载文件名并写出内容） */
export function sendTable(reply: FastifyReply, table: TablePayload): FastifyReply {
  return reply
    .header('Content-Type', table.contentType)
    .header('Content-Disposition', `attachment; filename=${table.filename}`)
    .send(table.payload)
}
