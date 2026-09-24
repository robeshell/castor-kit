import type { ShadowCase } from './types'

const B = '/api/admin/component-center/ai/prompt'

export const cases: ShadowCase[] = [
  { name: '列表', path: `${B}/templates`, auth: true },
  { name: '列表 未登录', path: `${B}/templates` },
  { name: '列表 分类', path: `${B}/templates?category=dev`, auth: true },
  { name: '列表 分类 空格', path: `${B}/templates?category=%20office%20`, auth: true },
  { name: '列表 分类 不存在', path: `${B}/templates?category=nope`, auth: true },

  { name: '新增 空', method: 'POST', path: `${B}/templates`, body: {}, auth: true },
  { name: '新增 空白内容', method: 'POST', path: `${B}/templates`, body: { name: 'x', content: '   ' }, auth: true },
  { name: '新增 is_active 字符串', method: 'POST', path: `${B}/templates`, body: { name: 'x', content: 'y', is_active: 'yes' }, auth: true },
  { name: '新增 is_active 2', method: 'POST', path: `${B}/templates`, body: { name: 'x', content: 'y', is_active: 2 }, auth: true },
  { name: '新增 name 过长', method: 'POST', path: `${B}/templates`, body: { name: 'n'.repeat(121), content: 'y' }, auth: true },

  { name: '编辑 不存在', method: 'PUT', path: `${B}/templates/99999999`, body: {}, auth: true },
  { name: '编辑 超大 id', method: 'PUT', path: `${B}/templates/99999999999`, body: {}, auth: true },
  { name: '编辑 非数字', method: 'PUT', path: `${B}/templates/abc`, body: {}, auth: true },
  { name: '编辑 空名称', method: 'PUT', path: `${B}/templates/1`, body: { name: '' }, auth: true },
  { name: '编辑 空内容', method: 'PUT', path: `${B}/templates/1`, body: { name: '产品需求分析', content: null }, auth: true },
  // Python 的 list(set(...)) 顺序随进程哈希种子变化，Flask 侧可能因变量顺序不同而发 UPDATE → 忽略 updated_at
  {
    name: '编辑 无变化',
    method: 'PUT',
    path: `${B}/templates/1`,
    body: { name: ' 产品需求分析 ', tags: ['产品', ' 需求 ', ''] },
    auth: true,
    ignoreKeys: ['updated_at', 'variables'],
  },
  { name: '删除 不存在', method: 'DELETE', path: `${B}/templates/99999999`, auth: true },

  { name: '预览 空', method: 'POST', path: `${B}/preview`, body: {}, auth: true },
  {
    name: '预览 替换',
    method: 'POST',
    path: `${B}/preview`,
    body: { content: 'a {{x}} {{y}} {{x}} {{中文}} {{z}} {{ w }} {{}}', variables: { x: 1, y: null, '': 'E', b: true, 中文: [1, 'a'] } },
    auth: true,
  },
]
