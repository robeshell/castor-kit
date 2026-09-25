/**
 * Entry point of the standalone scheduled task worker process
 * Usage: `pnpm worker` (source) / `node dist/worker.js` (build output)
 *
 * Shares the lease model with the web process, so it can run alongside a web process with RUN_SCHEDULER_IN_WEB=true or other workers;
 * a given task is claimed by only one process at a time.
 * With ENABLE_TASK_SCHEDULER=false the scheduler is not started, but the process keeps running (idle).
 */

import { utcNowIso } from './common/serialize'
import { startScheduledTaskRunner, type SchedulerLogger } from './common/scheduler/runner'
import { loadConfig, loadEnvFiles, type AppEnv } from './config'
import { createDb } from './db/client'

loadEnvFiles((process.env.NODE_ENV ?? 'development') as AppEnv)
const config = loadConfig()
const handle = createDb(config.databaseUrl)

function write(level: string, objOrMsg: object | string, msg?: string): void {
  const time = utcNowIso()
  if (typeof objOrMsg === 'string') {
    console.log(`[${time}] ${level} ${objOrMsg}`)
    return
  }
  const { err, ...rest } = objOrMsg as { err?: unknown }
  const extra = Object.keys(rest).length > 0 ? ` ${JSON.stringify(rest)}` : ''
  console.log(`[${time}] ${level} ${msg ?? ''}${extra}`)
  if (err) console.log(err instanceof Error ? (err.stack ?? err.message) : String(err))
}

const logger: SchedulerLogger = {
  info: (o: object | string, m?: string) => write('INFO', o, m),
  warn: (o: object | string, m?: string) => write('WARN', o, m),
  error: (o: object | string, m?: string) => write('ERROR', o, m),
}

const runner = startScheduledTaskRunner(handle.db, config, logger)
// Keep the event loop alive
const keepAlive = setInterval(() => {}, 60_000)

if (runner) {
  console.log(`Scheduled task worker started.（间隔 ${runner.intervalSeconds}s，租约 ${runner.leaseSeconds}s）`)
} else {
  console.log('Scheduled task worker started.（ENABLE_TASK_SCHEDULER 已关闭，调度器未启动）')
}

let stopping = false
const shutdown = async () => {
  if (stopping) return
  stopping = true
  clearInterval(keepAlive)
  await runner?.stop()
  await handle.pool.end()
  console.log('Scheduled task worker stopped.')
  process.exit(0)
}
process.on('SIGINT', () => void shutdown())
process.on('SIGTERM', () => void shutdown())
