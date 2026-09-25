/**
 * AI prompt template service layer
 *
 * Save/delete failures return a 500 with a specific message (`保存模板失败，请稍后重试`), but the global error handler
 * replaces the message of ServiceError(>=500) with a generic one, so these errors are thrown as AiPromptPersistError and returned as-is by routes.
 */

import { ServiceError } from '@/common/errors'
import { isPlainObject, pyStr, pyStrOrEmpty, pyTruthy } from '@/common/py'
import type { Db } from '@/db/client'
import { aiPromptTemplateToDict, type AiPromptTemplate } from '@/db/schema'
import { AiPromptRepository, variablesValue, type AiPromptTemplateUpdate } from './repository'
import { extractVariables, findVariables, normalizeTags, SEED_TEMPLATES } from './schema'

type Data = Record<string, unknown>

const PG_INT_MAX = 2_147_483_647
export const SAVE_FAILED = '保存模板失败，请稍后重试'
export const DELETE_FAILED = '删除模板失败，请稍后重试'

/** 500 with a specific message (returned as-is by routes, bypassing the global generic message) */
export class AiPromptPersistError extends Error {}

/** Get a value trimmed of surrounding whitespace: falsy → fallback; truthy non-string → generic 500 */
function strictStripOr(value: unknown, fallback: string): string {
  const raw = pyTruthy(value) ? value : fallback
  if (typeof raw !== 'string') throw new ServiceError(`'${typeof raw}' object has no attribute 'strip'`, 500)
  return raw.trim()
}

/**
 * Strict boolean: only null/true/false are accepted (1/0 are accepted too);
 * any other value is treated as a save failure and returns SAVE_FAILED.
 */
function strictBool(value: unknown): boolean | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'boolean') return value
  if (value === 1 || value === 0) return value === 1
  throw new AiPromptPersistError(SAVE_FAILED)
}

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

  /** `db.session.get(AiPromptTemplate, id)`: an id beyond int4 doesn't error in PG comparisons, it just finds nothing */
  async getTemplate(rawId: string): Promise<AiPromptTemplate | null> {
    const id = Number(rawId)
    if (!Number.isSafeInteger(id) || id > PG_INT_MAX) return null
    return this.repo.getById(id)
  }

  async createTemplate(data: Data) {
    const name = strictStripOr(data.name, '')
    const content = strictStripOr(data.content, '')
    if (!name || !content) throw new ServiceError('模板名称和内容不能为空', 400)

    const variables = extractVariables(content)
    const category = strictStripOr(data.category, 'custom') || 'custom'
    const description = strictStripOr(data.description, '') || null
    const tags = normalizeTags(data.tags)
    const isActive = strictBool('is_active' in data ? data.is_active : true)

    try {
      const row = await this.repo.insert({
        name,
        category,
        description,
        content,
        variables: variablesValue(variables),
        tags,
        // None is left out of the INSERT so the default True applies
        ...(isActive === null ? {} : { is_active: isActive }),
      })
      return aiPromptTemplateToDict(row)
    } catch {
      throw new AiPromptPersistError(SAVE_FAILED)
    }
  }

  async updateTemplate(template: AiPromptTemplate, data: Data) {
    const next: Record<string, unknown> = {}
    if ('name' in data) {
      const name = pyStrOrEmpty(data.name)
      if (!name) throw new ServiceError('模板名称不能为空', 400)
      next.name = name
    }
    if ('category' in data) next.category = pyStr(pyTruthy(data.category) ? data.category : 'custom').trim() || 'custom'
    if ('description' in data) next.description = pyStrOrEmpty(data.description) || null
    if ('content' in data) {
      const content = pyStrOrEmpty(data.content)
      if (!content) throw new ServiceError('模板内容不能为空', 400)
      next.content = content
    }
    if ('tags' in data) next.tags = normalizeTags(data.tags)
    if ('is_active' in data) next.is_active = pyTruthy(data.is_active)
    // Re-extract variables from the content after saving
    const variables = extractVariables((next.content as string | undefined) ?? template.content)

    // UPDATE only columns whose value actually changed; with no change, no UPDATE is issued and updated_at stays the same
    const set: AiPromptTemplateUpdate = {}
    const current = template as unknown as Record<string, unknown>
    for (const [key, value] of Object.entries(next)) {
      if (current[key] !== value) (set as Record<string, unknown>)[key] = value
    }
    if (JSON.stringify(template.variables) !== JSON.stringify(variables)) set.variables = variablesValue(variables)
    if (Object.keys(set).length === 0) return aiPromptTemplateToDict(template)

    try {
      return aiPromptTemplateToDict(await this.repo.update(template.id, set))
    } catch {
      throw new AiPromptPersistError(SAVE_FAILED)
    }
  }

  async deleteTemplate(template: AiPromptTemplate) {
    try {
      await this.repo.delete(template.id)
    } catch {
      throw new AiPromptPersistError(DELETE_FAILED)
    }
    return { message: '删除成功' }
  }

  preview(data: Data) {
    const content = pyTruthy(data.content) ? data.content : ''
    const variables = pyTruthy(data.variables) ? data.variables : {}
    if (!isPlainObject(variables)) throw new ServiceError("'variables' has no attribute 'items'", 500)
    if (typeof content !== 'string') throw new ServiceError("'content' is not a string", 500)
    let result = content
    for (const [key, val] of Object.entries(variables)) {
      result = result.split(`{{${key}}}`).join(pyStr(val))
    }
    return { preview: result, undefined_vars: findVariables(result) }
  }
}
