/**
 * 测试库准备：对 TEST_DATABASE_URL 执行迁移（现库克隆 → 只标记 baseline；空库 → 建全部表）。
 * 本地一般用 `createdb -T aurastack aurastack_test` 克隆开发库，或 `createdb aurastack_test` 建空库。
 */

import { runMigrations } from '../src/db/migrate'
import { TEST_DATABASE_URL } from './helpers'

export default async function setup(): Promise<void> {
  await runMigrations(TEST_DATABASE_URL, () => {})
}
