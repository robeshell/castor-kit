/**
 * Migration CLI entry point: `pnpm db:migrate` (source) / `node dist/migrate.js` (build output).
 * Uses the database config for the current NODE_ENV. Kept separate from migrate.ts because after bundling runMigrations lands in a shared chunk,
 * where an import.meta.url "run directly?" check in library code no longer works.
 */

import { loadConfig, loadEnvFiles, type AppEnv } from '../config'
import { runMigrations } from './migrate'

loadEnvFiles((process.env.NODE_ENV ?? 'development') as AppEnv)
runMigrations(loadConfig().databaseUrl).catch((err: unknown) => {
  console.error(err)
  process.exit(1)
})
