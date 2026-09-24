import type { ShadowCase } from './types'

/** 只读统计；GET 不写 operation_logs，两边连续调用计数一致 */
export const cases: ShadowCase[] = [
  { name: '统计', path: '/api/admin/dashboard/stats', auth: true },
  { name: '统计 未登录', path: '/api/admin/dashboard/stats' },
  { name: '统计 POST 不允许', method: 'POST', path: '/api/admin/dashboard/stats', auth: true },
]
