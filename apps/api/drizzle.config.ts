import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema/index.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? process.env.DEV_DATABASE_URL ?? 'postgresql://localhost/aurastack_dev',
  },
  // alembic_version 由 Alembic 维护，不纳入 Drizzle 管理
  tablesFilter: ['!alembic_version'],
  migrations: {
    // 迁移记录放独立 schema，不出现在 public（避免被 AI SQL 的表暴露逻辑看到）
    schema: 'drizzle',
    table: '__drizzle_migrations',
  },
})
