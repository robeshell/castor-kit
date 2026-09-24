/**
 * 日志模块路由（对齐 AuraStack backend/app/admin/api/logs.py）
 *
 * 操作日志是**集中式**写入：全局 onResponse hook 按路径/方法推断 module/action 后落库，
 * 异常吞掉不影响响应。不要在各 service 里散写操作日志。
 */

import type { FastifyInstance } from 'fastify'
import { hasMenuPermission, loginRequired } from '@/common/auth'
import { requestPath } from '@/common/csrf'
import { getUploadedFile, queryString, rawJsonBody } from '@/common/http'
import { parsePagination } from '@/common/pagination'
import { getClientIp, getUserAgent } from '@/common/request-meta'
import { sendTable } from '@/common/tabular'
import { dictBody } from '@/common/py-values'
import { LogsService } from './service'

export async function registerLogsRoutes(app: FastifyInstance): Promise<void> {
  const service = new LogsService(app.db)
  const opts = { preHandler: loginRequired }

  app.addHook('onResponse', async (request, reply) => {
    // 只记录命中路由的请求（Flask 里 after_request 注册在 Blueprint 上，未匹配路由不会触发）
    if (!request.routeOptions.url) return
    try {
      const contentType = request.headers['content-type'] ?? ''
      await service.recordOperationFromRequest({
        method: request.method,
        path: requestPath(request),
        username: request.session.get('username'),
        jsonBody: contentType.includes('application/json') ? (request.body ?? null) : null,
        ip: getClientIp(request),
        userAgent: getUserAgent(request),
        statusCode: reply.statusCode,
      })
    } catch (err) {
      request.log.warn({ err }, '记录操作日志失败')
    }
  })

  app.get('/api/admin/logs/login', opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'system_logs'))) {
      return reply.status(403).send({ error: '无权限访问' })
    }
    const { page, per_page } = parsePagination(request.query as Record<string, unknown>)
    return service.listLoginLogs(page, per_page, {
      username: queryString(request, 'username').trim(),
      status: queryString(request, 'status').trim(),
    })
  })

  app.get('/api/admin/logs/operation', opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'system_logs'))) {
      return reply.status(403).send({ error: '无权限访问' })
    }
    const { page, per_page } = parsePagination(request.query as Record<string, unknown>)
    return service.listOperationLogs(page, per_page, {
      username: queryString(request, 'username').trim(),
      module: queryString(request, 'module').trim(),
      action: queryString(request, 'action').trim(),
    })
  })

  app.post('/api/admin/logs/login/export', opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'system_logs'))) {
      return reply.status(403).send({ error: '无权限导出日志' })
    }
    return sendTable(reply, await service.exportLoginLogs(dictBody(rawJsonBody(request))))
  })

  app.get('/api/admin/logs/login/template', opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'system_logs'))) {
      return reply.status(403).send({ error: '无权限下载日志模板' })
    }
    return sendTable(reply, await service.downloadLoginTemplate(queryString(request, 'file_type')))
  })

  app.post('/api/admin/logs/login/import', opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'system_logs'))) {
      return reply.status(403).send({ error: '无权限导入日志' })
    }
    return service.importLoginLogs(await getUploadedFile(request))
  })

  app.post('/api/admin/logs/operation/export', opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'system_logs'))) {
      return reply.status(403).send({ error: '无权限导出日志' })
    }
    return sendTable(reply, await service.exportOperationLogs(dictBody(rawJsonBody(request))))
  })

  app.get('/api/admin/logs/operation/template', opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'system_logs'))) {
      return reply.status(403).send({ error: '无权限下载日志模板' })
    }
    return sendTable(reply, await service.downloadOperationTemplate(queryString(request, 'file_type')))
  })

  app.post('/api/admin/logs/operation/import', opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'system_logs'))) {
      return reply.status(403).send({ error: '无权限导入日志' })
    }
    return service.importOperationLogs(await getUploadedFile(request))
  })
}
