import { defineConfig } from 'tsup'

export default defineConfig({
  // 命名入口：产物平铺在 dist/ 下（dist/main.js、dist/worker.js、dist/migrate.js、dist/setup-once.js），
  // 不随源文件所在目录（src/ 与 scripts/）变化。
  entry: {
    main: 'src/main.ts',
    worker: 'src/worker.ts',
    migrate: 'src/db/migrate-cli.ts',
    'setup-once': 'scripts/setup-once.ts',
  },
  format: ['esm'],
  target: 'node22',
  platform: 'node',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  // 依赖保持 external，由 node_modules 提供；只把 @/ 别名打进产物
  skipNodeModulesBundle: true,
})
