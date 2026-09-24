/**
 * 迁移命令行入口：`pnpm db:migrate`（源码）/ `node dist/migrate.js`（构建产物）。
 * 读取当前 NODE_ENV 的数据库配置。与 migrate.ts 分开，是因为打包后 runMigrations 会进共享 chunk，
 * 在库文件里用 import.meta.url 判断“是否直接执行”会失效。
 */

import { loadConfig, loadEnvFiles, type AppEnv } from '../config'
import { runMigrations } from './migrate'

loadEnvFiles((process.env.NODE_ENV ?? 'development') as AppEnv)
runMigrations(loadConfig().databaseUrl).catch((err: unknown) => {
  console.error(err)
  process.exit(1)
})
