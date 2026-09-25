/**
 * AI prompt workshop schema layer (pure functions: request-body validation, template variable extraction, etc.)
 */

import { z } from 'zod'
import { pyStr } from '@/common/py'

/** Loose request-body validation: any keys, all optional; normalization happens in the service */
export const aiPromptBodySchema = z.record(z.string(), z.unknown()).nullish()

/** Matches `{{varName}}`: the name consists of Unicode letters, digits and underscores */
export const VARIABLE_RE = /\{\{([\p{L}\p{N}_]+)\}\}/gu

export function findVariables(text: string): string[] {
  return [...text.matchAll(VARIABLE_RE)].map((m) => m[1]!)
}

/**
 * Extract template variables, deduplicated, in first-occurrence order so the result is stable.
 */
export function extractVariables(content: string): string[] {
  return [...new Set(findVariables(content))]
}

/** tags accepts a list or a comma-separated string; always stored as a comma-separated string */
export function normalizeTags(raw: unknown): string {
  if (raw === null || raw === undefined) return ''
  if (Array.isArray(raw)) {
    return raw
      .map((t) => pyStr(t).trim())
      .filter(Boolean)
      .join(',')
  }
  return pyStr(raw)
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
    .join(',')
}

/** Built-in template seeds (backfilled by name on every list API call) */
export const SEED_TEMPLATES = [
  {
    name: '产品需求分析',
    category: 'product',
    description: '将原始需求整理为用户故事、验收标准与优先级建议',
    content: '你是一位资深产品经理。请分析以下需求，给出用户故事、验收标准和优先级建议。\n\n需求描述：{{requirement}}\n\n目标用户：{{target_users}}\n\n请按以下格式输出：\n1. 用户故事\n2. 验收标准\n3. 优先级（P0/P1/P2）\n4. 技术风险',
    variables: ['requirement', 'target_users'],
    tags: '产品,需求',
  },
  {
    name: '代码 Review',
    category: 'dev',
    description: '从性能、安全性、可读性和最佳实践角度审查代码',
    content: '请对以下代码进行 Code Review，重点关注：性能、安全性、可读性和最佳实践。\n\n语言：{{language}}\n\n代码：\n```\n{{code}}\n```\n\n请给出具体的改进建议和示例。',
    variables: ['language', 'code'],
    tags: '开发,Review',
  },
  {
    name: '市场文案生成',
    category: 'marketing',
    description: '为产品生成标题、卖点与 CTA 文案',
    content: '你是一位专业文案策划师。请为以下产品撰写吸引用户的市场文案。\n\n产品名称：{{product_name}}\n产品特点：{{features}}\n目标受众：{{audience}}\n文案风格：{{tone}}\n\n请生成：1) 主标题  2) 副标题  3) 核心卖点（3条）  4) CTA 按钮文字',
    variables: ['product_name', 'features', 'audience', 'tone'],
    tags: '营销,文案',
  },
  {
    name: '数据分析报告',
    category: 'data',
    description: '基于数据生成摘要、趋势与改进建议',
    content: '请根据以下数据，生成一份专业的分析报告。\n\n数据时间范围：{{date_range}}\n数据来源：{{data_source}}\n关键指标：{{metrics}}\n\n请包含：摘要、趋势分析、异常点说明、改进建议。',
    variables: ['date_range', 'data_source', 'metrics'],
    tags: '数据,报告',
  },
  {
    name: '会议纪要整理',
    category: 'office',
    description: '把会议记录整理成规范纪要并给出行动计划',
    content: '请将以下会议记录整理成规范的会议纪要。\n\n会议主题：{{meeting_topic}}\n参会人员：{{participants}}\n会议时间：{{meeting_time}}\n\n原始记录：\n{{raw_notes}}\n\n输出格式：1) 会议背景  2) 讨论要点  3) 决议事项  4) 行动计划（负责人+截止日期）',
    variables: ['meeting_topic', 'participants', 'meeting_time', 'raw_notes'],
    tags: '办公,效率',
  },
]
