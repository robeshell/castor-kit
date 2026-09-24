/**
 * 定时任务 schema 层异常（对齐 AuraStack backend/app/admin/schema/scheduled_task.py 的 ScheduledTaskSchemaError）
 *
 * cron 解析、JSON 解析、URL 校验不合法时抛出；service 层按 Python 的 try/except 位置决定转成 400 还是 500。
 */

export class ScheduledTaskSchemaError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ScheduledTaskSchemaError'
  }
}

/**
 * Python 侧未被捕获的 ValueError / OverflowError 等（例如 urlparse 抛的 "Invalid IPv6 URL"）。
 * Flask 里会冒泡成 500，Node 侧由 service 转成 ServiceError(500)。
 */
export class PyUncaughtError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PyUncaughtError'
  }
}
