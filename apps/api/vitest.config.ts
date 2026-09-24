import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    include: ['test/**/*.test.ts'],
    globalSetup: ['test/global-setup.ts'],
    // 共用一个真实 PostgreSQL 测试库，文件间串行避免登录日志等写入互相干扰
    fileParallelism: false,
    testTimeout: 20000,
  },
})
