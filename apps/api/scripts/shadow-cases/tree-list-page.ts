/**
 * 依赖 aurastack_t4 里的种子数据（init_tree_* id 1-4 + 下面 4 行 id 7-10：A 为 inactive，
 * 按 status=active 过滤时其子节点 B/B2 成为根；N 的 sort_order 为 NULL）：
 *   insert into tree_nodes (name,node_code,parent_id,node_type,status,sort_order,is_active,created_at,updated_at) values
 *    ('ck_test_r4_A','ck_test_r4_A',NULL,'group','inactive',5,true,'2026-01-02 03:04:05','2026-01-02 03:04:05'),
 *    ('ck_test_r4_N','ck_test_r4_N',NULL,'item','active',NULL,true,'2026-01-02 03:04:05','2026-01-02 03:04:05');
 *   insert into tree_nodes (name,node_code,parent_id,node_type,status,sort_order,is_active,owner,created_at,updated_at)
 *    select 'ck_test_r4_B','ck_test_r4_B',id,'item','active',1,false,'ck_owner','2026-01-02 03:04:05','2026-01-02 03:04:05' from tree_nodes where node_code='ck_test_r4_A';
 *   insert into tree_nodes (name,node_code,parent_id,node_type,status,sort_order,is_active,created_at,updated_at)
 *    select 'ck_test_r4_B2','ck_test_r4_B2',id,'item','active',0,true,'2026-01-02 03:04:05','2026-01-02 03:04:05' from tree_nodes where node_code='ck_test_r4_A';
 */
import type { ShadowCase } from './types'

const B = '/api/admin/component-center/tree-list-page'

export const cases: ShadowCase[] = [
  { name: '树 全量', path: `${B}/tree`, auth: true },
  { name: '树 未登录', path: `${B}/tree` },
  { name: '树 status=active（父节点被过滤 → 子节点成为根）', path: `${B}/tree?status=active`, auth: true },
  { name: '树 is_active=停用', path: `${B}/tree?is_active=%E5%81%9C%E7%94%A8`, auth: true },
  { name: '树 search', path: `${B}/tree?search=CK_TEST_R4`, auth: true },
  { name: '树 node_type + owner', path: `${B}/tree?node_type=item&owner=ck_`, auth: true },
  { name: '列表 默认', path: B, auth: true },
  { name: '列表 分页', path: `${B}?page=2&per_page=3`, auth: true },
  { name: '列表 parent_id=root', path: `${B}?parent_id=root`, auth: true },
  { name: '列表 parent_id=7', path: `${B}?parent_id=7`, auth: true },
  { name: '列表 parent_id= 2 （空白）', path: `${B}?parent_id=%202%20`, auth: true },
  { name: '列表 parent_id 非数字（不筛选）', path: `${B}?parent_id=abc`, auth: true },
  { name: '列表 parent_id 空串（不筛选）', path: `${B}?parent_id=`, auth: true },
  { name: '列表 parent_id=ROOT（大小写敏感）', path: `${B}?parent_id=ROOT`, auth: true },
  { name: '列表 parent_id 超大', path: `${B}?parent_id=99999999999`, auth: true },
  { name: '列表 组合筛选', path: `${B}?status=active&is_active=true&search=%E7%BB%84`, auth: true },
  { name: '详情', path: `${B}/9`, auth: true },
  { name: '详情 sort_order 为空', path: `${B}/8`, auth: true },
  { name: '详情 不存在', path: `${B}/99999999`, auth: true },
  { name: '新增 缺名称', method: 'POST', path: B, body: { node_code: 'x' }, auth: true },
  { name: '新增 缺编码', method: 'POST', path: B, body: { name: 'x' }, auth: true },
  { name: '新增 编码重复', method: 'POST', path: B, body: { name: 'x', node_code: 'ck_test_r4_A' }, auth: true },
  { name: '新增 父节点不存在', method: 'POST', path: B, body: { name: 'x', node_code: 'ck_test_r4_never', parent_id: 99999999 }, auth: true },
  { name: '新增 父节点超大', method: 'POST', path: B, body: { name: 'x', node_code: 'ck_test_r4_never', parent_id: '99999999999' }, auth: true },
  { name: '新增 parent_id=0（外键失败 500）', method: 'POST', path: B, body: { name: 'x', node_code: 'ck_test_r4_never', parent_id: 0 }, auth: true },
  { name: '新增 parent_id="0"（外键失败 500）', method: 'POST', path: B, body: { name: 'x', node_code: 'ck_test_r4_never', parent_id: '0' }, auth: true },
  { name: '新增 parent 非法 + 状态非法', method: 'POST', path: B, body: { name: 'x', node_code: 'ck_test_r4_never', parent_id: 'abc', status: 'draft' }, auth: true },
  { name: '新增 父节点存在 + 状态非法', method: 'POST', path: B, body: { name: 'x', node_code: 'ck_test_r4_never', parent_id: 7, status: 'x' }, auth: true },
  { name: '编辑 不存在', method: 'PUT', path: `${B}/99999999`, body: {}, auth: true },
  { name: '编辑 名称为空', method: 'PUT', path: `${B}/9`, body: { name: null }, auth: true },
  { name: '编辑 编码为空', method: 'PUT', path: `${B}/9`, body: { node_code: '' }, auth: true },
  { name: '编辑 编码重复', method: 'PUT', path: `${B}/9`, body: { node_code: 'ck_test_r4_A' }, auth: true },
  { name: '编辑 编码改成新值（只校验不修改）', method: 'PUT', path: `${B}/9`, body: { node_code: 'ck_test_r4_renamed' }, auth: true },
  { name: '编辑 parent_id="0" → 父节点不存在', method: 'PUT', path: `${B}/9`, body: { parent_id: '0' }, auth: true },
  { name: '编辑 父节点不存在', method: 'PUT', path: `${B}/9`, body: { parent_id: 99999999 }, auth: true },
  { name: '编辑 父节点超大', method: 'PUT', path: `${B}/9`, body: { parent_id: 99999999999 }, auth: true },
  { name: '编辑 parent_id=自身（忽略）', method: 'PUT', path: `${B}/9`, body: { parent_id: 9 }, auth: true },
  { name: '编辑 parent_id 非法（忽略）', method: 'PUT', path: `${B}/9`, body: { parent_id: [1] }, auth: true },
  { name: '编辑 parent_id=false（置空，已为空不写库）', method: 'PUT', path: `${B}/8`, body: { parent_id: false }, auth: true },
  { name: '编辑 状态非法', method: 'PUT', path: `${B}/9`, body: { status: 'draft' }, auth: true },
  { name: '编辑 空 body', method: 'PUT', path: `${B}/9`, body: {}, auth: true },
  {
    name: '编辑 同值（不写库）',
    method: 'PUT',
    path: `${B}/9`,
    body: { name: 'ck_test_r4_B', parent_id: '7', node_type: 'item', icon: '', description: null, owner: ' ck_owner ', sort_order: 1.9, is_active: 'no', status: 'ACTIVE' },
    auth: true,
  },
  { name: '删除 不存在', method: 'DELETE', path: `${B}/99999999`, auth: true },
  { name: '导出 未勾选', method: 'POST', path: `${B}/export`, body: { ids: 5 }, auth: true },
  { name: '导出 选中 csv', method: 'POST', path: `${B}/export`, body: { ids: [9, 8, 1] }, auth: true },
  { name: '导出 选中 字段', method: 'POST', path: `${B}/export`, body: { ids: [8, 9], fields: ['parent_id', 'sort_order', 'is_active', 'icon', 'status'] }, auth: true },
  { name: '导出 筛选 csv', method: 'POST', path: `${B}/export`, body: { export_mode: 'filtered', filters: { node_type: 'item', is_active: 'true' } }, auth: true },
  { name: '导出 筛选 xlsx', method: 'POST', path: `${B}/export`, body: { export_mode: 'filtered', filters: { search: 'init' }, file_type: 'xlsx' }, auth: true },
  { name: '导出 GET', path: `${B}/export?status=active&fields=name,parent_id`, auth: true },
  { name: '模板 csv', path: `${B}/template`, auth: true },
  { name: '模板 xlsx', path: `${B}/template?file_type=xlsx`, auth: true },
  { name: '导入 无文件', method: 'POST', path: `${B}/import`, auth: true },
]
