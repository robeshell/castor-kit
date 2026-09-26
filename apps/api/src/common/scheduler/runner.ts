/**
 * Background scheduled-task scheduler (ScheduledTaskRunner)
 *
 * Lease model, so multiple scheduler processes can run concurrently without double execution:
 * - claim: if `next_run_at` still equals the value read, null it and mark running; claimed only if the UPDATE hits exactly 1 row
 * - Expired-lease reclaim: tasks that are running with a null next_run_at and updated_at older than now - lease are reset to idle and due immediately
 * - Execution crash (execute_task throws): schedule the next run from cron (5 minutes later if the cron is invalid) and mark failed
 *
 * Runs in the web process (main.ts) when RUN_SCHEDULER_IN_WEB=true; otherwise as a separate process `node dist/worker.js`.
 *
 * Besides user-defined tasks (which only call HTTP endpoints), the loop also runs built-in maintenance jobs such as the
 * file center's orphan cleanup and the removal of old sessions, each at its own interval.
 */

import type { AppConfig } from '@/config'
import type { Db } from '@/db/client'
import { purgeSessions } from '@/common/session'
import { Storage } from '@/common/storage'
import { FileService } from '@/modules/admin/files/service'
import { PasswordResetRepository } from '@/modules/admin/password-reset/repository'
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

/** Built-in job run by the scheduler loop every `intervalSeconds` (jobs must be safe to run from several processes) */
export interface MaintenanceJob {
  name: string
  intervalSeconds: number
  run(): Promise<void>
}

export interface ScheduledTaskRunnerOptions {
  intervalSeconds?: number
  leaseSeconds?: number
  logger?: SchedulerLogger
  maintenance?: MaintenanceJob[]
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
  private readonly maintenance: MaintenanceJob[]
  /** Job name → epoch ms of its next run */
  private readonly maintenanceDue = new Map<string, number>()

  constructor(db: Db, options: ScheduledTaskRunnerOptions = {}) {
    this.intervalSeconds = Math.max(5, intOr(options.intervalSeconds, 20))
    this.leaseSeconds = Math.max(this.intervalSeconds * 3, intOr(options.leaseSeconds, 1800))
    this.repo = new ScheduledTaskRepository(db)
    this.service = options.service ?? new ScheduledTaskService(db)
    this.logger = options.logger ?? silentLogger
    this.maintenance = options.maintenance ?? []
  }

  /** Run the maintenance jobs that are due; a failing job is logged and retried at its next interval */
  async runMaintenance(now = Date.now()): Promise<void> {
    for (const job of this.maintenance) {
      if ((this.maintenanceDue.get(job.name) ?? 0) > now) continue
      this.maintenanceDue.set(job.name, now + job.intervalSeconds * 1000)
      try {
        await job.run()
      } catch (err) {
        this.logger.error({ err }, `Maintenance job failed: ${job.name}`)
      }
    }
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
      if (!this.stopped) await this.runMaintenance()
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
    maintenance: [fileCleanupJob(db, config, logger), sessionPurgeJob(db, logger)],
  })
  runner.start()
  return runner
}

/** File center: hourly removal of files nothing references 24h after upload */
export function fileCleanupJob(db: Db, config: AppConfig, logger: SchedulerLogger = silentLogger): MaintenanceJob {
  const service = new FileService(db, new Storage(config.storage), config.storage, logger)
  return {
    name: 'file-orphan-cleanup',
    intervalSeconds: 3600,
    async run() {
      const removed = await service.cleanupOrphans()
      if (removed) logger.info(`File cleanup removed ${removed} orphan file(s)`)
    },
  }
}

/** Hourly removal of sessions and password reset links that expired or were used / revoked more than a day ago */
export function sessionPurgeJob(db: Db, logger: SchedulerLogger = silentLogger): MaintenanceJob {
  const resets = new PasswordResetRepository(db)
  return {
    name: 'session-purge',
    intervalSeconds: 3600,
    async run() {
      const removed = (await purgeSessions(db)) + (await resets.purge())
      if (removed) logger.info(`Session purge removed ${removed} old session / reset link row(s)`)
    },
  }
}
