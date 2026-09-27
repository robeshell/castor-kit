/**
 * AI prompt template service layer
 */

import type { z } from 'zod'
import { writeError } from '@/common/db-errors'
import { changedFields } from '@/common/validation'
import type { Db } from '@/db/client'
import { aiPromptTemplateToDict, type AiPromptTemplate } from '@/db/schema'
import { AiPromptRepository, variablesValue, type AiPromptTemplateUpdate } from './repository'
import { extractVariables, findVariables, SEED_TEMPLATES, type previewBody, type TemplateInput } from './schema'

const PG_INT_MAX = 2_147_483_647

export class AiPromptService {
  private readonly repo: AiPromptRepository

  constructor(db: Db) {
    this.repo = new AiPromptRepository(db)
  }

  /** Idempotently insert built-in templates by name (all exceptions are swallowed so the list API is unaffected) */
  private async seedBuiltinTemplates(): Promise<void> {
    let existing: Set<string>
    try {
      existing = new Set(await this.repo.listNames())
    } catch {
      return
    }
    const missing = SEED_TEMPLATES.filter((t) => !existing.has(t.name))
    try {
      await this.repo.insertMany(
        missing.map((t) => ({
          name: t.name,
          category: t.category,
          description: t.description,
          content: t.content,
          variables: variablesValue(t.variables),
          tags: t.tags,
        })),
      )
    } catch {
      /* ignore exceptions such as concurrent duplicate inserts */
    }
  }

  async listTemplates(category: string) {
    await this.seedBuiltinTemplates()
    const items = await this.repo.list(category)
    const data = items.map(aiPromptTemplateToDict)
    return { data, total: data.length }
  }

  /** A template by id; an id beyond int4 can't exist, so it finds nothing */
  async getTemplate(rawId: string): Promise<AiPromptTemplate | null> {
    const id = Number(rawId)
    if (!Number.isSafeInteger(id) || id > PG_INT_MAX) return null
    return this.repo.getById(id)
  }

  async createTemplate(values: TemplateInput) {
    try {
      const row = await this.repo.insert({
        ...values,
        category: values.category ?? 'custom',
        variables: variablesValue(extractVariables(values.content)),
      })
      return aiPromptTemplateToDict(row)
    } catch (err) {
      throw writeError(err)
    }
  }

  async updateTemplate(template: AiPromptTemplate, values: Partial<TemplateInput>) {
    const next = values.category === null ? { ...values, category: 'custom' } : values
    // UPDATE only columns whose value actually changed; with no change, no UPDATE is issued and updated_at stays the same
    const set: AiPromptTemplateUpdate = changedFields(template, next as Partial<AiPromptTemplate>)
    // Variables follow the content
    const variables = extractVariables(values.content ?? template.content)
    if (JSON.stringify(template.variables) !== JSON.stringify(variables)) set.variables = variablesValue(variables)
    if (Object.keys(set).length === 0) return aiPromptTemplateToDict(template)
    try {
      return aiPromptTemplateToDict(await this.repo.update(template.id, set))
    } catch (err) {
      throw writeError(err)
    }
  }

  async deleteTemplate(template: AiPromptTemplate) {
    try {
      await this.repo.delete(template.id)
    } catch (err) {
      throw writeError(err)
    }
    return { message: '删除成功' }
  }

  /** Fill `{{name}}` placeholders; placeholders without a value are listed in undefined_vars */
  preview({ content, variables }: z.output<typeof previewBody>) {
    let result = content
    for (const [key, val] of Object.entries(variables)) {
      const text = val === null || val === undefined ? '' : typeof val === 'object' ? JSON.stringify(val) : String(val)
      result = result.split(`{{${key}}}`).join(text)
    }
    return { preview: result, undefined_vars: findVariables(result) }
  }
}
