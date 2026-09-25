/**
 * Web process entry point
 * Usage: `pnpm dev` / `node dist/main.js [port]`
 */

import { buildApp } from './app'
import { startScheduledTaskRunner, type ScheduledTaskRunner } from './common/scheduler/runner'
import { loadConfig, loadEnvFiles, type AppEnv } from './config'

loadEnvFiles((process.env.NODE_ENV ?? 'development') as AppEnv)
const config = loadConfig()
const port = process.argv[2] ? Number(process.argv[2]) : config.port

const app = await buildApp({
  config,
  logger:
    config.env === 'development'
      ? { level: 'info', transport: { target: 'pino-pretty', options: { translateTime: 'SYS:HH:MM:ss' } } }
      : { level: 'info' },
})

// Scheduled tasks: with RUN_SCHEDULER_IN_WEB=true the scheduler loop runs inside the web process (otherwise use the standalone worker: node dist/worker.js)
let schedulerRunner: ScheduledTaskRunner | null = null

const shutdown = async (signal: string) => {
  app.log.info(`收到 ${signal}，正在关闭`)
  await schedulerRunner?.stop()
  await app.close()
  process.exit(0)
}
process.on('SIGINT', () => void shutdown('SIGINT'))
process.on('SIGTERM', () => void shutdown('SIGTERM'))

await app.listen({ host: '0.0.0.0', port })
app.log.info(`castor-kit 启动｜环境 ${config.env}｜端口 ${port}`)

if (config.runSchedulerInWeb) {
  schedulerRunner = startScheduledTaskRunner(app.db, config, app.log)
  if (schedulerRunner) {
    app.log.info(`定时任务调度器已在 web 进程内启动（间隔 ${schedulerRunner.intervalSeconds}s，租约 ${schedulerRunner.leaseSeconds}s）`)
  }
}
