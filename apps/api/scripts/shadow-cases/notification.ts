import type { ShadowCase } from './types'

/**
 * 依赖固定夹具（900301 全局 / 900302 定向给 admin / 900303 定向给其他用户，前缀 ck_test_r2_，seed 见 dicts.ts 的 SHADOW_SEED_SQL）。
 * 标记已读天然幂等；read-all 的 marked 两边必然不同（先跑的一方已全部标记）。成功新增/删除在 vitest 里验证。
 */
export const cases: ShadowCase[] = [
  { name: '列表', path: '/api/admin/notifications?per_page=5', auth: true },
  { name: '列表 is_read=false', path: '/api/admin/notifications?is_read=false&per_page=3', auth: true },
  { name: '列表 is_read 带空白', path: '/api/admin/notifications?is_read=%20false%20&per_page=3', auth: true },
  { name: '列表 is_read 非法值当 all', path: '/api/admin/notifications?is_read=xx&per_page=3', auth: true },
  { name: '列表 未登录', path: '/api/admin/notifications' },
  { name: '未读数', path: '/api/admin/notifications/unread-count', auth: true },
  { name: '未读数 未登录', path: '/api/admin/notifications/unread-count' },
  { name: '标记已读 全局', method: 'POST', path: '/api/admin/notifications/900301/read', auth: true },
  { name: '标记已读 定向给自己', method: 'POST', path: '/api/admin/notifications/900302/read', auth: true },
  { name: '标记已读 不可见', method: 'POST', path: '/api/admin/notifications/900303/read', auth: true },
  { name: '标记已读 不存在', method: 'POST', path: '/api/admin/notifications/99999999/read', auth: true },
  { name: '标记已读 超大 id', method: 'POST', path: '/api/admin/notifications/99999999999/read', auth: true },
  { name: '标记已读 非数字 id', method: 'POST', path: '/api/admin/notifications/abc/read', auth: true },
  { name: '列表 is_read=true', path: '/api/admin/notifications?is_read=true', auth: true },
  { name: '全部已读', method: 'POST', path: '/api/admin/notifications/read-all', auth: true, ignoreKeys: ['marked'] },
  { name: '全部已读后未读数', path: '/api/admin/notifications/unread-count', auth: true },
  { name: '全部已读 再次', method: 'POST', path: '/api/admin/notifications/read-all', auth: true },
  { name: '列表 已读标记', path: '/api/admin/notifications?per_page=3', auth: true },
  { name: '新增 缺标题', method: 'POST', path: '/api/admin/notifications', body: { content: 'x' }, auth: true },
  { name: '新增 标题空白', method: 'POST', path: '/api/admin/notifications', body: { title: '   ' }, auth: true },
  { name: '新增 标题 false', method: 'POST', path: '/api/admin/notifications', body: { title: false }, auth: true },
  { name: '新增 定向用户不存在 → 500', method: 'POST', path: '/api/admin/notifications', body: { title: 'ck_test_r2_x', is_global: false, user_id: 99999999 }, auth: true },
  { name: '新增 user_id 非法 → 500', method: 'POST', path: '/api/admin/notifications', body: { title: 'ck_test_r2_x', is_global: 0, user_id: 'abc' }, auth: true },
  { name: '新增 标题超长 → 500', method: 'POST', path: '/api/admin/notifications', body: { title: 'x'.repeat(201) }, auth: true },
  { name: '删除 不可见', method: 'DELETE', path: '/api/admin/notifications/900303', auth: true },
  { name: '删除 不存在', method: 'DELETE', path: '/api/admin/notifications/99999999', auth: true },
  { name: '删除 非数字 id', method: 'DELETE', path: '/api/admin/notifications/abc', auth: true },
]
