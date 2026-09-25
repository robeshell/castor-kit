/**
 * AI prompt template repository layer
 */

import { asc, eq, sql } from 'drizzle-orm'
import type { PgInsertValue, PgUpdateSetSource } from 'drizzle-orm/pg-core'
import { pyJsonDumps } from '@/common/request-meta'
import type { Executor } from '@/db/client'
import { ai_prompt_templates, type AiPromptTemplate } from '@/db/schema'

export type AiPromptTemplateInsert = PgInsertValue<typeof ai_prompt_templates>
export type AiPromptTemplateUpdate = PgUpdateSetSource<typeof ai_prompt_templates>

/** json columns are written in `json.dumps` text format (`["a", "b"]`, separators include a space) */
export function variablesValue(variables: string[]) {
  return sql`${pyJsonDumps(variables)}::json`
}

export class AiPromptRepository {
  constructor(private readonly db: Executor) {}

  async listNames(): Promise<string[]> {
    const rows = await this.db.select({ name: ai_prompt_templates.name }).from(ai_prompt_templates)
    return rows.map((r) => r.name)
  }

  async insertMany(values: AiPromptTemplateInsert[]): Promise<void> {
    if (values.length === 0) return
    await this.db.insert(ai_prompt_templates).values(values)
  }

  async list(category: string): Promise<AiPromptTemplate[]> {
    return this.db
      .select()
      .from(ai_prompt_templates)
      .where(category ? eq(ai_prompt_templates.category, category) : undefined)
      .orderBy(asc(ai_prompt_templates.id))
  }

  async getById(id: number): Promise<AiPromptTemplate | null> {
    const [row] = await this.db.select().from(ai_prompt_templates).where(eq(ai_prompt_templates.id, id)).limit(1)
    return row ?? null
  }

  async insert(values: AiPromptTemplateInsert): Promise<AiPromptTemplate> {
    const [row] = await this.db.insert(ai_prompt_templates).values(values).returning()
    return row!
  }

  async update(id: number, values: AiPromptTemplateUpdate): Promise<AiPromptTemplate> {
    const [row] = await this.db.update(ai_prompt_templates).set(values).where(eq(ai_prompt_templates.id, id)).returning()
    return row!
  }

  async delete(id: number): Promise<void> {
    await this.db.delete(ai_prompt_templates).where(eq(ai_prompt_templates.id, id))
  }
}
