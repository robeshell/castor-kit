/**
 * 依赖 aurastack_t4 里的种子数据（init_card_* 三行 id 1-3 + 下面这行 id 4，覆盖空值列）：
 *   insert into card_items (title,card_code,category,status,priority,is_active,created_at,updated_at)
 *   values ('ck_test_r4_卡片','ck_test_r4_card',NULL,'published',5,false,'2026-01-02 03:04:05.1','2026-01-02 03:04:05.12');
 */
import type { ShadowCase } from './types'

const B = '/api/admin/component-center/card-list-page'

export const cases: ShadowCase[] = [
  { name: '列表 默认', path: B, auth: true },
  { name: '列表 未登录', path: B },
  { name: '列表 分页', path: `${B}?page=2&per_page=3`, auth: true },
  { name: '列表 非法分页', path: `${B}?page=-1&per_page=abc`, auth: true },
  { name: '列表 search 标题', path: `${B}?search=%E5%91%A8%E6%8A%A5`, auth: true },
  { name: '列表 search 编码', path: `${B}?search=CHURN`, auth: true },
  { name: '列表 category', path: `${B}?category=finance`, auth: true },
  { name: '列表 owner', path: `${B}?owner=%E9%AB%98`, auth: true },
  { name: '列表 is_active=false', path: `${B}?is_active=false`, auth: true },
  { name: '列表 status', path: `${B}?status=published&is_active=1`, auth: true },
  { name: '详情', path: `${B}/1`, auth: true },
  { name: '详情 空值行', path: `${B}/4`, auth: true },
  { name: '详情 不存在', path: `${B}/99999999`, auth: true },
  { name: '详情 非数字 id', path: `${B}/x1`, auth: true },
  { name: '新增 缺标题', method: 'POST', path: B, body: { card_code: 'x' }, auth: true },
  { name: '新增 缺编码', method: 'POST', path: B, body: { title: 'x' }, auth: true },
  { name: '新增 编码重复', method: 'POST', path: B, body: { title: 'x', card_code: ' init_card_ops_weekly ' }, auth: true },
  { name: '新增 状态非法', method: 'POST', path: B, body: { title: 'x', card_code: 'ck_test_r4_never', status: 1 }, auth: true },
  { name: '编辑 不存在', method: 'PUT', path: `${B}/99999999`, body: {}, auth: true },
  { name: '编辑 标题为空', method: 'PUT', path: `${B}/1`, body: { title: '' }, auth: true },
  { name: '编辑 编码为空', method: 'PUT', path: `${B}/1`, body: { card_code: 0 }, auth: true },
  { name: '编辑 编码与他人重复', method: 'PUT', path: `${B}/1`, body: { card_code: 'init_card_user_churn' }, auth: true },
  { name: '编辑 状态非法', method: 'PUT', path: `${B}/1`, body: { status: 'nope' }, auth: true },
  { name: '编辑 空 body（不写库）', method: 'PUT', path: `${B}/1`, body: {}, auth: true },
  {
    name: '编辑 同值（不写库）',
    method: 'PUT',
    path: `${B}/1`,
    body: {
      title: ' 活动运营周报 ',
      card_code: 'init_card_ops_weekly',
      subtitle: '多渠道投放效果追踪',
      category: 'order',
      cover_url: 'https://images.unsplash.com/photo-1551281044-8b1f67f3f42b',
      tag: '运营',
      status: 'Published',
      owner: '周青',
      priority: '80',
      is_active: true,
      description: '用于展示卡片列表中的运营分析卡片',
    },
    auth: true,
  },
  { name: '编辑 空值行同值（null → None 不写库）', method: 'PUT', path: `${B}/4`, body: { subtitle: '', tag: null, owner: 0, priority: 'x', is_active: 'maybe', description: [] }, auth: true },
  { name: '删除 不存在', method: 'DELETE', path: `${B}/99999999`, auth: true },
  { name: '导出 未勾选', method: 'POST', path: `${B}/export`, body: { ids: [] }, auth: true },
  { name: '导出 选中 csv', method: 'POST', path: `${B}/export`, body: { ids: [4, '1'] }, auth: true },
  { name: '导出 选中 字段', method: 'POST', path: `${B}/export`, body: { ids: [1, 4], fields: ['title', 'subtitle', 'tag', 'is_active', 'cover_url'] }, auth: true },
  { name: '导出 非法 id', method: 'POST', path: `${B}/export`, body: { ids: ['x'] }, auth: true },
  { name: '导出 筛选 csv', method: 'POST', path: `${B}/export`, body: { export_mode: 'filtered', filters: { search: 'init', status: 'published' } }, auth: true },
  { name: '导出 筛选 xlsx', method: 'POST', path: `${B}/export`, body: { export_mode: 'filtered', file_type: 'xlsx' }, auth: true },
  { name: '导出 GET', path: `${B}/export?fields=title,card_code&owner=%E6%9E%97`, auth: true },
  { name: '模板 csv', path: `${B}/template`, auth: true },
  { name: '模板 xlsx', path: `${B}/template?file_type=xlsx`, auth: true },
  { name: '模板 POST 405', method: 'POST', path: `${B}/template`, body: {}, auth: true },
  { name: '导入 无文件', method: 'POST', path: `${B}/import`, auth: true },
]
