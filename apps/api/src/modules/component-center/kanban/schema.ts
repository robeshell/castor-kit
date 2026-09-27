/**
 * Kanban page schema layer: request bodies
 */

import { z } from 'zod'
import { field } from '@/common/validation'

export const PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const

export const boardBody = z.object({
  title: field.requiredText('列标题', '列标题不能为空'),
  board_code: field.requiredText('列编码', '列编码不能为空'),
  color: field.text('颜色'),
  sort_order: field.int('排序', 0),
  wip_limit: field.int('WIP 上限', 0),
  is_active: field.bool('启用', true),
})

export type BoardInput = z.output<typeof boardBody>

/** Edit: the column code can't change, so it isn't read */
export const boardUpdateBody = boardBody.omit({ board_code: true })

export const cardBody = z.object({
  board_id: field.id('所属列'),
  title: field.requiredText('卡片标题', '卡片标题不能为空'),
  card_code: field.text('卡片编码'),
  description: field.text('描述'),
  priority: field.choice('优先级', PRIORITIES, 'medium'),
  assignee: field.text('负责人'),
  due_date: field.date('截止日期'),
  tags: field.text('标签'),
  sort_order: field.int('排序', 0),
  is_active: field.bool('启用', true),
})

export type CardInput = z.output<typeof cardBody>

/** Edit: the card code can't change, so it isn't read */
export const cardUpdateBody = cardBody.omit({ card_code: true })

/** One entry of the reorder list: a card and its new column / position */
export const reorderItem = z.object({
  id: field.id('卡片'),
  board_id: field.id('目标列'),
  sort_order: field.int('排序', 0),
})
