/**
 * Test DB setup: run the migrations against TEST_DATABASE_URL, then sync the built-in menus, the super admin role and the
 * admin account (incremental and idempotent), so the tests work on a freshly created database as well as on a clone
 * of the dev database. Create one with `createdb castor_kit_test` (or clone: `createdb -T castor_kit castor_kit_test`).
 */

import { seedRbac } from '../scripts/seed-rbac'
import { runMigrations } from '../src/db/migrate'
import { TEST_DATABASE_URL } from './helpers'

export default async function setup(): Promise<void> {
  await runMigrations(TEST_DATABASE_URL, () => {})
  await seedRbac({ databaseUrl: TEST_DATABASE_URL, adminPassword: 'admin123', incremental: true, log: () => {} })
}
