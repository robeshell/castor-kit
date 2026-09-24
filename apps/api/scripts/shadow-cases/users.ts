import type { ShadowCase } from './types'

export const cases: ShadowCase[] = [
  { name: '列表', path: '/api/admin/users?page=1&per_page=5', auth: true },
  { name: '列表 search', path: '/api/admin/users?search=adm', auth: true },
  { name: '列表 非法分页', path: '/api/admin/users?page=abc&per_page=0', auth: true },
  { name: '导出 未勾选', method: 'POST', path: '/api/admin/users/export', body: {}, auth: true },
  { name: '导出 csv 筛选', method: 'POST', path: '/api/admin/users/export', body: { export_mode: 'filtered', filters: { search: 'admin' } }, auth: true },
  { name: '导出 xlsx 选中', method: 'POST', path: '/api/admin/users/export', body: { ids: [2], fields: ['username', 'created_at'], file_type: 'xlsx' }, auth: true },
  { name: '模板 csv', path: '/api/admin/users/template', auth: true },
  { name: '新增 缺字段', method: 'POST', path: '/api/admin/users', body: { username: 'x' }, auth: true },
  { name: '新增 无效角色', method: 'POST', path: '/api/admin/users', body: { username: '__shadow_u__', password: 'x', role_ids: [999999] }, auth: true },
  { name: '编辑 不存在', method: 'PUT', path: '/api/admin/users/99999999', body: {}, auth: true },
  { name: '编辑 非数字 id', method: 'PUT', path: '/api/admin/users/abc', body: {}, auth: true },
  { name: '删除 自己', method: 'DELETE', path: '/api/admin/users/2', auth: true },
  { name: '导入 无文件', method: 'POST', path: '/api/admin/users/import', auth: true },
]
