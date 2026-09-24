import type { ShadowCase } from './types'

/**
 * 依赖固定夹具（900201 已发布置顶 / 900202 草稿 / 900203 含逗号引号与公式内容，前缀 ck_test_r2_，seed 见 dicts.ts 的 SHADOW_SEED_SQL）。
 * publish/unpublish/同值编辑是幂等的（无变化时不发 UPDATE，updated_at 不变）。成功新增/删除/导入在 vitest 里验证。
 *
 * 已知保留差异（Flask 缺陷，Node 按本意返回 400）：AnnouncementServiceError 没有 payload 属性，
 * api/announcement.py 的 handle_service_error 在 4xx 分支 `**error.payload` 抛 AttributeError → Flask 500。
 * 受影响用例：「导入 无文件」「新增 缺标题」「新增 标题空白」「编辑 标题空」。
 * 另：xlsx 导出里的空字符串单元格 openpyxl 写成无值单元格、exceljs 写成空串（common/tabular.ts，见「导出 默认 xlsx 全部」）。
 */
export const cases: ShadowCase[] = [
  { name: '列表', path: '/api/admin/announcements', auth: true },
  { name: '列表 search', path: '/api/admin/announcements?search=CK_TEST_R2', auth: true },
  { name: '列表 status', path: '/api/admin/announcements?status=%20draft%20', auth: true },
  { name: '列表 announce_type', path: '/api/admin/announcements?announce_type=update', auth: true },
  { name: '列表 分页', path: '/api/admin/announcements?page=2&per_page=1', auth: true },
  { name: '列表 未登录', path: '/api/admin/announcements' },
  { name: '导出字段', path: '/api/admin/announcements/export-fields', auth: true },
  { name: '导出 默认 xlsx 全部', method: 'POST', path: '/api/admin/announcements/export', body: {}, auth: true },
  { name: '导出 csv 选中', method: 'POST', path: '/api/admin/announcements/export', body: { export_mode: 'selected', ids: [900203, 900201, '900202', 1.5, null], fields: ['title', 'publish_at', 'is_top', 'nope', 'content', 'sort_order'], file_type: 'csv' }, auth: true },
  { name: '导出 csv selected 但 ids 为空 → 全部', method: 'POST', path: '/api/admin/announcements/export', body: { export_mode: ' selected ', ids: [], fields: ['id', 'status'], file_type: 'CSV' }, auth: true },
  { name: '导出 fields 为字符串', method: 'POST', path: '/api/admin/announcements/export', body: { fields: 'title', file_type: 'csv' }, auth: true },
  { name: '导出 fields 为对象', method: 'POST', path: '/api/admin/announcements/export', body: { fields: { title: 1, announce_type: 0 }, file_type: 'csv' }, auth: true },
  { name: '导出 file_type 非法 → xlsx', method: 'POST', path: '/api/admin/announcements/export', body: { fields: ['id'], file_type: 'pdf' }, auth: true },
  { name: '模板 默认 xlsx', path: '/api/admin/announcements/template', auth: true },
  { name: '模板 csv', path: '/api/admin/announcements/template?file_type=csv', auth: true },
  { name: '导入 无文件', method: 'POST', path: '/api/admin/announcements/import', body: {}, auth: true },
  { name: '新增 缺标题', method: 'POST', path: '/api/admin/announcements', body: {}, auth: true },
  { name: '新增 标题空白', method: 'POST', path: '/api/admin/announcements', body: { title: '  ' }, auth: true },
  { name: '新增 标题超长 → 500', method: 'POST', path: '/api/admin/announcements', body: { title: 'x'.repeat(101) }, auth: true },
  { name: '新增 类型超长 → 500', method: 'POST', path: '/api/admin/announcements', body: { title: 'ck_test_r2_x', announce_type: 'x'.repeat(21) }, auth: true },
  { name: '编辑 404', method: 'PUT', path: '/api/admin/announcements/99999999', body: {}, auth: true },
  { name: '编辑 超大 id', method: 'PUT', path: '/api/admin/announcements/99999999999', body: {}, auth: true },
  { name: '编辑 标题空', method: 'PUT', path: '/api/admin/announcements/900202', body: { title: null }, auth: true },
  { name: '编辑 空 body', method: 'PUT', path: '/api/admin/announcements/900202', body: {}, auth: true },
  { name: '编辑 同值', method: 'PUT', path: '/api/admin/announcements/900201', body: { title: ' ck_test_r2_置顶公告 ', content: '内容一', announce_type: 'system', status: 'published', is_top: 1, sort_order: '1', publish_at: '2026-09-21T08:00:00.500' }, auth: true },
  { name: '编辑 publish_at 非法保持原值', method: 'PUT', path: '/api/admin/announcements/900201', body: { publish_at: 'garbage' }, auth: true },
  { name: '编辑 publish_at 非字符串', method: 'PUT', path: '/api/admin/announcements/900201', body: { publish_at: 12345 }, auth: true },
  { name: '编辑 publish_at 带 Z（按会话时区换算）', method: 'PUT', path: '/api/admin/announcements/900203', body: { publish_at: '2026-09-23T10:00:00Z' }, auth: true, ignoreKeys: ['updated_at'] },
  { name: '编辑 publish_at 带偏移', method: 'PUT', path: '/api/admin/announcements/900203', body: { publish_at: '2026-09-23T10:00:00.123-05:30' }, auth: true, ignoreKeys: ['updated_at'] },
  { name: '编辑 publish_at naive', method: 'PUT', path: '/api/admin/announcements/900203', body: { publish_at: '2026-09-23 10:00' }, auth: true, ignoreKeys: ['updated_at'] },
  { name: '编辑 多字段', method: 'PUT', path: '/api/admin/announcements/900203', body: { content: 0, is_top: 'x', sort_order: 2.9, announce_type: 'update' }, auth: true, ignoreKeys: ['updated_at'] },
  { name: '编辑 publish_at 清空 + 状态草稿', method: 'PUT', path: '/api/admin/announcements/900203', body: { publish_at: '', status: 'draft', is_top: null, sort_order: null, content: '=cmd' }, auth: true, ignoreKeys: ['updated_at'] },
  { name: '编辑 announce_type null → 500', method: 'PUT', path: '/api/admin/announcements/900203', body: { announce_type: null }, auth: true },
  { name: '编辑 content 为对象 → 500', method: 'PUT', path: '/api/admin/announcements/900203', body: { content: { a: 1 } }, auth: true },
  { name: '发布 已发布（无变化）', method: 'POST', path: '/api/admin/announcements/900201/publish', auth: true },
  { name: '撤回 草稿（无变化）', method: 'POST', path: '/api/admin/announcements/900202/unpublish', auth: true },
  { name: '发布 草稿（Node 侧为无变化）', method: 'POST', path: '/api/admin/announcements/900202/publish', auth: true },
  { name: '撤回 已发布', method: 'POST', path: '/api/admin/announcements/900202/unpublish', auth: true },
  { name: '编辑 status=published 且 publish_at 已有', method: 'PUT', path: '/api/admin/announcements/900202', body: { status: 'published' }, auth: true },
  { name: '撤回 还原', method: 'POST', path: '/api/admin/announcements/900202/unpublish', auth: true },
  { name: '发布 404', method: 'POST', path: '/api/admin/announcements/99999999/publish', auth: true },
  { name: '撤回 404', method: 'POST', path: '/api/admin/announcements/99999999/unpublish', auth: true },
  { name: '删除 404', method: 'DELETE', path: '/api/admin/announcements/99999999', auth: true },
  { name: '删除 非数字 id', method: 'DELETE', path: '/api/admin/announcements/abc', auth: true },
]
