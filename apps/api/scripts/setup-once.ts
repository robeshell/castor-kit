/**
 * 容器并发安全的初始化：数据库迁移 + RBAC 同步 + AI SQL 只读账号
 *
 * 多副本同时启动时，用 PostgreSQL advisory lock 保证只有一个实例执行初始化，
 * 其余实例在锁上等待；前一个完成后，等待的实例获取锁后执行（幂等）并释放。
 *
 * 用法：Docker 入口在启动 web 进程前执行 `node dist/setup-once.js`（开发：`pnpm setup-once`）。
 *
 * RBAC 同步用增量模式（--incremental）：只同步菜单与权限，不清空 admin_users / roles / menus，
 * 容器重启不会删除已有用户、自定义角色与通知。
 */

import pg from 'pg'
import { loadConfig, loadEnvFiles, type AppEnv } from '../src/config'
import { runMigrations } from '../src/db/migrate'
import { initRoRole } from './init-ro-role'
import { seedRbac } from './seed-rbac'

/** "CKIT" */
export const ADVISORY_LOCK_KEY = 0x434b4954

export interface SetupOnceOptions {
  databaseUrl: string
  adminPassword: string
  roPassword: string
  /** 只读角色名，默认 castor_kit_ro（仅测试覆盖） */
  roRoleName?: string
  log?: (msg: string) => void
}

export async function runSetupOnce(options: SetupOnceOptions): Promise<void> {
  const log = options.log ?? console.log
  // 会话级 advisory lock 必须握在一条独立连接上，不能走连接池
  const lockClient = new pg.Client({ connectionString: options.databaseUrl })
  await lockClient.connect()
  try {
    await lockClient.query(`SELECT pg_advisory_lock(${ADVISORY_LOCK_KEY})`)
    log('[setup] 已获取初始化锁（并发安全）')

    log('[setup] 运行数据库迁移...')
    await runMigrations(options.databaseUrl, log)
    log('[setup] 数据库迁移完成')

    log('[setup] 同步 RBAC 菜单与权限...')
    await seedRbac({
      databaseUrl: options.databaseUrl,
      adminPassword: options.adminPassword,
      incremental: true,
      log,
    })

    log('[setup] 初始化 AI SQL 只读账号...')
    await initRoRole({
      databaseUrl: options.databaseUrl,
      roPassword: options.roPassword,
      roleName: options.roRoleName,
      log,
    })
  } finally {
    // 关闭连接即释放会话级锁；先显式 unlock，连接已断时忽略
    await lockClient.query(`SELECT pg_advisory_unlock(${ADVISORY_LOCK_KEY})`).catch(() => {})
    await lockClient.end().catch(() => {})
    log('[setup] 初始化完成，已释放锁')
  }
}

// 按脚本文件名判断是否为直接运行（tsx 跑源码或 node 跑 dist/setup-once.js）
const isMain = /[\\/]setup-once\.(?:ts|js|mjs)$/.test(process.argv[1] ?? '')
if (isMain) {
  const env = (process.env.NODE_ENV ?? 'development') as AppEnv
  loadEnvFiles(env)
  const config = loadConfig()
  runSetupOnce({
    databaseUrl: config.databaseUrl,
    adminPassword: config.adminPassword,
    roPassword: config.postgresRoPassword,
  }).catch((err: unknown) => {
    console.error(err)
    process.exit(1)
  })
}
