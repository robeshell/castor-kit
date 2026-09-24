/**
 * 日志模块 shadow 用例（只读 + 校验失败分支；导入成功路径在 vitest 里验证）。
 *
 * 注意：日志列表会随 shadow 运行本身增长（登录日志、写请求的操作日志），每个用例内 Flask 与 Node 之间
 * 没有写请求，所以同一用例两边看到的数据一致。
 */

import type { ShadowCase } from './types'

export const cases: ShadowCase[] = [
  { name: '登录日志 列表', path: '/api/admin/logs/login?page=1&per_page=5', auth: true },
  { name: '登录日志 筛选', path: '/api/admin/logs/login?username=ADM&status=success&per_page=3', auth: true },
  { name: '登录日志 status 精确匹配', path: '/api/admin/logs/login?status=SUCCESS', auth: true },
  { name: '登录日志 非法分页', path: '/api/admin/logs/login?page=0&per_page=abc', auth: true },
  { name: '登录日志 超出页', path: '/api/admin/logs/login?page=999', auth: true },
  { name: '操作日志 列表', path: '/api/admin/logs/operation?per_page=5', auth: true },
  { name: '操作日志 筛选', path: '/api/admin/logs/operation?username=admin&module=menus&action=update&per_page=3', auth: true },
  { name: '登录日志 导出 未勾选', method: 'POST', path: '/api/admin/logs/login/export', body: { ids: 'x' }, auth: true },
  { name: '登录日志 导出 csv 选中', method: 'POST', path: '/api/admin/logs/login/export', body: { ids: [1, 2, 3, '4'] }, auth: true },
  { name: '登录日志 导出 xlsx 筛选', method: 'POST', path: '/api/admin/logs/login/export', body: { export_mode: 'filtered', filters: { username: 'admin', status: 'failed' }, file_type: 'xlsx' }, auth: true },
  { name: '登录日志 导出 字段', method: 'POST', path: '/api/admin/logs/login/export', body: { ids: [1, 2], fields: ['created_at', 'username', 'nope'] }, auth: true },
  { name: '操作日志 导出 未勾选', method: 'POST', path: '/api/admin/logs/operation/export', body: {}, auth: true },
  { name: '操作日志 导出 csv 选中', method: 'POST', path: '/api/admin/logs/operation/export', body: { ids: [1, 2, 3, 5, 8, 13] }, auth: true },
  { name: '操作日志 导出 csv 筛选', method: 'POST', path: '/api/admin/logs/operation/export', body: { export_mode: 'filtered', filters: { module: 'menus' } }, auth: true },
  { name: '操作日志 导出 xlsx 字段', method: 'POST', path: '/api/admin/logs/operation/export', body: { ids: [1, 2, 3], fields: ['payload', 'status_code', 'target_id'], file_type: 'xlsx' }, auth: true },
  { name: '登录日志 模板 csv', path: '/api/admin/logs/login/template', auth: true },
  { name: '登录日志 模板 xlsx', path: '/api/admin/logs/login/template?file_type=xlsx', auth: true },
  { name: '操作日志 模板 csv', path: '/api/admin/logs/operation/template?file_type=CSV', auth: true },
  { name: '操作日志 模板 xlsx', path: '/api/admin/logs/operation/template?file_type=xlsx', auth: true },
  { name: '登录日志 导入 无文件', method: 'POST', path: '/api/admin/logs/login/import', auth: true },
  { name: '操作日志 导入 无文件', method: 'POST', path: '/api/admin/logs/operation/import', auth: true },
  { name: '未登录 列表', path: '/api/admin/logs/login' },
  { name: 'GET export → 404', path: '/api/admin/logs/login/export', auth: true },
  { name: 'PUT 列表 → 405', method: 'PUT', path: '/api/admin/logs/operation', body: {}, auth: true },
]
