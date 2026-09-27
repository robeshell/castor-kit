/**
 * Announcement management schema layer: request bodies and import / export field mapping
 */

import { z } from 'zod'
import { formatDateTime } from '@/common/serialize'
import { field } from '@/common/validation'
import type { Announcement } from '@/db/schema'

export const EXPORT_FIELD_MAP: Record<string, [string, (item: Announcement) => unknown]> = {
  id: ['ID', (item) => item.id],
  title: ['标题', (item) => item.title || ''],
  announce_type: ['公告类型', (item) => item.announce_type || ''],
  status: ['状态', (item) => item.status || ''],
  is_top: ['是否置顶', (item) => (item.is_top ? '是' : '否')],
  sort_order: ['排序权重', (item) => item.sort_order ?? 0],
  content: ['内容', (item) => item.content || ''],
  publish_at: ['发布时间', (item) => formatDateTime(item.publish_at)],
  created_at: ['创建时间', (item) => formatDateTime(item.created_at)],
}

export const IMPORT_HEADER_MAP: Record<string, string> = {
  标题: 'title',
  公告类型: 'announce_type',
  状态: 'status',
  是否置顶: 'is_top',
  排序权重: 'sort_order',
  内容: 'content',
  title: 'title',
  announce_type: 'announce_type',
  status: 'status',
  is_top: 'is_top',
  sort_order: 'sort_order',
  content: 'content',
}

export const TEMPLATE_HEADERS = ['标题', '公告类型', '状态', '是否置顶', '排序权重', '内容']
export const TEMPLATE_ROWS = [['系统维护公告', 'system', 'draft', '否', '0', '系统将于今晚进行维护，请提前保存工作。']]

export const ANNOUNCE_TYPES = ['system', 'activity', 'update'] as const
export const STATUSES = ['draft', 'published'] as const

export const announcementBody = z.object({
  title: field.requiredText('标题', '标题不能为空'),
  content: field.text('内容'),
  announce_type: field.choice('公告类型', ANNOUNCE_TYPES, 'system', '公告类型只能是 system、activity 或 update'),
  status: field.choice('状态', STATUSES, 'draft', '状态只能是 draft 或 published'),
  is_top: field.bool('是否置顶', false),
  sort_order: field.int('排序权重', 0),
  publish_at: field.dateTime('发布时间'),
})

export type AnnouncementInput = z.output<typeof announcementBody>

export const announcementExportBody = z.object({
  fields: field.textList('导出字段'),
  ids: field.ids('导出记录'),
  export_mode: field.choice('导出范围', ['all', 'selected'], 'all'),
  file_type: field.text('文件类型'),
})
