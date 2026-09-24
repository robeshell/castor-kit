/**
 * 独立定时任务 worker 进程入口（替代 AuraStack backend/scripts/run_scheduler_worker.py）
 * 用法：`pnpm worker`（源码）/ `node dist/worker.js`（构建产物）
 *
 * 与 web 进程共用同一套租约模型，可与 RUN_SCHEDULER_IN_WEB=true 的 web 进程或其他 worker 同时运行，
 * 同一任务同一时刻只会被一个进程抢到。
 * 对齐 Python：ENABLE_TASK_SCHEDULER=false 时不启动调度，但进程保持运行（Python worker 同样空转）。
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
// 保持事件循环存活（对应 Python 的 while True: time.sleep(60)）
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
