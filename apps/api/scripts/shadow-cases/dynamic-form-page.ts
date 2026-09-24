/**
 * 依赖 aurastack_t4 里的种子数据（记录 id 1-2；记录 1 有 3 个字段，其中两个 sort_order 相同）：
 *   insert into dynamic_form_records (title,record_code,category,status,owner,priority,is_active,description,created_at,updated_at) values
 *    ('ck_test_r4_表单','ck_test_r4_form','config','published','ck_owner',3,true,'描述','2026-01-02 03:04:05','2026-01-02 03:04:05'),
 *    ('ck_test_r4_空表单','ck_test_r4_form2',NULL,'draft',NULL,NULL,NULL,NULL,NULL,NULL);
 *   insert into dynamic_form_fields (record_id,field_key,field_value,field_type,sort_order,remark,created_at)
 *    select id,k,v,t,s,r,'2026-01-02 03:04:05' from dynamic_form_records,
 *     (values ('k1','v1','text',2,NULL),('k2',NULL,NULL,1,'rm'),('k3','3','number',2,'x')) as f(k,v,t,s,r)
 *    where record_code='ck_test_r4_form';
 * “只替换字段”用例每次都会重写记录 2 的字段（两侧各写一次，比较时忽略 id/created_at），
 * 同时验证记录 updated_at 不变（种子里为 NULL）。
 */
import type { ShadowCase } from './types'

const B = '/api/admin/component-center/dynamic-form-page'
const many = Array.from({ length: 21 }, (_, i) => ({ field_key: `k${i}` }))

export const cases: ShadowCase[] = [
  { name: '列表 默认（含 fields_count）', path: B, auth: true },
  { name: '列表 未登录', path: B },
  { name: '列表 分页', path: `${B}?page=2&per_page=1`, auth: true },
  { name: '列表 search', path: `${B}?search=FORM2`, auth: true },
  { name: '列表 筛选', path: `${B}?category=config&status=published&owner=ck&is_active=yes`, auth: true },
  { name: '列表 is_active=0', path: `${B}?is_active=0`, auth: true },
  { name: '详情（字段按 sort_order，含同值）', path: `${B}/1`, auth: true },
  { name: '详情 空值记录', path: `${B}/2`, auth: true },
  { name: '详情 不存在', path: `${B}/99999999`, auth: true },
  { name: '新增 缺标题', method: 'POST', path: B, body: { record_code: 'x' }, auth: true },
  { name: '新增 缺编码', method: 'POST', path: B, body: { title: 'x' }, auth: true },
  { name: '新增 编码重复', method: 'POST', path: B, body: { title: 'x', record_code: 'ck_test_r4_form' }, auth: true },
  { name: '新增 字段超过 20', method: 'POST', path: B, body: { title: 'x', record_code: 'ck_test_r4_never', fields: many }, auth: true },
  { name: '新增 fields 为长字符串（len>20）', method: 'POST', path: B, body: { title: 'x', record_code: 'ck_test_r4_never', fields: 'abcdefghijklmnopqrstuvwxyz' }, auth: true },
  { name: '新增 fields 为数字（500）', method: 'POST', path: B, body: { title: 'x', record_code: 'ck_test_r4_never', fields: 3 }, auth: true },
  { name: '新增 fields 元素非 dict（500 回滚）', method: 'POST', path: B, body: { title: 'x', record_code: 'ck_test_r4_never', fields: [{ field_key: 'a' }, 'b'] }, auth: true },
  { name: '新增 状态非法', method: 'POST', path: B, body: { title: 'x', record_code: 'ck_test_r4_never', status: 'active' }, auth: true },
  { name: '编辑 不存在', method: 'PUT', path: `${B}/99999999`, body: {}, auth: true },
  { name: '编辑 标题为空', method: 'PUT', path: `${B}/1`, body: { title: '   ' }, auth: true },
  { name: '编辑 字段超过 20', method: 'PUT', path: `${B}/1`, body: { fields: many }, auth: true },
  { name: '编辑 fields=false（500）', method: 'PUT', path: `${B}/1`, body: { fields: false }, auth: true },
  { name: '编辑 fields 元素非 dict（500 回滚）', method: 'PUT', path: `${B}/1`, body: { fields: [null] }, auth: true },
  { name: '编辑 fields 为非空 dict（500 回滚）', method: 'PUT', path: `${B}/1`, body: { fields: { field_key: 'x' } }, auth: true },
  { name: '编辑 状态非法', method: 'PUT', path: `${B}/1`, body: { status: 'x' }, auth: true },
  { name: '编辑 空 body（不写库）', method: 'PUT', path: `${B}/1`, body: {}, auth: true },
  { name: '编辑 fields=null（不动字段）', method: 'PUT', path: `${B}/1`, body: { fields: null, record_code: 'ignored' }, auth: true },
  {
    name: '编辑 同值（不写库）',
    method: 'PUT',
    path: `${B}/1`,
    body: { title: 'ck_test_r4_表单', category: 'config', status: 'published', owner: 'ck_owner', priority: '3', is_active: '启用', description: ' 描述 ' },
    auth: true,
  },
  {
    name: '编辑 只替换字段（记录 updated_at 不变）',
    method: 'PUT',
    path: `${B}/2`,
    body: { fields: [{ field_key: 'a', sort_order: 'x' }, { field_key: '' }, { field_key: ' b ', field_value: 0, field_type: '', remark: ' r ' }, { field_key: 'c', sort_order: '-1', field_type: 'date' }] },
    auth: true,
    ignoreKeys: ['id', 'created_at'],
  },
  { name: '删除 不存在', method: 'DELETE', path: `${B}/99999999`, auth: true },
  { name: '导出 未勾选', method: 'POST', path: `${B}/export`, body: { ids: 'x' }, auth: true },
  { name: '导出 选中 csv', method: 'POST', path: `${B}/export`, body: { ids: [2, 1] }, auth: true },
  { name: '导出 选中 字段', method: 'POST', path: `${B}/export`, body: { ids: [1, 2], fields: ['fields_count', 'category', 'priority', 'is_active', 'updated_at'] }, auth: true },
  { name: '导出 筛选 xlsx', method: 'POST', path: `${B}/export`, body: { export_mode: 'filtered', filters: { search: 'ck_test_r4' }, file_type: 'xlsx', fields: ['title', 'fields_count'] }, auth: true },
  { name: '导出 GET', path: `${B}/export?search=ck_test_r4&fields=record_code,fields_count`, auth: true },
  { name: '模板 csv', path: `${B}/template`, auth: true },
  { name: '模板 xlsx', path: `${B}/template?file_type=xlsx`, auth: true },
  { name: '导入 无文件', method: 'POST', path: `${B}/import`, auth: true },
]
