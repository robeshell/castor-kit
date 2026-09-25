/**
 * 定时任务 schema 层异常
 *
 * cron 解析、JSON 解析、URL 校验不合法时抛出；service 层按调用位置决定转成 400 还是 500。
 */

export class ScheduledTaskSchemaError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ScheduledTaskSchemaError'
  }
}

/**
 * 不属于校验失败的内部错误（例如 URL 拆分时的 "Invalid IPv6 URL"、数值溢出）。
 * 由 service 转成 ServiceError(500)。
 */
export class PyUncaughtError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PyUncaughtError'
  }
}
