/**
 * Advanced table page schema layer: request bodies
 */

import { z } from 'zod'
import { field } from '@/common/validation'

export const ROW_STATUSES = ['draft', 'published', 'archived'] as const
export const CATEGORIES = ['general', 'order', 'user', 'finance', 'risk'] as const
export const STATUS_ERROR = '状态仅支持 draft/published/archived'

const INT4 = { min: -2_147_483_648, max: 2_147_483_647 }

export const rowBody = z.object({
  name: field.requiredText('名称', '名称不能为空'),
  row_code: field.requiredText('编码', '编码不能为空'),
  category: field.choice('分类', CATEGORIES, 'general'),
  owner: field.text('负责人'),
  status: field.choice('状态', ROW_STATUSES, 'draft', STATUS_ERROR),
  priority: field.int('优先级', 0),
  progress: field.int('进度', 0),
  score: field.number('评分', 0),
  tags: field.text('标签'),
  is_active: field.bool('启用', true),
  is_pinned: field.bool('置顶', false),
  due_date: field.date('截止日期'),
  sort_order: field.int('排序', 0, INT4),
  remark: field.text('备注'),
})

export type RowInput = z.output<typeof rowBody>

/** One entry of the reorder list */
export const reorderItem = z.object({ id: field.id('记录'), sort_order: field.int('排序', 0, INT4) })

/** Batch update: the selected rows and the fields to set (only the fields present are written) */
export const batchUpdateBody = rowBody.pick({ status: true, owner: true, is_active: true, is_pinned: true, priority: true }).extend({ ids: field.ids('记录') })

export const batchDeleteBody = z.object({ ids: field.ids('记录') })
