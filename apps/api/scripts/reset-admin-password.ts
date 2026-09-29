/**
 * Set the admin account's password to ADMIN_PASSWORD (for a forgotten password).
 *
 * Usage:
 *   Docker:  set ADMIN_PASSWORD in .env.production, run `docker compose --env-file .env.production up -d` so the
 *            container picks it up, then `docker compose --env-file .env.production exec app node dist/reset-admin-password.js`
 *   Local:   pnpm seed:rbac -- --incremental --reset-admin-password (same effect)
 *
 * Runs an incremental RBAC sync with the reset flag, so it also makes sure the admin account exists and has the
 * super_admin role. Other accounts, and the admin account's status, are left alone.
 */

import { loadConfig, loadEnvFiles, type AppEnv } from '../src/config'
import { seedRbac } from './seed-rbac'

loadEnvFiles((process.env.NODE_ENV ?? 'development') as AppEnv)
const config = loadConfig()
seedRbac({
  databaseUrl: config.databaseUrl,
  adminPassword: config.adminPassword,
  incremental: true,
  resetAdminPassword: true,
  // Quiet: the sync's own log would print the password
  log: () => {},
})
  .then(({ adminCreated }) => {
    console.log(adminCreated ? 'Created the admin account with ADMIN_PASSWORD.' : 'The admin password is now ADMIN_PASSWORD.')
    console.log('If sign-in is locked after failed attempts, wait for the lockout to end (15 minutes by default).')
  })
  .catch((err: unknown) => {
    console.error(`Reset failed: ${err instanceof Error ? err.message : String(err)}`)
    process.exit(1)
  })
