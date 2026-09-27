/**
 * Test DB setup: run the migrations against TEST_DATABASE_URL (an empty database gets every table; a clone of the dev DB gets the pending ones).
 * Locally, usually clone the dev DB with `createdb -T castor_kit castor_kit_test`, or create an empty one with `createdb castor_kit_test`.
 */

import { runMigrations } from '../src/db/migrate'
import { TEST_DATABASE_URL } from './helpers'

export default async function setup(): Promise<void> {
  await runMigrations(TEST_DATABASE_URL, () => {})
}
