// i18n-ignore-file: sample dataset (region / department names, log records) is demo content, not UI copy

export const SHARE = [
  { name: '华东', value: 35 },
  { name: '华南', value: 25 },
  { name: '华北', value: 20 },
  { name: '西南', value: 15 },
  { name: '其他', value: 5 },
]

export const PROGRESS_DATA = [
  { label: '研发部', value: 88 },
  { label: '产品部', value: 72 },
  { label: '市场部', value: 61 },
  { label: '运营部', value: 79 },
  { label: '财务部', value: 55 },
]

export const LOG_DATA = [
  { time: '14:32:10', level: 'success', msg: 'API /api/users 响应正常，耗时 42ms' },
  { time: '14:31:58', level: 'warning', msg: 'DB 连接池使用率 78%，接近阈值' },
  { time: '14:31:40', level: 'info', msg: '定时任务 sync_orders 执行完成，同步 320 条' },
  { time: '14:30:22', level: 'success', msg: '用户 admin 登录成功，IP: 192.168.1.10' },
  { time: '14:29:55', level: 'danger', msg: 'Redis 连接超时，已触发重连机制' },
  { time: '14:28:11', level: 'info', msg: '缓存预热完成，命中率提升至 94.3%' },
  { time: '14:27:03', level: 'warning', msg: '第三方短信服务响应慢，P99 > 2s' },
]
