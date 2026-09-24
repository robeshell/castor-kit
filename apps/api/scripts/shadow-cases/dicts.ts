import type { ShadowCase } from './types'

/**
 * 依赖固定夹具（dicts / notification / announcement 三个用例文件共用）：跑 shadow-diff 前先在同一个库执行
 * 下面的 SHADOW_SEED_SQL（`psql <库> -c "$SQL"` 或 psql -f），重复执行会先清掉再重建；vitest 的
 * cleanupFixture 会删除所有 ck_test_ 用户（连带 900303），所以跑完 vitest 后要重新 seed。
 * 写接口只用幂等或必然失败回滚的用例；成功的新增/删除在 vitest 里验证。
 */
export const SHADOW_SEED_SQL = `
BEGIN;
DELETE FROM dict_types WHERE code LIKE 'ck_test_r2_%';
DELETE FROM announcements WHERE title LIKE 'ck_test_r2_%';
DELETE FROM notifications WHERE title LIKE 'ck_test_r2_%';
DELETE FROM admin_users WHERE username LIKE 'ck_test_r2_%';
INSERT INTO admin_users (id, username, password_hash, created_at) VALUES (900401, 'ck_test_r2_other', 'x', '2026-09-01 00:00:00');
INSERT INTO dict_types (id, name, code, description, sort_order, is_active, created_at, updated_at) VALUES
 (900001, 'ck_test_r2_状态', 'ck_test_r2_status', '测试字典', 1, true, '2026-09-20 10:00:00.12345', '2026-09-20 10:00:00.12345'),
 (900002, 'ck_test_r2_空', 'ck_test_r2_empty', NULL, 2, false, '2026-09-20 11:00:00', '2026-09-20 11:00:00'),
 (900003, 'ck_test_r2_无序', 'ck_test_r2_nosort', NULL, NULL, NULL, NULL, NULL);
INSERT INTO dict_items (id, dict_type_id, label, value, color, sort_order, is_default, is_active, description, created_at, updated_at) VALUES
 (900101, 900001, '启用', '1', 'green', 1, true, true, NULL, '2026-09-20 10:00:01', '2026-09-20 10:00:01'),
 (900102, 900001, '停用', '0', NULL, 2, false, true, '备注,带逗号', '2026-09-20 10:00:02.5', '2026-09-20 10:00:02.5'),
 (900103, 900001, '=公式', '-x', '#fff', 3, false, false, '注入', '2026-09-20 10:00:03', '2026-09-20 10:00:03'),
 (900104, 900003, 'n', 'n', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO announcements (id, title, content, announce_type, status, is_top, sort_order, publish_at, created_at, updated_at) VALUES
 (900201, 'ck_test_r2_置顶公告', '内容一', 'system', 'published', true, 1, '2026-09-21 08:00:00.5', '2026-09-21 07:00:00', '2026-09-21 07:00:00'),
 (900202, 'ck_test_r2_草稿', NULL, 'activity', 'draft', false, 0, NULL, '2026-09-21 07:30:00', '2026-09-21 07:30:00'),
 (900203, 'ck_test_r2_a,b "q"', '=cmd', 'update', 'draft', NULL, NULL, NULL, NULL, NULL);
INSERT INTO notifications (id, title, content, noti_type, link, is_global, user_id, created_at) VALUES
 (900301, 'ck_test_r2_全局', 'c1', 'info', '/admin', true, NULL, '2026-09-22 09:00:00.1'),
 (900302, 'ck_test_r2_给admin', 'c2', 'warning', NULL, false, 2, '2026-09-22 09:00:01'),
 (900303, 'ck_test_r2_给other', 'c3', 'error', NULL, false, 900401, '2026-09-22 09:00:02');
COMMIT;
`

const T = 900001
export const cases: ShadowCase[] = [
  // options
  { name: 'options 缺 codes', path: '/api/admin/dicts/options', auth: true },
  { name: 'options 空白 codes', path: '/api/admin/dicts/options?codes=%20', auth: true },
  { name: 'options 只有逗号', path: '/api/admin/dicts/options?codes=,%20,', auth: true },
  { name: 'options 多 code 去重/停用/不存在', path: '/api/admin/dicts/options?codes=ck_test_r2_status,%20ck_test_r2_empty,nope,ck_test_r2_status,ck_test_r2_nosort', auth: true },
  { name: 'options 未登录', path: '/api/admin/dicts/options?codes=a' },
  // 列表
  { name: '列表 search', path: '/api/admin/dicts?search=ck_test_r2', auth: true },
  { name: '列表 search 大小写', path: '/api/admin/dicts?search=CK_TEST_R2_S', auth: true },
  { name: '列表 is_active=false', path: '/api/admin/dicts?search=ck_test_r2&is_active=false', auth: true },
  { name: '列表 is_active=是', path: '/api/admin/dicts?search=ck_test_r2&is_active=%E6%98%AF', auth: true },
  { name: '列表 is_active 非法', path: '/api/admin/dicts?search=ck_test_r2&is_active=abc', auth: true },
  { name: '列表 分页', path: '/api/admin/dicts?search=ck_test_r2&page=2&per_page=1', auth: true },
  { name: '列表 非法分页', path: '/api/admin/dicts?search=ck_test_r2&page=x&per_page=0', auth: true },
  // 详情
  { name: '详情', path: `/api/admin/dicts/${T}`, auth: true },
  { name: '详情 include_items', path: `/api/admin/dicts/${T}?include_items=true`, auth: true },
  { name: '详情 include_items=yes', path: `/api/admin/dicts/${T}?include_items=yes`, auth: true },
  { name: '详情 include_items=no', path: `/api/admin/dicts/${T}?include_items=no`, auth: true },
  { name: '详情 空值字段', path: '/api/admin/dicts/900003?include_items=1', auth: true },
  { name: '详情 404', path: '/api/admin/dicts/99999999', auth: true },
  { name: '详情 超大 id', path: '/api/admin/dicts/99999999999', auth: true },
  { name: '详情 非数字 id', path: '/api/admin/dicts/abc', auth: true },
  // 字典项列表
  { name: '字典项列表', path: `/api/admin/dicts/${T}/items`, auth: true },
  { name: '字典项列表 search', path: `/api/admin/dicts/${T}/items?search=%E7%94%A8`, auth: true },
  { name: '字典项列表 is_active=0', path: `/api/admin/dicts/${T}/items?is_active=0`, auth: true },
  { name: '字典项列表 404', path: '/api/admin/dicts/99999999/items', auth: true },
  // 导出 / 模板 / 导入
  { name: '导出 csv', path: `/api/admin/dicts/${T}/items/export`, auth: true },
  { name: '导出 xlsx', path: `/api/admin/dicts/${T}/items/export?file_type=XLSX`, auth: true },
  { name: '导出 空字典', path: '/api/admin/dicts/900002/items/export?file_type=csv', auth: true },
  { name: '导出 404', path: '/api/admin/dicts/99999999/items/export', auth: true },
  { name: '模板 csv', path: `/api/admin/dicts/${T}/items/template`, auth: true },
  { name: '模板 xlsx', path: `/api/admin/dicts/${T}/items/template?file_type=xlsx`, auth: true },
  { name: '导入 无文件', method: 'POST', path: `/api/admin/dicts/${T}/items/import`, body: {}, auth: true },
  { name: '导入 404', method: 'POST', path: '/api/admin/dicts/99999999/items/import', body: {}, auth: true },
  // 新增字典（失败分支）
  { name: '新增 缺名称', method: 'POST', path: '/api/admin/dicts', body: { code: 'x' }, auth: true },
  { name: '新增 名称空白', method: 'POST', path: '/api/admin/dicts', body: { name: '   ', code: 'x' }, auth: true },
  { name: '新增 缺编码', method: 'POST', path: '/api/admin/dicts', body: { name: 'x', code: 0 }, auth: true },
  { name: '新增 编码重复', method: 'POST', path: '/api/admin/dicts', body: { name: 'x', code: ' ck_test_r2_status ' }, auth: true },
  { name: '新增 is_active 非布尔 → 500', method: 'POST', path: '/api/admin/dicts', body: { name: 'x', code: 'ck_test_r2_bad', is_active: 'yes' }, auth: true },
  { name: '新增 sort_order 非法 → 500', method: 'POST', path: '/api/admin/dicts', body: { name: 'x', code: 'ck_test_r2_bad', sort_order: 'abc' }, auth: true },
  { name: '新增 description 为对象 → 500', method: 'POST', path: '/api/admin/dicts', body: { name: 'x', code: 'ck_test_r2_bad', description: { a: 1 } }, auth: true },
  { name: '新增 名称超长 → 500', method: 'POST', path: '/api/admin/dicts', body: { name: 'x'.repeat(101), code: 'ck_test_r2_bad' }, auth: true },
  // 编辑字典
  { name: '编辑 404', method: 'PUT', path: '/api/admin/dicts/99999999', body: {}, auth: true },
  { name: '编辑 非数字 id', method: 'PUT', path: '/api/admin/dicts/abc', body: {}, auth: true },
  { name: '编辑 名称空', method: 'PUT', path: '/api/admin/dicts/900002', body: { name: ' ' }, auth: true },
  { name: '编辑 编码空', method: 'PUT', path: '/api/admin/dicts/900002', body: { code: null }, auth: true },
  { name: '编辑 编码重复', method: 'PUT', path: '/api/admin/dicts/900002', body: { code: 'ck_test_r2_status' }, auth: true },
  { name: '编辑 空 body 不改 updated_at', method: 'PUT', path: '/api/admin/dicts/900002', body: {}, auth: true },
  { name: '编辑 同值不改 updated_at', method: 'PUT', path: '/api/admin/dicts/900002', body: { name: 'ck_test_r2_空', code: 'ck_test_r2_empty', sort_order: 2, is_active: 0 }, auth: true },
  { name: '编辑 is_active 非布尔 → 500', method: 'PUT', path: '/api/admin/dicts/900002', body: { is_active: 'yes' }, auth: true },
  { name: '编辑 is_active 同值的 0 不报错', method: 'PUT', path: '/api/admin/dicts/900002', body: { is_active: 0 }, auth: true },
  { name: '编辑 sort_order 小数四舍五入', method: 'PUT', path: '/api/admin/dicts/900002', body: { sort_order: 2.5 }, auth: true, ignoreKeys: ['updated_at'] },
  { name: '编辑 sort_order 还原', method: 'PUT', path: '/api/admin/dicts/900002', body: { sort_order: '2', description: null }, auth: true, ignoreKeys: ['updated_at'] },
  // 删除字典（失败分支）
  { name: '删除 仍有字典项', method: 'DELETE', path: `/api/admin/dicts/${T}`, auth: true },
  { name: '删除 404', method: 'DELETE', path: '/api/admin/dicts/99999999', auth: true },
  // 新增字典项（失败分支）
  { name: '新增项 缺标签', method: 'POST', path: `/api/admin/dicts/${T}/items`, body: { value: 'x' }, auth: true },
  { name: '新增项 缺值', method: 'POST', path: `/api/admin/dicts/${T}/items`, body: { label: 'x', value: '  ' }, auth: true },
  { name: '新增项 值重复', method: 'POST', path: `/api/admin/dicts/${T}/items`, body: { label: 'x', value: ' 1 ' }, auth: true },
  { name: '新增项 is_default 非布尔 → 500 且回滚清默认', method: 'POST', path: `/api/admin/dicts/${T}/items`, body: { label: 'x', value: 'ck_r2_x', is_default: 'yes' }, auth: true },
  { name: '新增项 404', method: 'POST', path: '/api/admin/dicts/99999999/items', body: { label: 'x', value: 'y' }, auth: true },
  { name: '回滚后默认项仍在', path: `/api/admin/dicts/${T}/items`, auth: true },
  // 字典项详情 / 编辑 / 删除
  { name: '项详情', path: '/api/admin/dicts/items/900101', auth: true },
  { name: '项详情 空值字段', path: '/api/admin/dicts/items/900104', auth: true },
  { name: '项详情 404', path: '/api/admin/dicts/items/99999999', auth: true },
  { name: '项编辑 404', method: 'PUT', path: '/api/admin/dicts/items/99999999', body: {}, auth: true },
  { name: '项编辑 类型不存在', method: 'PUT', path: '/api/admin/dicts/items/900102', body: { dict_type_id: 99999999 }, auth: true },
  { name: '项编辑 类型 null', method: 'PUT', path: '/api/admin/dicts/items/900102', body: { dict_type_id: null }, auth: true },
  { name: '项编辑 类型小数', method: 'PUT', path: '/api/admin/dicts/items/900102', body: { dict_type_id: 1.5 }, auth: true },
  { name: '项编辑 值空', method: 'PUT', path: '/api/admin/dicts/items/900102', body: { value: null }, auth: true },
  { name: '项编辑 值重复', method: 'PUT', path: '/api/admin/dicts/items/900102', body: { value: '1' }, auth: true },
  { name: '项编辑 标签空', method: 'PUT', path: '/api/admin/dicts/items/900102', body: { label: '' }, auth: true },
  { name: '项编辑 空 body', method: 'PUT', path: '/api/admin/dicts/items/900102', body: {}, auth: true },
  { name: '项编辑 同值', method: 'PUT', path: '/api/admin/dicts/items/900102', body: { label: '停用', value: '0', sort_order: 2, is_active: true, is_default: false, color: null }, auth: true },
  { name: '项编辑 is_active 非布尔 → 500', method: 'PUT', path: '/api/admin/dicts/items/900102', body: { is_active: 'no' }, auth: true },
  { name: '项编辑 color 为 bool', method: 'PUT', path: '/api/admin/dicts/items/900102', body: { color: true, sort_order: 1.5 }, auth: true, ignoreKeys: ['updated_at'] },
  { name: '项编辑 color 为数组', method: 'PUT', path: '/api/admin/dicts/items/900102', body: { color: ['a', 'b c'] }, auth: true, ignoreKeys: ['updated_at'] },
  { name: '项编辑 还原', method: 'PUT', path: '/api/admin/dicts/items/900102', body: { color: null, sort_order: 2 }, auth: true, ignoreKeys: ['updated_at'] },
  { name: '项编辑 dict_type_id 字符串', method: 'PUT', path: '/api/admin/dicts/items/900102', body: { dict_type_id: '900001' }, auth: true, ignoreKeys: ['updated_at'] },
  { name: '项删除 404', method: 'DELETE', path: '/api/admin/dicts/items/99999999', auth: true },
]
