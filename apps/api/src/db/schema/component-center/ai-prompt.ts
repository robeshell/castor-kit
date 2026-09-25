/**
 * ai_prompt_templates
 *
 * 由 drizzle-kit pull 生成后整理。`$default` / `createdAt()` / `updatedAt()` 只在运行时生效，不进 DDL。
 */

import { boolean, index, json, pgTable, serial, text, varchar } from 'drizzle-orm/pg-core'
import { toIso } from '@/common/serialize'
import { createdAt, updatedAt } from '../columns'

export const ai_prompt_templates = pgTable('ai_prompt_templates', {
  id: serial().primaryKey().notNull(),
  name: varchar({ length: 120 }).notNull(),
  category: varchar({ length: 50 }).default('custom'),
  description: text(),
  content: text().notNull(),
  /** 变量定义：JSON 数组，例如 ["requirement", "target_users"]（应用侧默认空数组） */
  variables: json().$default(() => []),
  /** 标签：逗号分隔字符串，例如 "产品,需求" */
  tags: varchar({ length: 500 }).default(''),
  is_active: boolean().default(true),
  created_at: createdAt(),
  updated_at: updatedAt(),
}, (table) => [
  index('ix_ai_prompt_templates_category').using('btree', table.category),
  index('ix_ai_prompt_templates_name').using('btree', table.name),
])

export type AiPromptTemplate = typeof ai_prompt_templates.$inferSelect

export function aiPromptTemplateToDict(template: AiPromptTemplate) {
  const tagList = template.tags
    ? template.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
    : []
  return {
    id: template.id,
    name: template.name,
    category: template.category || 'custom',
    description: template.description,
    content: template.content,
    variables: Array.isArray(template.variables) ? template.variables : [],
    tags: tagList,
    is_active: template.is_active !== null ? template.is_active : true,
    created_at: toIso(template.created_at),
    updated_at: toIso(template.updated_at),
  }
}
