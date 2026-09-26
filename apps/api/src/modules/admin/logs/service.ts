/**
 * Logs module service layer
 */

import { ServiceError } from '@/common/errors'
import { pyStrOrEmpty } from '@/common/py'
import { safePayload } from '@/common/request-meta'
import { buildTable, readTableFile, TableFileError, type TableReadResult, type UploadedFile } from '@/common/tabular'
import type { Db } from '@/db/client'
import { utcNow } from '@/db/schema/columns'
import { loginLogToDict, operationLogToDict } from '@/db/schema'
import { adaptIdsForIn, dictGet, internalError, parseExportArgs, selectedIdsOrNull } from '@/common/py-values'
import { importedTimestamp, LogsRepository, type LoginLogFilters, type OperationLogFilters } from './repository'
import {
  buildErrorRow,
  formatNaive,
  LOGIN_EXPORT_FIELD_MAP,
  LOGIN_IMPORT_HEADER_MAP,
  LOGIN_TEMPLATE_HEADERS,
  LOGIN_TEMPLATE_ROWS,
  OPERATION_EXPORT_FIELD_MAP,
  OPERATION_IMPORT_HEADER_MAP,
  OPERATION_TEMPLATE_HEADERS,
  OPERATION_TEMPLATE_ROWS,
  parseDatetime,
  parseIntOr,
  resolveModuleAndAction,
  type ErrorRow,
} from './schema'

export interface OperationContext {
  method: string
  path: string
  username: string | undefined
  /** Equivalent of request.get_json(silent=True): null for non-JSON requests */
  jsonBody: unknown
  ip: string
  userAgent: string
  statusCode: number
  /** The API token the request authenticated with, if any */
  apiTokenId?: number | null
}

type Data = Record<string, unknown>

const RECORDED_METHODS = new Set(['POST', 'PUT', 'DELETE'])
const FAILED_STATUSES = new Set(['failed', 'fail', '失败'])

/** `parse_datetime(raw, default=utcnow()) or utcnow()` → value to write to the DB */
function importedCreatedAt(raw: unknown) {
  const parsed = parseDatetime(raw)
  if (parsed === 'default' || parsed === null) return utcNow()
  return importedTimestamp(formatNaive(parsed), parsed.offsetMicros)
}

export class LogsService {
  private readonly repo: LogsRepository

  constructor(private readonly db: Db) {
    this.repo = new LogsRepository(db)
  }

  private async inTx<T>(fn: (repo: LogsRepository) => Promise<T>): Promise<T> {
    try {
      return await this.db.transaction((tx) => fn(new LogsRepository(tx)))
    } catch (err) {
      if (err instanceof ServiceError) throw err
      throw internalError(err instanceof Error ? err.message : String(err))
    }
  }

  async recordOperationFromRequest(ctx: OperationContext): Promise<void> {
    if (!RECORDED_METHODS.has(ctx.method)) return
    if (!ctx.path.startsWith('/api/admin/')) return
    if (ctx.path.startsWith('/api/admin/logs')) return
    if (ctx.path === '/api/admin/login') return
    if (!ctx.username) return

    const userId = await this.repo.getAdminIdByUsername(ctx.username)
    if (userId === null) return

    const { module, action } = resolveModuleAndAction(ctx.path, ctx.method)
    const segments = ctx.path.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean)
    const last = segments.at(-1)
    const targetId = last !== undefined && /^\d+$/.test(last) ? last : null

    await this.repo.addOperationLog({
      username: ctx.username,
      user_id: userId,
      module,
      action,
      method: ctx.method,
      path: ctx.path,
      target_id: targetId,
      payload: safePayload(ctx.jsonBody),
      ip: ctx.ip,
      user_agent: ctx.userAgent,
      status_code: ctx.statusCode,
      api_token_id: ctx.apiTokenId ?? null,
    })
  }

  async listLoginLogs(page: number, perPage: number, filters: LoginLogFilters) {
    const { total, items } = await this.repo.listLoginLogsPage(page, perPage, filters)
    return { items: items.map(loginLogToDict), total, page, per_page: perPage }
  }

  async listOperationLogs(page: number, perPage: number, filters: OperationLogFilters) {
    const { total, items } = await this.repo.listOperationLogsPage(page, perPage, filters)
    return { items: items.map(operationLogToDict), total, page, per_page: perPage }
  }

  async exportLoginLogs(data: Data) {
    const args = parseExportArgs(data, LOGIN_EXPORT_FIELD_MAP)
    let items
    if (args.exportMode === 'filtered') {
      items = await this.repo.listLoginLogsFiltered({
        username: pyStrOrEmpty(dictGet(args.filters, 'username')),
        status: pyStrOrEmpty(dictGet(args.filters, 'status')),
      })
    } else {
      const ids = selectedIdsOrNull(args.ids)
      if (!ids) throw new ServiceError('请先勾选要导出的日志数据', 400)
      items = await this.repo.listLoginLogsByIds(adaptIdsForIn(ids))
    }
    const headers = args.validFields.map((f) => LOGIN_EXPORT_FIELD_MAP[f]![0])
    const rows = items.map((item) => args.validFields.map((f) => LOGIN_EXPORT_FIELD_MAP[f]![1](item)))
    return buildTable(headers, rows, 'login_logs_export', args.fileType)
  }

  async exportOperationLogs(data: Data) {
    const args = parseExportArgs(data, OPERATION_EXPORT_FIELD_MAP)
    let items
    if (args.exportMode === 'filtered') {
      items = await this.repo.listOperationLogsFiltered({
        username: pyStrOrEmpty(dictGet(args.filters, 'username')),
        module: pyStrOrEmpty(dictGet(args.filters, 'module')),
        action: pyStrOrEmpty(dictGet(args.filters, 'action')),
      })
    } else {
      const ids = selectedIdsOrNull(args.ids)
      if (!ids) throw new ServiceError('请先勾选要导出的日志数据', 400)
      items = await this.repo.listOperationLogsByIds(adaptIdsForIn(ids))
    }
    const headers = args.validFields.map((f) => OPERATION_EXPORT_FIELD_MAP[f]![0])
    const rows = items.map((item) => args.validFields.map((f) => OPERATION_EXPORT_FIELD_MAP[f]![1](item)))
    return buildTable(headers, rows, 'operation_logs_export', args.fileType)
  }

  async downloadLoginTemplate(fileTypeRaw: unknown) {
    return buildTable(LOGIN_TEMPLATE_HEADERS, LOGIN_TEMPLATE_ROWS, 'login_logs_import_template', fileTypeRaw)
  }

  async downloadOperationTemplate(fileTypeRaw: unknown) {
    return buildTable(OPERATION_TEMPLATE_HEADERS, OPERATION_TEMPLATE_ROWS, 'operation_logs_import_template', fileTypeRaw)
  }

  private async readImportTable(file: UploadedFile | null): Promise<TableReadResult> {
    if (!file) throw new ServiceError('请上传导入文件', 400)
    let table: TableReadResult
    try {
      table = await readTableFile(file)
    } catch (err) {
      if (err instanceof TableFileError) throw new ServiceError(err.message, 400)
      throw err
    }
    if (table.fieldnames.length === 0) throw new ServiceError('导入内容为空', 400)
    return table
  }

  private static headerMap(fieldnames: string[], importMap: Record<string, string>): Map<string, string> {
    const map = new Map<string, string>()
    for (const header of fieldnames) {
      const key = (header ?? '').trim()
      if (Object.hasOwn(importMap, key)) map.set(header, importMap[key]!)
    }
    return map
  }

  private static mapRow(row: Record<string, string>, headerMap: Map<string, string>): Record<string, string> {
    const mapped: Record<string, string> = {}
    for (const [key, value] of Object.entries(row)) {
      const field = headerMap.get(key)
      if (field) mapped[field] = value
    }
    return mapped
  }

  private static failIfErrors(errors: ErrorRow[]): void {
    if (errors.length > 0) {
      // Throw so the whole transaction rolls back
      throw new ServiceError('导入失败，存在错误数据', 400, {
        error_rows: errors.slice(0, 500),
        error_count: errors.length,
      })
    }
  }

  async importLoginLogs(file: UploadedFile | null) {
    const table = await this.readImportTable(file)
    const headerMap = LogsService.headerMap(table.fieldnames, LOGIN_IMPORT_HEADER_MAP)
    if (![...headerMap.values()].includes('username')) throw new ServiceError('导入文件缺少“用户名”列', 400)

    return this.inTx(async (repo) => {
      let created = 0
      const errors: ErrorRow[] = []
      for (const [line, row] of table.rows) {
        const mapped = LogsService.mapRow(row, headerMap)
        const username = pyStrOrEmpty(mapped.username)
        if (!username) {
          errors.push(buildErrorRow(line, '用户名不能为空', row))
          continue
        }
        const rawStatus = pyStrOrEmpty(mapped.status).toLowerCase()
        await repo.addLoginLog({
          username,
          user_id: await repo.getAdminIdByUsername(username),
          status: FAILED_STATUSES.has(rawStatus) ? 'failed' : 'success',
          ip: pyStrOrEmpty(mapped.ip) || null,
          user_agent: pyStrOrEmpty(mapped.user_agent) || null,
          message: pyStrOrEmpty(mapped.message) || null,
          created_at: importedCreatedAt(mapped.created_at),
        })
        created += 1
      }
      LogsService.failIfErrors(errors)
      return { message: '导入成功', created, updated: 0 }
    })
  }

  async importOperationLogs(file: UploadedFile | null) {
    const table = await this.readImportTable(file)
    const headerMap = LogsService.headerMap(table.fieldnames, OPERATION_IMPORT_HEADER_MAP)
    const mappedFields = [...headerMap.values()]
    for (const required of ['username', 'module', 'action', 'method', 'path']) {
      if (!mappedFields.includes(required)) throw new ServiceError(`导入文件缺少必填列: ${required}`, 400)
    }

    return this.inTx(async (repo) => {
      let created = 0
      const errors: ErrorRow[] = []
      for (const [line, row] of table.rows) {
        const mapped = LogsService.mapRow(row, headerMap)
        const username = pyStrOrEmpty(mapped.username)
        const module = pyStrOrEmpty(mapped.module)
        const action = pyStrOrEmpty(mapped.action)
        const method = pyStrOrEmpty(mapped.method).toUpperCase()
        const path = pyStrOrEmpty(mapped.path)
        if (!username || !module || !action || !method || !path) {
          errors.push(buildErrorRow(line, '必填字段不能为空', row))
          continue
        }
        await repo.addOperationLog({
          username,
          user_id: await repo.getAdminIdByUsername(username),
          module,
          action,
          method,
          path,
          target_id: pyStrOrEmpty(mapped.target_id) || null,
          payload: pyStrOrEmpty(mapped.payload) || null,
          ip: pyStrOrEmpty(mapped.ip) || null,
          user_agent: pyStrOrEmpty(mapped.user_agent) || null,
          status_code: parseIntOr(mapped.status_code, 200),
          created_at: importedCreatedAt(mapped.created_at),
        })
        created += 1
      }
      LogsService.failIfErrors(errors)
      return { message: '导入成功', created, updated: 0 }
    })
  }
}
