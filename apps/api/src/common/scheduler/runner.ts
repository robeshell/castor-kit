/**
 * 后台定时任务调度器（ScheduledTaskRunner）
 *
 * 租约模型，多个调度进程可以同时运行而不重复执行：
 * - claim：`next_run_at` 仍等于读到的值时置空并标 running，UPDATE 命中 1 行才算抢到
 * - 过期回收：running 且 next_run_at 为空、updated_at 早于 now - lease 的任务重置为 idle 并立即到期
 * - 执行崩溃（execute_task 抛异常）：按 cron 排下一次（cron 非法则 5 分钟后），标 failed
 *
 * 运行方式：RUN_SCHEDULER_IN_WEB=true 时 web 进程内启动（main.ts）；否则用独立进程 `node dist/worker.js`。
 */

import type { AppConfig } from '@/config'
import type { Db } from '@/db/client'
import { ScheduledTaskService } from '@/modules/admin/scheduled-task/service'
import { ScheduledTaskRepository, type CrashNextRun } from '@/modules/admin/scheduled-task/repository'
import { computeNextRunAt } from './cron'
import { ScheduledTaskSchemaError } from './errors'

/** pino 兼容的最小日志接口（web 进程传 app.log，worker 用 consoleLogger） */
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
  /** 测试可注入（例如自定义 HTTP 执行器的 service） */
  service?: ScheduledTaskService
}

const silentLogger: SchedulerLogger = { info() {}, warn() {}, error() {} }

/** 取整数配置：缺省或为 0 时用默认值 */
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

  /** 停止循环；最多等待当前一轮 3 秒 */
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

  /** 一轮调度：回收过期租约 → 取到期任务（最多 20 条）→ 逐个抢占并执行 */
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
 * 启动调度器：ENABLE_TASK_SCHEDULER 关闭时不启动（返回 null）。
 * 调用方负责在关闭时 `await runner.stop()`。
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
