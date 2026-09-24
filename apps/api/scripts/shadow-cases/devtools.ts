import type { ShadowCase } from './types'

/**
 * 性能监控。指标数值每次都不同：ignoreKeys 把数值替换掉，只比较键结构（字段名集合）。
 * WebSocket /ws/devtools 不适合 JSON diff，由 vitest 用真实 ws 连接覆盖。
 */
const METRIC_KEYS = ['cpu', 'mem_used', 'mem_total', 'mem_pct', 'disk_used', 'disk_total', 'disk_pct', 'net_sent', 'net_recv', 'ts']

export const cases: ShadowCase[] = [
  { name: 'perf-stats 未登录', path: '/api/admin/component-center/devtools/perf-stats' },
  { name: 'perf-stats 键结构', path: '/api/admin/component-center/devtools/perf-stats', auth: true, ignoreKeys: METRIC_KEYS },
  { name: 'perf-stats POST → 405', method: 'POST', path: '/api/admin/component-center/devtools/perf-stats', body: {}, auth: true },
]
