/**
 * 菜单模块 shadow 用例。
 *
 * menus / role_menus 是全局 RBAC 数据：这里只对 `ck_test_r1_sh_` 前缀的夹具做写操作（幂等更新、不改变顺序的
 * 排序分支），其余只读或只走校验失败分支。夹具在设置了 SHADOW_DATABASE_URL（与两个后端同一个库）时于加载本文件时重建；
 * 未设置时只跑不依赖夹具的用例。
 */

import pg from 'pg'
import type { ShadowCase } from './types'

const P = 'ck_test_r1_sh_'

async function setupFixture(url: string) {
  const client = new pg.Client({ connectionString: url })
  await client.connect()
  try {
    await client.query(`DELETE FROM menus WHERE code LIKE '${P}%' AND parent_id IS NOT NULL`)
    await client.query(`DELETE FROM menus WHERE code LIKE '${P}%'`)
    const ins = async (code: string, name: string, parent: number | null, sort: number | null, extra = '') => {
      const { rows } = await client.query(
        `INSERT INTO menus (name, code, parent_id, sort_order, is_visible, is_active, menu_type, path, created_at, updated_at${extra ? ', description' : ''})
         VALUES ($1, $2, $3, $4, true, true, 'menu', '/ck-sh', timezone('utc', now()), timezone('utc', now())${extra ? ', $5' : ''}) RETURNING id`,
        extra ? [name, code, parent, sort, extra] : [name, code, parent, sort],
      )
      return rows[0].id as number
    }
    const root = await ins(`${P}root`, 'shadow 根', null, 9999)
    const c1 = await ins(`${P}c1`, 'shadow 子1', root, 10)
    const c2 = await ins(`${P}c2`, 'shadow 子2', root, 20)
    const c3 = await ins(`${P}c3`, 'shadow 子3', root, 20, '同 sort_order')
    const c4 = await ins(`${P}c4`, 'shadow 子4', root, null)
    const g1 = await ins(`${P}g1`, 'shadow 孙1', c1, 0)
    // 让 c2 的物理位置排到 c3 之后：同 sort_order 的子节点顺序取决于 PG 执行计划
    await client.query('UPDATE menus SET description = NULL WHERE id = $1', [c2])
    return { root, c1, c2, c3, c4, g1 }
  } finally {
    await client.end()
  }
}

const url = process.env.SHADOW_DATABASE_URL
const fx = url ? await setupFixture(url) : null

export const cases: ShadowCase[] = [
  { name: '列表 tree', path: '/api/admin/menus', auth: true },
  { name: '列表 tree + search（只过滤根）', path: '/api/admin/menus?search=system', auth: true },
  { name: '列表 flat', path: '/api/admin/menus?format=flat', auth: true },
  { name: '列表 format 为空 → flat', path: '/api/admin/menus?format=', auth: true },
  { name: '列表 flat + search', path: '/api/admin/menus?format=flat&search=%E7%94%A8%E6%88%B7', auth: true },
  { name: '详情 带递归 children', path: '/api/admin/menus/2', auth: true },
  { name: '详情 叶子 children=[]', path: '/api/admin/menus/211', auth: true },
  { name: '详情 404', path: '/api/admin/menus/99999999', auth: true },
  { name: '详情 超大 id 404', path: '/api/admin/menus/99999999999', auth: true },
  { name: '详情 非数字 id', path: '/api/admin/menus/abc', auth: true },
  { name: 'my-menus', path: '/api/admin/my-menus', auth: true },
  { name: '新增 缺字段', method: 'POST', path: '/api/admin/menus', body: { name: ' ' }, auth: true },
  { name: '新增 空对象', method: 'POST', path: '/api/admin/menus', body: {}, auth: true },
  { name: '新增 编码已存在', method: 'POST', path: '/api/admin/menus', body: { name: 'x', code: 'dashboard' }, auth: true },
  { name: '新增 parent_id 非法 → 500', method: 'POST', path: '/api/admin/menus', body: { name: 'x', code: `${P}bad`, parent_id: '' }, auth: true },
  { name: '新增 is_visible 非法 → 500', method: 'POST', path: '/api/admin/menus', body: { name: 'x', code: `${P}bad`, is_visible: 'yes' }, auth: true },
  { name: '编辑 404', method: 'PUT', path: '/api/admin/menus/99999999', body: {}, auth: true },
  { name: '编辑 空名称', method: 'PUT', path: '/api/admin/menus/1', body: { name: '' }, auth: true },
  { name: '编辑 空编码', method: 'PUT', path: '/api/admin/menus/1', body: { code: null }, auth: true },
  { name: '编辑 编码冲突', method: 'PUT', path: '/api/admin/menus/1', body: { code: 'system' }, auth: true },
  { name: '删除 404', method: 'DELETE', path: '/api/admin/menus/99999999', auth: true },
  { name: '删除 有子菜单', method: 'DELETE', path: '/api/admin/menus/2', auth: true },
  { name: '排序 404', method: 'POST', path: '/api/admin/menus/99999999/sort', body: { direction: 'up' }, auth: true },
  { name: '排序 非法方向', method: 'POST', path: '/api/admin/menus/1/sort', body: { direction: 'left' }, auth: true },
  { name: '排序 body 为 null', method: 'POST', path: '/api/admin/menus/1/sort', body: null, auth: true },
  { name: '排序 根级已在最前', method: 'POST', path: '/api/admin/menus/1/sort', body: { direction: ' UP ' }, auth: true },
  { name: '排序 非数字 id', method: 'POST', path: '/api/admin/menus/abc/sort', body: {}, auth: true },
  { name: '导出 未勾选', method: 'POST', path: '/api/admin/menus/export', body: {}, auth: true },
  { name: '导出 ids 不是 list', method: 'POST', path: '/api/admin/menus/export', body: { ids: 'x' }, auth: true },
  { name: '导出 csv 筛选', method: 'POST', path: '/api/admin/menus/export', body: { export_mode: 'filtered', filters: { search: 'system' } }, auth: true },
  { name: '导出 csv 全部', method: 'POST', path: '/api/admin/menus/export', body: { export_mode: 'filtered' }, auth: true },
  { name: '导出 xlsx 选中+字段', method: 'POST', path: '/api/admin/menus/export', body: { ids: [211, 2, 1, '3', 99999999999, null], fields: ['code', 'parent_code', 'is_visible', 'sort_order', 'bogus'], file_type: 'xlsx' }, auth: true },
  { name: '模板 csv', path: '/api/admin/menus/template', auth: true },
  { name: '模板 xlsx', path: '/api/admin/menus/template?file_type=XLSX', auth: true },
  { name: '导入 无文件', method: 'POST', path: '/api/admin/menus/import', auth: true },
  { name: 'GET export → 404', path: '/api/admin/menus/export', auth: true },
  { name: 'PATCH 菜单 → 405', method: 'PATCH', path: '/api/admin/menus/1', body: {}, auth: true },
  ...(fx
    ? ([
        { name: '夹具 详情（同 sort_order 子节点顺序、NULL 排最后）', path: `/api/admin/menus/${fx.root}`, auth: true },
        { name: '夹具 树中出现', path: `/api/admin/menus?search=${P}root`, auth: true },
        { name: '夹具 编辑 值未变化（不刷新 updated_at）', method: 'PUT', path: `/api/admin/menus/${fx.c1}`, body: { name: 'shadow 子1', sort_order: 10, is_visible: 1 }, auth: true },
        { name: '夹具 编辑 幂等变更', method: 'PUT', path: `/api/admin/menus/${fx.c4}`, body: { icon: 'IconX', description: ['a b', null], sort_order: 99.5 }, auth: true, ignoreKeys: ['updated_at'] },
        { name: '夹具 编辑 is_visible 非法 → 500', method: 'PUT', path: `/api/admin/menus/${fx.c1}`, body: { is_visible: 'no' }, auth: true },
        { name: '夹具 编辑 自身编码不查重', method: 'PUT', path: `/api/admin/menus/${fx.c1}`, body: { code: `${P}c1` }, auth: true },
        { name: '夹具 排序 已在最前', method: 'POST', path: `/api/admin/menus/${fx.c1}/sort`, body: { direction: 'up' }, auth: true },
        { name: '夹具 排序 唯一子菜单', method: 'POST', path: `/api/admin/menus/${fx.g1}/sort`, body: { direction: 'down' }, auth: true },
        { name: '夹具 删除 有子菜单', method: 'DELETE', path: `/api/admin/menus/${fx.c1}`, auth: true },
        { name: '夹具 导出 parent_code', method: 'POST', path: '/api/admin/menus/export', body: { export_mode: 'filtered', filters: { search: P } }, auth: true },
      ] satisfies ShadowCase[])
    : []),
]
