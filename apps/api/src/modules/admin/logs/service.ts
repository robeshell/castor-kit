/**
 * Logs module service layer
 */

import { ServiceError } from '@/common/errors'
import { pyStrOrEmpty } from '@/common/py'
import { safePayload } from '@/common/request-meta'
import { buildTable } from '@/common/tabular'
import type { Db } from '@/db/client'
import { loginLogToDict, operationLogToDict } from '@/db/schema'
import { adaptIdsForIn, dictGet, parseExportArgs, selectedIdsOrNull } from '@/common/py-values'
import { LogsRepository, type LoginLogFilters, type OperationLogFilters } from './repository'
import { LOGIN_EXPORT_FIELD_MAP, OPERATION_EXPORT_FIELD_MAP, resolveModuleAndAction } from './schema'

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

export class LogsService {
  private readonly repo: LogsRepository

  constructor(db: Db) {
    this.repo = new LogsRepository(db)
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
}
