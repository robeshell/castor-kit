/**
 * Background scheduled-task scheduler (ScheduledTaskRunner)
 *
 * Lease model, so multiple scheduler processes can run concurrently without double execution:
 * - claim: if `next_run_at` still equals the value read, null it and mark running; claimed only if the UPDATE hits exactly 1 row
 * - Expired-lease reclaim: tasks that are running with a null next_run_at and updated_at older than now - lease are reset to idle and due immediately
 * - Execution crash (execute_task throws): schedule the next run from cron (5 minutes later if the cron is invalid) and mark failed
 *
 * Runs in the web process (main.ts) when RUN_SCHEDULER_IN_WEB=true; otherwise as a separate process `node dist/worker.js`.
 */

import type { AppConfig } from '@/config'
import type { Db } from '@/db/client'
import { ScheduledTaskService } from '@/modules/admin/scheduled-task/service'
import { ScheduledTaskRepository, type CrashNextRun } from '@/modules/admin/scheduled-task/repository'
import { computeNextRunAt } from './cron'
import { ScheduledTaskSchemaError } from './errors'

/** Minimal pino-compatible logger interface (web process passes app.log, worker uses consoleLogger) */
export interface SchedulerLogger {
  info(msg: string): void
  info(obj: object, msg?: string): void
  warn(msg: string): void
  warn(obj: object, msg?: string): void
  error(msg: string): void
  error(obj: object, msg?: string): void
}

export interface ScheduledTaskRunnerOptions {
  intervalSeconds?: number
  leaseSeconds?: number
  logger?: SchedulerLogger
  /** Injectable for tests (e.g. a service with a custom HTTP executor) */
  service?: ScheduledTaskService
}

const silentLogger: SchedulerLogger = { info() {}, warn() {}, error() {} }

/** Read an integer config value: falls back to the default when missing or 0 */
function intOr(value: number | undefined, fallback: number): number {
  return Math.trunc(value || fallback)
}

export class ScheduledTaskRunner {
  readonly intervalSeconds: number
  readonly leaseSeconds: number
  private readonly repo: ScheduledTaskRepository
  private readonly service: ScheduledTaskService
  private readonly logger: SchedulerLogger
  private stopped = true
  private loopPromise: Promise<void> | null = null
  private wake: (() => void) | null = null
  private sleepTimer: NodeJS.Timeout | null = null

  constructor(db: Db, options: ScheduledTaskRunnerOptions = {}) {
    this.intervalSeconds = Math.max(5, intOr(options.intervalSeconds, 20))
    this.leaseSeconds = Math.max(this.intervalSeconds * 3, intOr(options.leaseSeconds, 1800))
    this.repo = new ScheduledTaskRepository(db)
    this.service = options.service ?? new ScheduledTaskService(db)
    this.logger = options.logger ?? silentLogger
  }

  get running(): boolean {
    return !this.stopped
  }

  start(): void {
    if (this.loopPromise) return
    this.stopped = false
    this.loopPromise = this.loop()
  }

  /** Stop the loop; waits up to 3 seconds for the current tick */
  async stop(): Promise<void> {
    this.stopped = true
    if (this.sleepTimer) clearTimeout(this.sleepTimer)
    this.wake?.()
    const current = this.loopPromise
    if (current) {
      let timer: NodeJS.Timeout | undefined
      await Promise.race([current, new Promise<void>((resolve) => (timer = setTimeout(resolve, 3000)))])
      clearTimeout(timer)
    }
    this.loopPromise = null
  }

  private async loop(): Promise<void> {
    while (!this.stopped) {
      try {
        await this.executeDueTasks()
      } catch (err) {
        if (!this.stopped) this.logger.error({ err }, 'Scheduled task runner loop failed')
      }
      if (this.stopped) break
      await new Promise<void>((resolve) => {
        this.wake = resolve
        this.sleepTimer = setTimeout(resolve, this.intervalSeconds * 1000)
      })
      this.wake = null
      this.sleepTimer = null
    }
  }

  /** One tick: reclaim expired leases → fetch due tasks (up to 20) → claim and execute each */
  async executeDueTasks(): Promise<void> {
    await this.recoverStaleClaims()
    const dueTasks = await this.repo.listDueTasks(20)

    for (const item of dueTasks) {
      if (this.stopped && this.loopPromise) break
      const claimed = await this.repo.claim(item.id, item.next_run_at!)
      if (!claimed) continue

      const task = await this.repo.getTask(item.id)
      if (!task) continue

      try {
        await this.service.executeTask(task, 'scheduled')
      } catch (err) {
        let next: CrashNextRun = 'now'
        if (task.is_active) {
          try {
            next = { at: computeNextRunAt(task.cron_expression, await this.repo.utcNow()) }
          } catch (cronErr) {
            if (!(cronErr instanceof ScheduledTaskSchemaError)) throw cronErr
            next = 'now+5m'
          }
        }
        await this.repo.markCrashed(item.id, next)
        this.logger.error({ err, task_id: item.id }, `Scheduled task execution crashed, task_id=${item.id}`)
      }
    }
  }

  async recoverStaleClaims(): Promise<number> {
    const recovered = await this.repo.recoverStaleClaims(this.leaseSeconds)
    if (recovered) this.logger.warn(`Recovered stale scheduled task claims: ${recovered}`)
    return recovered
  }
}

/**
 * Start the scheduler: not started (returns null) when ENABLE_TASK_SCHEDULER is off.
 * The caller is responsible for `await runner.stop()` on shutdown.
 */
export function startScheduledTaskRunner(db: Db, config: AppConfig, logger?: SchedulerLogger): ScheduledTaskRunner | null {
  if (!config.enableTaskScheduler) return null
  const runner = new ScheduledTaskRunner(db, {
    intervalSeconds: config.taskSchedulerIntervalSeconds,
    leaseSeconds: config.taskSchedulerLeaseSeconds,
    logger,
  })
  runner.start()
  return runner
}
