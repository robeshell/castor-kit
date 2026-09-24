import type { ShadowCase } from './types'

const B = '/api/admin/component-center/gantt'
const W = ['updated_at']

export const cases: ShadowCase[] = [
  { name: '任务列表', path: `${B}/tasks`, auth: true },
  { name: '任务列表 status', path: `${B}/tasks?status=completed`, auth: true },
  { name: '任务列表 priority', path: `${B}/tasks?priority=high`, auth: true },
  { name: '任务列表 status+priority', path: `${B}/tasks?status=%20not_started%20&priority=critical`, auth: true },
  { name: '任务列表 无匹配', path: `${B}/tasks?status=bogus`, auth: true },
  { name: '新建 缺标题', method: 'POST', path: `${B}/tasks`, body: {}, auth: true },
  { name: '新建 缺开始日期', method: 'POST', path: `${B}/tasks`, body: { title: 'x', end_date: '2024-01-01' }, auth: true },
  { name: '新建 开始日期非法', method: 'POST', path: `${B}/tasks`, body: { title: 'x', start_date: '2024-13-01', end_date: '2024-01-01' }, auth: true },
  { name: '新建 缺结束日期', method: 'POST', path: `${B}/tasks`, body: { title: 'x', start_date: '2024-01-01' }, auth: true },
  { name: '编辑 不存在', method: 'PUT', path: `${B}/tasks/99999999`, body: {}, auth: true },
  { name: '编辑 标题清空', method: 'PUT', path: `${B}/tasks/3`, body: { title: '' }, auth: true },
  { name: '编辑 空 body（无变化）', method: 'PUT', path: `${B}/tasks/3`, body: {}, auth: true },
  {
    name: '编辑 同值（无变化）',
    method: 'PUT',
    path: `${B}/tasks/3`,
    body: { progress: 150, task_type: 'task', priority: '', status: 'completed', color: null, start_date: '20260111' },
    auth: true,
  },
  { name: '编辑 开始日期置空 → 500', method: 'PUT', path: `${B}/tasks/3`, body: { start_date: 'bad' }, auth: true },
  { name: '编辑 progress 负数 + 枚举非法', method: 'PUT', path: `${B}/tasks/3`, body: { progress: '-5', task_type: 'epic', status: 'x' }, auth: true, ignoreKeys: W },
  {
    name: '编辑 恢复',
    method: 'PUT',
    path: `${B}/tasks/3`,
    body: { progress: 100, task_type: 'task', status: 'completed' },
    auth: true,
    ignoreKeys: W,
  },
  { name: '删除 不存在', method: 'DELETE', path: `${B}/tasks/99999999`, auth: true },
]
