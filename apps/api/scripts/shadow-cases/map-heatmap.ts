import type { ShadowCase } from './types'

// value / seed 是随机数（randint），只比较结构与 name/lat/lng
export const cases: ShadowCase[] = [
  { name: '热力数据', path: '/api/admin/component-center/dataviz/map-heatmap/data', auth: true, ignoreKeys: ['value', 'seed'] },
  { name: '未登录', path: '/api/admin/component-center/dataviz/map-heatmap/data' },
  { name: 'POST 未注册方法', method: 'POST', path: '/api/admin/component-center/dataviz/map-heatmap/data', body: {}, auth: true },
]
