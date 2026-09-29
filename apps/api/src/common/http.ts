/**
 * Common route-layer helpers
 */

import type { FastifyRequest } from 'fastify'
import { ServiceError } from './errors'
import type { UploadedFile } from './tabular'

const PG_INT_MAX = 2_147_483_647

/**
 * Integer path param: matches digits only, otherwise the route does not match (handled by 404/405 semantics).
 * Usage: `app.get(`/api/admin/users/${intParam('user_id')}`, ...)`
 */
export function intParam(name = 'id'): string {
  return `:${name}(^\\d+$)`
}

/** Parse an intParam; ids beyond the PG integer range cannot exist → 404 (keeps the driver's out-of-range error from becoming a 500) */
export function parseIntParam(value: unknown): number {
  const id = Number(value)
  if (!Number.isSafeInteger(id) || id > PG_INT_MAX) throw notFound()
  return id
}

/** 404 JSON response for a missing resource `{error:'资源不存在'}` */
export function notFound(): ServiceError {
  return new ServiceError('资源不存在', 404)
}



/** Read a query param as a string: default when missing, first value when repeated */
export function queryString(request: FastifyRequest, key: string, fallback = ''): string {
  const value = (request.query as Record<string, unknown> | undefined)?.[key]
  const first = Array.isArray(value) ? value[0] : value
  return typeof first === 'string' ? first : fallback
}

/**
 * First file of the given multipart field (read through `request.parts()`); returns null for non-multipart requests or when no file was selected.
 * Remaining file streams are drained and discarded.
 */
export async function getUploadedFile(request: FastifyRequest, field = 'file'): Promise<UploadedFile | null> {
  if (!request.isMultipart()) return null
  let found: UploadedFile | null = null
  for await (const part of request.parts()) {
    if (part.type !== 'file') continue
    if (!found && part.fieldname === field && part.filename) {
      found = { filename: part.filename, data: await part.toBuffer() }
    } else {
      part.file.resume()
    }
  }
  return found
}
