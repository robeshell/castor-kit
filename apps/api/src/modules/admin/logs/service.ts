/**
 * Logs module service layer
 */

import { ServiceError } from '@/common/errors'
import { safePayload } from '@/common/request-meta'
import { buildTable } from '@/common/tabular'
import type { Db } from '@/db/client'
import { loginLogToDict, operationLogToDict } from '@/db/schema'
import { exportColumns } from '@/common/validation'
import type { z } from 'zod'
import { LogsRepository, type LoginLogFilters, type OperationLogFilters } from './repository'
import {
  LOGIN_EXPORT_FIELD_MAP,
  OPERATION_EXPORT_FIELD_MAP,
  resolveModuleAndAction,
  type loginLogExportBody,
  type operationLogExportBody,
} from './schema'

export interface OperationContext {
  method: string
  path: string
  username: string | undefined
  /** The JSON request body; null for non-JSON requests */
  jsonBody: unknown
  ip: string
  userAgent: string
  statusCode: number
  /** The API token the request authenticated with, if any */
  apiTokenId?: number | null
}


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

  async exportLoginLogs(options: z.output<typeof loginLogExportBody>) {
    const validFields = exportColumns(options.fields, LOGIN_EXPORT_FIELD_MAP)
    let items
    if (options.export_mode !== 'selected') {
      const { username, status } = options.filters
      items = await this.repo.listLoginLogsFiltered({ username: username ?? '', status: status ?? '' })
    } else {
      if (options.ids.length === 0) throw new ServiceError('请先勾选要导出的日志数据', 400)
      items = await this.repo.listLoginLogsByIds(options.ids)
    }
    const headers = validFields.map((f) => LOGIN_EXPORT_FIELD_MAP[f]![0])
    const rows = items.map((item) => validFields.map((f) => LOGIN_EXPORT_FIELD_MAP[f]![1](item)))
    return buildTable(headers, rows, 'login_logs_export', options.file_type)
  }

  async exportOperationLogs(options: z.output<typeof operationLogExportBody>) {
    const validFields = exportColumns(options.fields, OPERATION_EXPORT_FIELD_MAP)
    let items
    if (options.export_mode !== 'selected') {
      const { username, module, action } = options.filters
      items = await this.repo.listOperationLogsFiltered({ username: username ?? '', module: module ?? '', action: action ?? '' })
    } else {
      if (options.ids.length === 0) throw new ServiceError('请先勾选要导出的日志数据', 400)
      items = await this.repo.listOperationLogsByIds(options.ids)
    }
    const headers = validFields.map((f) => OPERATION_EXPORT_FIELD_MAP[f]![0])
    const rows = items.map((item) => validFields.map((f) => OPERATION_EXPORT_FIELD_MAP[f]![1](item)))
    return buildTable(headers, rows, 'operation_logs_export', options.file_type)
  }
}
