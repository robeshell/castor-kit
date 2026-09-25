import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema/index.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? process.env.DEV_DATABASE_URL ?? 'postgresql://localhost/castor_kit_dev',
  },
  migrations: {
    // Keep migration records in a separate schema, out of public (so the AI SQL table-exposure logic doesn't see them)
    schema: 'drizzle',
    table: '__drizzle_migrations',
  },
})
