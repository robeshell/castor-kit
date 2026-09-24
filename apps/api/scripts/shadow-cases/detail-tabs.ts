import type { ShadowCase } from './types'

const B = '/api/admin/component-center/detail-tabs'
const W = ['updated_at']

export const cases: ShadowCase[] = [
  { name: '成员列表', path: `${B}/members`, auth: true },
  { name: '成员列表 search 部门', path: `${B}/members?search=研发`, auth: true },
  { name: '成员列表 search 空白', path: `${B}/members?search=%20%20`, auth: true },
  { name: '成员列表 search 通配', path: `${B}/members?search=%25`, auth: true },
  { name: '成员列表 search 无结果', path: `${B}/members?search=__nope__`, auth: true },
  { name: '成员详情', path: `${B}/members/2`, auth: true },
  { name: '成员详情 不存在', path: `${B}/members/99999999`, auth: true },
  { name: '成员详情 超大 id', path: `${B}/members/99999999999`, auth: true },
  { name: '成员详情 非数字', path: `${B}/members/abc`, auth: true },
  { name: '新建 缺姓名', method: 'POST', path: `${B}/members`, body: { department: 'x' }, auth: true },
  { name: '新建 姓名空白', method: 'POST', path: `${B}/members`, body: { name: ' ' }, auth: true },
  { name: '编辑 不存在', method: 'PUT', path: `${B}/members/99999999`, body: {}, auth: true },
  { name: '编辑 姓名清空', method: 'PUT', path: `${B}/members/2`, body: { name: null }, auth: true },
  { name: '编辑 空 body（无变化）', method: 'PUT', path: `${B}/members/2`, body: {}, auth: true },
  {
    name: '编辑 同值（无变化）',
    method: 'PUT',
    path: `${B}/members/2`,
    body: { name: '李娜', status: 'active', join_date: '2022-06-01', sort_order: 1.9, is_active: null, avatar_color: '#FF7D00 ' },
    auth: true,
  },
  { name: '编辑 status 非法 + 日期周格式', method: 'PUT', path: `${B}/members/2`, body: { status: 'gone', join_date: '2022W223' }, auth: true, ignoreKeys: W },
  { name: '编辑 is_active 字符串', method: 'PUT', path: `${B}/members/2`, body: { is_active: '启用', phone: '' }, auth: true, ignoreKeys: W },
  {
    name: '编辑 恢复',
    method: 'PUT',
    path: `${B}/members/2`,
    body: { status: 'active', join_date: '2022-06-01', is_active: true, phone: '13800001002' },
    auth: true,
    ignoreKeys: W,
  },
  { name: '删除 不存在', method: 'DELETE', path: `${B}/members/99999999`, auth: true },
  { name: 'PATCH 未注册方法', method: 'PATCH', path: `${B}/members/2`, body: {}, auth: true },
]
