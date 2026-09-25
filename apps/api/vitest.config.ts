import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    include: ['test/**/*.test.ts'],
    globalSetup: ['test/global-setup.ts'],
    // All files share one real PostgreSQL test database; run files serially so writes like login logs don't interfere with each other
    fileParallelism: false,
    testTimeout: 20000,
  },
})
