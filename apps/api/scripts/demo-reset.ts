/**
 * Restore the public demo data now (ignores DEMO_RESET_HOURS).
 * Usage: `pnpm demo:reset` (uses the current environment's database)
 */

import { loadConfig, loadEnvFiles, type AppEnv } from '../src/config'
import { resetDemoIfDue } from '../src/demo/reset'

loadEnvFiles((process.env.NODE_ENV ?? 'development') as AppEnv)
const config = loadConfig()
resetDemoIfDue({ databaseUrl: config.databaseUrl, resetHours: config.demoResetHours, force: true }).catch((err: unknown) => {
  console.error(err)
  process.exit(1)
})
