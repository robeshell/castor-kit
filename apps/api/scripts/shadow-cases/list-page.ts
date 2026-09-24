import type { ShadowCase } from './types'

const B = '/api/admin/component-center/list-page'
const P = 'ck_test_r3_'

export const cases: ShadowCase[] = [
  // ---- 列表 / 详情
  { name: '列表', path: `${B}?page=1&per_page=5`, auth: true },
  { name: '列表 未登录', path: B },
  { name: '列表 search', path: `${B}?search=%E8%AE%A2%E5%8D%95`, auth: true },
  { name: '列表 category', path: `${B}?category=user`, auth: true },
  { name: '列表 owner', path: `${B}?owner=ADM`, auth: true },
  { name: '列表 is_active=0', path: `${B}?is_active=0`, auth: true },
  { name: '列表 is_active=启用', path: `${B}?is_active=%E5%90%AF%E7%94%A8`, auth: true },
  { name: '列表 is_active 非法', path: `${B}?is_active=abc`, auth: true },
  { name: '列表 status', path: `${B}?status=published`, auth: true },
  { name: '列表 非法分页', path: `${B}?page=abc&per_page=0`, auth: true },
  { name: '详情 1', path: `${B}/1`, auth: true },
  { name: '详情 2', path: `${B}/2`, auth: true },
  { name: '详情 不存在', path: `${B}/99999999`, auth: true },
  { name: '详情 非数字', path: `${B}/abc`, auth: true },
  { name: '编辑 非数字', method: 'PUT', path: `${B}/abc`, body: {}, auth: true },
  { name: '编辑 不存在', method: 'PUT', path: `${B}/99999999`, body: {}, auth: true },
  { name: '删除 不存在', method: 'DELETE', path: `${B}/99999999`, auth: true },

  // ---- 新增 / 编辑 校验分支
  { name: '新增 空', method: 'POST', path: B, body: {}, auth: true },
  { name: '新增 缺编码', method: 'POST', path: B, body: { name: 'x' }, auth: true },
  { name: '新增 编码重复', method: 'POST', path: B, body: { name: 'x', query_code: 'init_query_order_alert' }, auth: true },
  { name: '新增 非法状态', method: 'POST', path: B, body: { name: 'x', query_code: `${P}s`, status: 'bad' }, auth: true },
  { name: '新增 状态 0', method: 'POST', path: B, body: { name: 'x', query_code: `${P}s`, status: 0 }, auth: true },
  { name: '新增 条件 JSON 错', method: 'POST', path: B, body: { name: 'x', query_code: `${P}s`, conditions: '{bad' }, auth: true },
  { name: '新增 条件 非对象', method: 'POST', path: B, body: { name: 'x', query_code: `${P}s`, conditions: [1] }, auth: true },
  { name: '新增 条件 数字', method: 'POST', path: B, body: { name: 'x', query_code: `${P}s`, conditions: 5 }, auth: true },
  { name: '编辑 空名称', method: 'PUT', path: `${B}/1`, body: { name: '  ' }, auth: true },
  { name: '编辑 空编码', method: 'PUT', path: `${B}/1`, body: { query_code: null }, auth: true },
  { name: '编辑 编码重复', method: 'PUT', path: `${B}/1`, body: { query_code: 'init_query_user_rebuy' }, auth: true },
  { name: '编辑 非法状态', method: 'PUT', path: `${B}/1`, body: { status: 'x' }, auth: true },
  { name: '编辑 条件错误', method: 'PUT', path: `${B}/1`, body: { conditions: 'nope' }, auth: true },
  {
    name: '编辑 幂等（每次 version+1）',
    method: 'PUT',
    path: `${B}/2`,
    body: { description: '用于演示用户分层查询模板', operator: 'shadow' },
    auth: true,
    ignoreKeys: ['updated_at', 'version'],
  },

  // ---- 导出 / 模板 / 导入
  { name: '导出 GET 默认 csv', path: `${B}/export`, auth: true },
  { name: '导出 GET 字段+筛选', path: `${B}/export?fields=name,%20query_code,priority,bad&is_active=1&search=init`, auth: true },
  // xlsx 只选无空值的列：空字符串单元格 openpyxl 不写、exceljs 写成 ""（common/tabular 的差异，见报告）
  { name: '导出 GET xlsx', path: `${B}/export?file_type=xlsx&status=draft&fields=id,name,query_code,category,priority,is_active,status,conditions_json,display_config,schema_config,version,created_at`, auth: true },
  // 有意保留的差异：.xls 已决定不支持，Node 回落 csv（Flask 输出 BIFF8）
  { name: '导出 GET xls 回落', path: `${B}/export?file_type=xls&fields=id`, auth: true },
  { name: '导出 POST 未勾选', method: 'POST', path: `${B}/export`, body: {}, auth: true },
  { name: '导出 POST ids 非数组', method: 'POST', path: `${B}/export`, body: { ids: 1 }, auth: true },
  { name: '导出 POST 选中', method: 'POST', path: `${B}/export`, body: { ids: [2, 1, 99999999] }, auth: true },
  { name: '导出 POST 字符串 id', method: 'POST', path: `${B}/export`, body: { ids: ['1', null, 1.5], fields: ['id', 'name'] }, auth: true },
  { name: '导出 POST fields 字符串', method: 'POST', path: `${B}/export`, body: { ids: [1], fields: 'name' }, auth: true },
  { name: '导出 POST fields 对象', method: 'POST', path: `${B}/export`, body: { ids: [1], fields: { name: 1, owner: 0 } }, auth: true },
  {
    name: '导出 POST 筛选 xlsx',
    method: 'POST',
    path: `${B}/export`,
    body: {
      export_mode: 'filtered',
      filters: { owner: 'adm', is_active: 'true' },
      fields: ['id', 'name', 'keyword', 'owner', 'permission_config', 'condition_logic', 'updated_at'],
      file_type: 'xlsx',
    },
    auth: true,
  },
  { name: '模板 csv', path: `${B}/template`, auth: true },
  { name: '模板 xlsx', path: `${B}/template?file_type=xlsx`, auth: true },
  { name: '模板 POST', method: 'POST', path: `${B}/template`, auth: true },
  { name: '导入 无文件', method: 'POST', path: `${B}/import`, auth: true },

  // ---- 上传 / 回读
  { name: '上传图片 无文件', method: 'POST', path: `${B}/upload-image`, auth: true },
  { name: '上传附件 无文件', method: 'POST', path: `${B}/upload-file`, auth: true },
  { name: '回读图片 不存在', path: `${B}/image/nope.png`, auth: true },
  { name: '回读图片 空名', path: `${B}/image/`, auth: true },
  { name: '回读图片 无效名', path: `${B}/image/%E4%B8%AD%E6%96%87`, auth: true },
  { name: '回读图片 穿越', path: `${B}/image/..%2F..%2Fapp.py`, auth: true },
  { name: '回读图片 POST', method: 'POST', path: `${B}/image/a.png`, auth: true },
  { name: '回读附件 不存在', path: `${B}/file/nope.pdf`, auth: true },
  { name: '回读附件 穿越', path: `${B}/file/..%2F..%2F..%2Fapp.py`, auth: true },

  // ---- 预览
  { name: '预览 默认', method: 'POST', path: `${B}/run-preview`, body: {}, auth: true, ignoreKeys: ['updated_at', 'created_at'] },
  {
    name: '预览 自定义字段',
    method: 'POST',
    path: `${B}/run-preview`,
    body: {
      display_config: { selected_fields: ['user2id', 'a_b_c', 5, '', null, 'is_active', 'priority', 'status', 'ÉCOLE_x', '订单_no'], preview_rows: '3' },
      conditions: { items: [{ field: 'a', operator: 'eq' }, { field: '', operator: 'eq' }, 'x'], groups: [{}, 'y'] },
    },
    auth: true,
  },
  {
    name: '预览 行数钳制 + 字符串配置',
    method: 'POST',
    path: `${B}/run-preview`,
    body: { display_config: '{"selected_fields": ["id"], "preview_rows": 100}', conditions: '{"items": [{"field": "x", "operator": "gt", "value": 1}]}' },
    auth: true,
  },
  { name: '预览 行数下限', method: 'POST', path: `${B}/run-preview`, body: { display_config: { selected_fields: ['', 0], preview_rows: -5 } }, auth: true },
  { name: '预览 条件错误', method: 'POST', path: `${B}/run-preview`, body: { conditions: 'bad' }, auth: true },

  // ---- 版本
  { name: '版本 不存在', path: `${B}/99999999/versions`, auth: true },
  { name: '版本 分页', path: `${B}/1/versions?per_page=2`, auth: true },
  { name: '版本 列表（含快照）', path: `${B}/2/versions?per_page=4`, auth: true },
  { name: '回滚 记录不存在', method: 'POST', path: `${B}/99999999/versions/1/rollback`, auth: true },
  { name: '回滚 版本不存在', method: 'POST', path: `${B}/1/versions/99999999/rollback`, auth: true },
]
