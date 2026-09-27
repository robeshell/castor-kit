/**
 * Business exceptions and unified error handling (ServiceError definition + global error handler)
 *
 * There is a single response shape: `{ error: string, ...payload }`. 5xx always returns a generic message and never leaks internal details.
 * Database errors caused by the request's data (common/db-errors.ts) are 400s, wherever they are thrown.
 */

import type { FastifyError, FastifyInstance } from 'fastify'
import { hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod'
import { dbConstraintError } from './db-errors'

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

/**
 * A failure that isn't the caller's fault → 500. The detail goes to the log only: the response carries the generic
 * message. Use this for every 500 (never `new ServiceError(…, 500)` by hand; test/conventions.test.ts checks), so a
 * reader can tell real server errors from input errors, which are 4xx.
 */
export function internalError(detail: unknown): ServiceError {
  return new ServiceError(detail instanceof Error ? detail.message : String(detail), 500)
}

/** Shown for a request value of the wrong type or shape (the technical detail stays out of the response) */
export const INVALID_INPUT_MESSAGE = '请求参数格式不正确'

/** A request value of the wrong type or shape → 400 */
export function invalidInput(): ServiceError {
  return new ServiceError(INVALID_INPUT_MESSAGE, 400)
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
      const limit = request.url.startsWith('/api/admin/files') ? settings.peek().upload.maxSize : config.bodyLimit
      return reply.status(413).send({ error: `文件过大，最大支持 ${Math.round((limit / 1024 / 1024) * 10) / 10}MB` })
    }

    // Fastify's own 4xx errors (JSON parse failure, body too large, etc.)
    const status = error.statusCode
    if (status !== undefined && status >= 400 && status < 500) {
      const message =
        status === 413 ? '请求体过大' : error.code?.startsWith('FST_ERR_CTP') ? '请求体格式错误' : error.message
      return reply.status(status).send({ error: message })
    }

    // The database rejected a value from the request (unique conflict, too long, missing, unknown reference, bad
    // format): the caller's input is at fault, so 400 with a generic message instead of a 500
    const rejected = dbConstraintError(error)
    if (rejected) {
      request.log.warn({ err: error }, '数据库拒绝了请求中的数据')
      return reply.status(400).send({ error: rejected.message })
    }

    request.log.error({ err: error }, '未处理的服务器错误')
    return reply.status(500).send({ error: INTERNAL_ERROR_MESSAGE })
  })
}
