import type { ShadowCase } from './types'

const B = '/api/admin/component-center/kanban'
const W = ['updated_at']

export const cases: ShadowCase[] = [
  { name: '列列表（含卡片）', path: `${B}/boards`, auth: true },
  { name: '未登录', path: `${B}/boards` },
  // 看板列 新建校验
  { name: '新建列 缺标题', method: 'POST', path: `${B}/boards`, body: {}, auth: true },
  { name: '新建列 标题空白', method: 'POST', path: `${B}/boards`, body: { title: '  ', board_code: 'x' }, auth: true },
  { name: '新建列 缺编码', method: 'POST', path: `${B}/boards`, body: { title: 'x' }, auth: true },
  { name: '新建列 编码重复', method: 'POST', path: `${B}/boards`, body: { title: 'x', board_code: ' todo ' }, auth: true },
  // 看板列 编辑
  { name: '编辑列 不存在', method: 'PUT', path: `${B}/boards/99999999`, body: {}, auth: true },
  { name: '编辑列 超大 id', method: 'PUT', path: `${B}/boards/99999999999`, body: {}, auth: true },
  { name: '编辑列 非数字 id', method: 'PUT', path: `${B}/boards/abc`, body: {}, auth: true },
  { name: '编辑列 GET 未注册方法', path: `${B}/boards/1`, auth: true },
  { name: '编辑列 标题清空', method: 'PUT', path: `${B}/boards/1`, body: { title: '' }, auth: true },
  { name: '编辑列 空 body（无变化）', method: 'PUT', path: `${B}/boards/1`, body: {}, auth: true },
  {
    name: '编辑列 同值（无变化）',
    method: 'PUT',
    path: `${B}/boards/1`,
    body: { title: ' 待办 ', color: '#8c8c8c', sort_order: 'abc', wip_limit: null, is_active: true },
    auth: true,
  },
  { name: '删除列 不存在', method: 'DELETE', path: `${B}/boards/99999999`, auth: true },
  // 卡片 新建校验
  { name: '新建卡片 缺标题', method: 'POST', path: `${B}/cards`, body: { board_id: 1 }, auth: true },
  { name: '新建卡片 缺列', method: 'POST', path: `${B}/cards`, body: { title: 'x' }, auth: true },
  { name: '新建卡片 列 id 非数字', method: 'POST', path: `${B}/cards`, body: { title: 'x', board_id: 'abc' }, auth: true },
  { name: '新建卡片 列不存在 → 404', method: 'POST', path: `${B}/cards`, body: { title: 'x', board_id: 99999999 }, auth: true },
  { name: '新建卡片 列超大 id → 404', method: 'POST', path: `${B}/cards`, body: { title: 'x', board_id: 99999999999 }, auth: true },
  // 卡片 编辑
  { name: '编辑卡片 不存在', method: 'PUT', path: `${B}/cards/99999999`, body: {}, auth: true },
  { name: '编辑卡片 标题清空', method: 'PUT', path: `${B}/cards/3`, body: { title: 0 }, auth: true },
  { name: '编辑卡片 目标列不存在 → 404', method: 'PUT', path: `${B}/cards/3`, body: { board_id: 99999999 }, auth: true },
  { name: '编辑卡片 空 body（无变化）', method: 'PUT', path: `${B}/cards/3`, body: {}, auth: true },
  {
    name: '编辑卡片 同值（无变化）',
    method: 'PUT',
    path: `${B}/cards/3`,
    body: { board_id: 0, priority: 'low', sort_order: '2', tags: ' Bug,移动端 ', description: '', due_date: 'bad' },
    auth: true,
  },
  { name: '编辑卡片 due_date YYYYMMDD+尾巴', method: 'PUT', path: `${B}/cards/3`, body: { due_date: '20240101ab' }, auth: true, ignoreKeys: W },
  { name: '编辑卡片 due_date ISO 周', method: 'PUT', path: `${B}/cards/3`, body: { due_date: '2020-W53-1' }, auth: true, ignoreKeys: W },
  { name: '编辑卡片 due_date ISO 周无日', method: 'PUT', path: `${B}/cards/3`, body: { due_date: '2024W011' }, auth: true, ignoreKeys: W },
  { name: '编辑卡片 due_date 整数', method: 'PUT', path: `${B}/cards/3`, body: { due_date: 20240315 }, auth: true, ignoreKeys: W },
  { name: '编辑卡片 due_date 带时间', method: 'PUT', path: `${B}/cards/3`, body: { due_date: '2024-05-06T12:00:00Z' }, auth: true, ignoreKeys: W },
  { name: '编辑卡片 due_date 非法日', method: 'PUT', path: `${B}/cards/3`, body: { due_date: '2024-02-30' }, auth: true, ignoreKeys: W },
  { name: '编辑卡片 priority 非法', method: 'PUT', path: `${B}/cards/3`, body: { priority: 'bogus', is_active: 'yes' }, auth: true, ignoreKeys: W },
  { name: '编辑卡片 恢复', method: 'PUT', path: `${B}/cards/3`, body: { priority: 'low', is_active: true, due_date: null }, auth: true, ignoreKeys: W },
  { name: '删除卡片 不存在', method: 'DELETE', path: `${B}/cards/99999999`, auth: true },
  // 排序
  { name: '排序 空对象 → []', method: 'PUT', path: `${B}/cards/reorder`, body: {}, auth: true },
  { name: '排序 非数组', method: 'PUT', path: `${B}/cards/reorder`, body: { a: 1 }, auth: true },
  { name: '排序 字符串', method: 'PUT', path: `${B}/cards/reorder`, body: 'abc', auth: true },
  { name: '排序 元素非对象 → 500', method: 'PUT', path: `${B}/cards/reorder`, body: [1], auth: true },
  { name: '排序 目标列不存在', method: 'PUT', path: `${B}/cards/reorder`, body: [{ id: 1, board_id: 99999999, sort_order: 0 }], auth: true },
  { name: '排序 目标列超大 id', method: 'PUT', path: `${B}/cards/reorder`, body: [{ id: 1, board_id: 99999999999 }], auth: true },
  {
    name: '排序 同值（无变化）',
    method: 'PUT',
    path: `${B}/cards/reorder`,
    body: [{ id: 1, board_id: 1, sort_order: 0 }, { id: 2, board_id: '1', sort_order: '1' }, { id: 99999999, board_id: 2 }, { id: 'x' }],
    auth: true,
  },
  { name: '排序后列表不变', path: `${B}/boards`, auth: true },
]
