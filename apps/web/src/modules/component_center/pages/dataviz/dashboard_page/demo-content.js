// i18n-ignore-file: sample dataset (region names, event records) is demo content, not UI copy.
// Event `type` values are categories shown through StatusBadge, which translates them.

export const PROGRESS_DATA = [
  { label: '华东大区', value: 84 },
  { label: '华南大区', value: 67 },
  { label: '华北大区', value: 72 },
  { label: '华中大区', value: 58 },
  { label: '西南大区', value: 45 },
]

export const RECENT_EVENTS = [
  { id: 1, time: '14:32:10', type: '订单', level: 'success', content: '用户 u_88231 完成支付，金额 ¥2,380', region: '华东' },
  { id: 2, time: '14:28:45', type: '告警', level: 'warning', content: '数据库连接池使用率超过 80%', region: '系统' },
  { id: 3, time: '14:25:12', type: '用户', level: 'info', content: '新用户注册：u_98422，渠道：微信小程序', region: '华南' },
  { id: 4, time: '14:20:01', type: '订单', level: 'success', content: '批量发货完成，共 128 单', region: '华北' },
  { id: 5, time: '14:15:33', type: '系统', level: 'error', content: '第三方支付接口超时，已触发降级', region: '系统' },
  { id: 6, time: '14:10:07', type: '用户', level: 'info', content: '管理员 admin 登录系统', region: '华中' },
]
