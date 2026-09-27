/**
 * Schema-layer errors for scheduled tasks
 *
 * Thrown on invalid cron expressions or URLs; the service maps it to a 400.
 */

export class ScheduledTaskSchemaError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ScheduledTaskSchemaError'
  }
}
