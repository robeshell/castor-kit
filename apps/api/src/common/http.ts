/**
 * 路由层通用工具
 */

import type { FastifyRequest } from 'fastify'
import { ServiceError } from './errors'
import type { UploadedFile } from './tabular'

const PG_INT_MAX = 2_147_483_647

/**
 * Flask `<int:xxx>` 路径参数：只匹配纯数字，否则路由不命中（按 404/405 语义处理）。
 * 用法：`app.get(`/api/admin/users/${intParam('user_id')}`, ...)`
 */
export function intParam(name = 'id'): string {
  return `:${name}(^\\d+$)`
}

/** 解析 intParam；超出 PG integer 范围的 id 不可能存在 → 404（避免驱动报 out of range 变成 500） */
export function parseIntParam(value: unknown): number {
  const id = Number(value)
  if (!Number.isSafeInteger(id) || id > PG_INT_MAX) throw notFound()
  return id
}

/** 等价 Flask `get_or_404` / `abort(404)` 的 JSON 响应 `{error:'资源不存在'}` */
export function notFound(): ServiceError {
  return new ServiceError('资源不存在', 404)
}

/** Flask `request.get_json() or {}`：非对象（null / 非 JSON / 空 body）一律当作 {} */
export function jsonBody(request: FastifyRequest): Record<string, unknown> {
  const body = request.body
  if (body && typeof body === 'object' && !Array.isArray(body)) return body as Record<string, unknown>
  return {}
}

/** Flask `request.get_json(silent=True)` 的原始值（可能是数组 / 标量 / null） */
export function rawJsonBody(request: FastifyRequest): unknown {
  return request.body ?? null
}

/** `request.args.get(key, default)`：同名多值取第一个 */
export function queryString(request: FastifyRequest, key: string, fallback = ''): string {
  const value = (request.query as Record<string, unknown> | undefined)?.[key]
  const first = Array.isArray(value) ? value[0] : value
  return typeof first === 'string' ? first : fallback
}

/**
 * `request.files.get(field)`：取 multipart 中指定字段的第一个文件；非 multipart / 未选择文件返回 null。
 * 其余文件流会被读空丢弃。
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
