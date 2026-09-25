/**
 * Schema-layer errors for scheduled tasks
 *
 * Thrown on invalid cron expressions, JSON, or URLs; the service layer decides per call site whether to map it to 400 or 500.
 */

export class ScheduledTaskSchemaError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ScheduledTaskSchemaError'
  }
}

/**
 * Internal errors that are not validation failures (e.g. "Invalid IPv6 URL" during URL splitting, numeric overflow).
 * The service maps these to ServiceError(500).
 */
export class PyUncaughtError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PyUncaughtError'
  }
}
