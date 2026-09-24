/**
 * 依赖 aurastack_t4 里的种子数据（init_stats_* 三行 id 1-3 + 下面这行 id 4，使 avg(amount) 恰为 615500.125，
 * 用来区分 Python round 的银行家舍入与 toFixed）：
 *   insert into stats_items (name,item_code,category,status,amount,quantity,owner,priority,is_active,description,created_at,updated_at)
 *   values ('ck_test_r4_平局','ck_test_r4_tie',NULL,'draft',-0.88,NULL,NULL,NULL,NULL,NULL,'2026-01-02 03:04:05','2026-01-02 03:04:05.5');
 * 写接口用例只触发校验失败或同值更新（不落库）；会在 Flask 侧“先赋值后报错”的用例只带出错字段，
 * 否则 Flask 的操作日志 after_request 会把脏数据一起提交，污染种子。
 */
import type { ShadowCase } from './types'

const B = '/api/admin/component-center/stats-list-page'

export const cases: ShadowCase[] = [
  { name: '统计 /stats（含 avg 精确 .xx5 平局、category 为空）', path: `${B}/stats`, auth: true },
  { name: '统计 未登录', path: `${B}/stats` },
  { name: '统计 POST 405', method: 'POST', path: `${B}/stats`, body: {}, auth: true },
  { name: '列表 默认', path: B, auth: true },
  { name: '列表 分页', path: `${B}?page=2&per_page=2`, auth: true },
  { name: '列表 超页', path: `${B}?page=99&per_page=5`, auth: true },
  { name: '列表 非法分页', path: `${B}?page=abc&per_page=0`, auth: true },
  { name: '列表 search', path: `${B}?search=%E8%AE%A2%E5%8D%95`, auth: true },
  { name: '列表 search owner', path: `${B}?search=%E7%8E%8B`, auth: true },
  { name: '列表 category', path: `${B}?category=order`, auth: true },
  { name: '列表 owner', path: `${B}?owner=%E6%9D%8E`, auth: true },
  { name: '列表 is_active=0', path: `${B}?is_active=0`, auth: true },
  { name: '列表 is_active=启用', path: `${B}?is_active=%E5%90%AF%E7%94%A8`, auth: true },
  { name: '列表 is_active 非法', path: `${B}?is_active=maybe`, auth: true },
  { name: '列表 status', path: `${B}?status=archived`, auth: true },
  { name: '详情', path: `${B}/1`, auth: true },
  { name: '详情 空值行', path: `${B}/4`, auth: true },
  { name: '详情 不存在', path: `${B}/99999999`, auth: true },
  { name: '详情 超大 id', path: `${B}/99999999999`, auth: true },
  { name: '详情 非数字 id', path: `${B}/abc`, auth: true },
  { name: '新增 缺名称', method: 'POST', path: B, body: { item_code: 'x' }, auth: true },
  { name: '新增 缺编码', method: 'POST', path: B, body: { name: 'x', item_code: '  ' }, auth: true },
  { name: '新增 编码重复', method: 'POST', path: B, body: { name: 'x', item_code: 'init_stats_order_east' }, auth: true },
  { name: '新增 状态非法', method: 'POST', path: B, body: { name: 'x', item_code: 'ck_test_r4_never', status: 'bogus' }, auth: true },
  { name: '编辑 不存在', method: 'PUT', path: `${B}/99999999`, body: {}, auth: true },
  { name: '编辑 名称为空', method: 'PUT', path: `${B}/1`, body: { name: ' ' }, auth: true },
  { name: '编辑 编码为空', method: 'PUT', path: `${B}/1`, body: { item_code: null }, auth: true },
  { name: '编辑 编码与他人重复', method: 'PUT', path: `${B}/1`, body: { item_code: 'init_stats_user_rebuy' }, auth: true },
  { name: '编辑 状态非法', method: 'PUT', path: `${B}/1`, body: { status: 'x' }, auth: true },
  { name: '编辑 空 body（不写库，updated_at 不变）', method: 'PUT', path: `${B}/1`, body: {}, auth: true },
  {
    name: '编辑 同值（float==Decimal 相等，不写库）',
    method: 'PUT',
    path: `${B}/1`,
    body: { name: '华东订单中心', item_code: 'init_stats_order_east', category: 'order', status: 'PUBLISHED ', amount: '1265000.5', quantity: '3420', priority: 90.7, is_active: 'yes', owner: '陈晨' },
    auth: true,
  },
  { name: '编辑 非法数值回落原值', method: 'PUT', path: `${B}/2`, body: { amount: 'abc', quantity: [], priority: {}, is_active: 'maybe' }, auth: true },
  { name: '删除 不存在', method: 'DELETE', path: `${B}/99999999`, auth: true },
  { name: '导出 未勾选', method: 'POST', path: `${B}/export`, body: {}, auth: true },
  { name: '导出 ids 非列表', method: 'POST', path: `${B}/export`, body: { ids: { a: 1 } }, auth: true },
  { name: '导出 选中 csv', method: 'POST', path: `${B}/export`, body: { ids: [3, 1, '2', 99999, 1.5, null] }, auth: true },
  { name: '导出 选中 非法 id', method: 'POST', path: `${B}/export`, body: { ids: ['abc'] }, auth: true },
  { name: '导出 选中 bool id', method: 'POST', path: `${B}/export`, body: { ids: [true] }, auth: true },
  { name: '导出 选中 字段', method: 'POST', path: `${B}/export`, body: { ids: [1, 4], fields: ['amount', 'is_active', 'bogus', 'created_at', 'updated_at', 'quantity', 'priority', 'category'] }, auth: true },
  { name: '导出 fields 为 dict', method: 'POST', path: `${B}/export`, body: { ids: [1], fields: { name: 1, amount: 2 } }, auth: true },
  { name: '导出 fields 为字符串', method: 'POST', path: `${B}/export`, body: { ids: [1], fields: 'name' }, auth: true },
  { name: '导出 fields 为数字', method: 'POST', path: `${B}/export`, body: { ids: [1], fields: 5 }, auth: true },
  { name: '导出 fields 含 list', method: 'POST', path: `${B}/export`, body: { ids: [1], fields: [['name']] }, auth: true },
  { name: '导出 筛选 csv', method: 'POST', path: `${B}/export`, body: { export_mode: 'filtered', filters: { status: 'published' } }, auth: true },
  { name: '导出 筛选 全部', method: 'POST', path: `${B}/export`, body: { export_mode: ' filtered ' }, auth: true },
  { name: '导出 筛选 filters 为 list', method: 'POST', path: `${B}/export`, body: { export_mode: 'filtered', filters: [1] }, auth: true },
  { name: '导出 筛选 xlsx', method: 'POST', path: `${B}/export`, body: { export_mode: 'filtered', filters: { is_active: '1' }, file_type: 'xlsx' }, auth: true },
  { name: '导出 xls 回落 csv', method: 'POST', path: `${B}/export`, body: { ids: [1], file_type: 'xls' }, auth: true },
  { name: '导出 GET', path: `${B}/export?fields=name,%20amount,,bogus&search=%E4%B8%AD%E5%BF%83`, auth: true },
  { name: '导出 GET xlsx', path: `${B}/export?file_type=xlsx&is_active=false`, auth: true },
  { name: '模板 csv', path: `${B}/template`, auth: true },
  { name: '模板 xlsx', path: `${B}/template?file_type=XLSX`, auth: true },
  { name: '导入 无文件', method: 'POST', path: `${B}/import`, auth: true },
  { name: '导入 GET 404', path: `${B}/import`, auth: true },
]
