import type { ShadowCase } from './types'

export const cases: ShadowCase[] = [
  { name: 'health', path: '/health' },
  { name: '未登录 me', path: '/api/admin/me' },
  { name: '未知 api', path: '/api/admin/definitely-not-here' },
  { name: 'GET 只有 POST 的路径 → 404', path: '/api/admin/login' },
  { name: '未知 api 的 POST → 405', method: 'POST', path: '/api/admin/definitely-not-here', body: {} },
  { name: 'POST 只有 GET 的路径 → 405', method: 'POST', path: '/api/admin/my-menus', body: {} },
  { name: '错误密码', method: 'POST', path: '/api/admin/login', body: { username: '__shadow_nobody__', password: 'x' } },
  { name: 'me', path: '/api/admin/me', auth: true },
  { name: 'csrf-token', path: '/api/admin/csrf-token', auth: true },
  { name: 'my-menus', path: '/api/admin/my-menus', auth: true },
  { name: '改密缺字段（带 CSRF）', method: 'POST', path: '/api/admin/change-password', body: {}, auth: true },
  { name: '改密缺 CSRF', method: 'POST', path: '/api/admin/change-password', body: {}, auth: true, noCsrf: true },
]
