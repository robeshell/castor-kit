/**
 * Scheduled task schema layer: request body
 *
 * Cron parsing / URL SSRF protection live in common/scheduler (also used by the scheduler and worker). The URL is
 * validated in the service, since it resolves the hostname. Scheduled tasks have no export endpoint.
 */

import { z } from 'zod'
import { field, invalidMessage } from '@/common/validation'

export const METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] as const

/** Request headers: a JSON object, or its JSON text (the form's text area); stored as JSON text */
const requestHeaders = z
  .union([z.string(), z.record(z.string(), z.unknown())], { error: invalidMessage('请求头') })
  .nullish()
  .transform((value, ctx) => {
    if (value === null || value === undefined) return null
    if (typeof value !== 'string') return JSON.stringify(value)
    const text = value.trim()
    if (!text) return null
    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      ctx.addIssue({ code: 'custom', message: 'JSON 格式不合法' })
      return z.NEVER
    }
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      ctx.addIssue({ code: 'custom', message: 'JSON 内容必须是对象' })
      return z.NEVER
    }
    return JSON.stringify(parsed)
  })

export const taskBody = z.object({
  name: field.requiredText('任务名称', '任务名称不能为空'),
  task_code: field.requiredText('任务编码', '任务编码不能为空'),
  cron_expression: field.requiredText('Cron 表达式', 'Cron 表达式不能为空'),
  request_method: z.preprocess(
    (v) => (typeof v === 'string' ? v.trim().toUpperCase() : v),
    field.choice('请求方法', METHODS, 'GET', '请求方法仅支持 GET/POST/PUT/DELETE/PATCH'),
  ),
  request_url: field.text('请求地址'),
  request_headers: requestHeaders,
  request_body: field.text('请求体'),
  timeout_seconds: field.int('超时时间', 10),
  is_active: field.bool('启用', true),
  remark: field.text('备注'),
})

export type TaskInput = z.output<typeof taskBody>

/** Timeout in seconds, kept within 1–120 */
export function clampTimeout(value: number): number {
  return Math.max(1, Math.min(value, 120))
}
