/**
 * Test DB setup: run migrations against TEST_DATABASE_URL (clone of the live DB → only mark the baseline; empty DB → create all tables).
 * Locally, usually clone the dev DB with `createdb -T castor_kit castor_kit_test`, or create an empty one with `createdb castor_kit_test`.
 */

import { runMigrations } from '../src/db/migrate'
import { TEST_DATABASE_URL } from './helpers'

export default async function setup(): Promise<void> {
  await runMigrations(TEST_DATABASE_URL, () => {})
}
