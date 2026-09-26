/**
 * Business exceptions and unified error handling (ServiceError definition + global error handler)
 *
 * There is a single response shape: `{ error: string, ...payload }`. 5xx always returns a generic message and never leaks internal details.
 */

import type { FastifyError, FastifyInstance } from 'fastify'
import { hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod'

export const INTERNAL_ERROR_MESSAGE = '服务器内部错误，请稍后重试'

export class ServiceError extends Error {
  readonly statusCode: number
  readonly payload: Record<string, unknown>

  constructor(message: string, statusCode = 400, payload: Record<string, unknown> = {}) {
    super(message)
    this.name = 'ServiceError'
    this.statusCode = statusCode
    this.payload = payload
  }
}

export function serviceErrorBody(error: ServiceError): Record<string, unknown> {
  const body: Record<string, unknown> = {
    error: error.statusCode >= 500 ? INTERNAL_ERROR_MESSAGE : error.message,
  }
  return Object.assign(body, error.payload)
}

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error: FastifyError, request, reply) => {
    if (error instanceof ServiceError) {
      if (error.statusCode >= 500) request.log.error({ err: error }, '业务异常（5xx）')
      return reply.status(error.statusCode).send(serviceErrorBody(error))
    }

    if (hasZodFastifySchemaValidationErrors(error)) {
      const first = error.validation[0]
      return reply.status(400).send({ error: first?.message ?? '请求参数不合法' })
    }

    // An uploaded file over the multipart limit: name the limit that applies to this upload
    if (error.code === 'FST_REQ_FILE_TOO_LARGE') {
      const { config, settings } = request.server
      const limit = request.url.startsWith('/api/admin/files') ? settings.peek().upload.maxSize : config.maxContentLength
      return reply.status(413).send({ error: `文件过大，最大支持 ${Math.round((limit / 1024 / 1024) * 10) / 10}MB` })
    }

    // Fastify's own 4xx errors (JSON parse failure, body too large, etc.)
    const status = error.statusCode
    if (status !== undefined && status >= 400 && status < 500) {
      const message =
        status === 413 ? '请求体过大' : error.code?.startsWith('FST_ERR_CTP') ? '请求体格式错误' : error.message
      return reply.status(status).send({ error: message })
    }

    request.log.error({ err: error }, '未处理的服务器错误')
    return reply.status(500).send({ error: INTERNAL_ERROR_MESSAGE })
  })
}
