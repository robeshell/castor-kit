/**
 * 角色模块 shadow 用例。
 *
 * roles / role_menus 是全局 RBAC 数据：只对 `ck_test_r1_sh_` 前缀的夹具角色做幂等写，其余只读或只走校验失败分支。
 * 夹具在设置了 SHADOW_DATABASE_URL（与两个后端同一个库）时于加载本文件时重建。
 */

import pg from 'pg'
import type { ShadowCase } from './types'

const P = 'ck_test_r1_sh_'

async function setupFixture(url: string) {
  const client = new pg.Client({ connectionString: url })
  await client.connect()
  try {
    await client.query(`DELETE FROM roles WHERE code LIKE '${P}%'`)
    const { rows } = await client.query(
      `INSERT INTO roles (name, code, description, created_at) VALUES ('shadow 角色', '${P}role', NULL, timezone('utc', now())) RETURNING id`,
    )
    const roleId = rows[0].id as number
    // 菜单按与 id 不同的顺序插入，懒加载顺序（无 ORDER BY）与 to_dict 的 (sort_order, id) 排序不同
    for (const code of ['system_users', 'dashboard', 'system_roles', 'system']) {
      await client.query(`INSERT INTO role_menus (role_id, menu_id) SELECT $1, id FROM menus WHERE code = $2`, [roleId, code])
    }
    return { roleId }
  } finally {
    await client.end()
  }
}

const url = process.env.SHADOW_DATABASE_URL
const fx = url ? await setupFixture(url) : null

export const cases: ShadowCase[] = [
  { name: '列表', path: '/api/admin/roles', auth: true },
  { name: '新增 缺名称', method: 'POST', path: '/api/admin/roles', body: { code: 'x' }, auth: true },
  { name: '新增 缺编码', method: 'POST', path: '/api/admin/roles', body: { name: 'x', code: '' }, auth: true },
  { name: '新增 空对象', method: 'POST', path: '/api/admin/roles', body: {}, auth: true },
  { name: '新增 编码已存在', method: 'POST', path: '/api/admin/roles', body: { name: 'x', code: 'super_admin' }, auth: true },
  { name: '编辑 404', method: 'PUT', path: '/api/admin/roles/99999999', body: {}, auth: true },
  { name: '编辑 非数字 id', method: 'PUT', path: '/api/admin/roles/abc', body: {}, auth: true },
  { name: '删除 404', method: 'DELETE', path: '/api/admin/roles/99999999', auth: true },
  { name: 'GET 单个角色 → 404', path: '/api/admin/roles/2', auth: true },
  { name: '导出 未勾选', method: 'POST', path: '/api/admin/roles/export', body: { ids: [] }, auth: true },
  { name: '导出 csv 当前用户角色（菜单顺序取自预加载）', method: 'POST', path: '/api/admin/roles/export', body: { ids: [2] }, auth: true },
  { name: '导出 csv 筛选', method: 'POST', path: '/api/admin/roles/export', body: { export_mode: 'filtered', filters: { search: 'ADMIN' }, fields: 'id' }, auth: true },
  { name: '导出 xlsx 全部', method: 'POST', path: '/api/admin/roles/export', body: { export_mode: ' filtered ', file_type: 'xlsx', fields: ['code', 'menu_names', 'created_at'] }, auth: true },
  { name: '导出 ids 字符串元素', method: 'POST', path: '/api/admin/roles/export', body: { ids: ['2', 99999999999, 1.5], fields: { name: 1, code: 1 } }, auth: true },
  { name: '模板 csv', path: '/api/admin/roles/template', auth: true },
  { name: '模板 xlsx', path: '/api/admin/roles/template?file_type=xlsx', auth: true },
  { name: '导入 无文件', method: 'POST', path: '/api/admin/roles/import', auth: true },
  ...(fx
    ? ([
        { name: '夹具 导出（懒加载菜单顺序）', method: 'POST', path: '/api/admin/roles/export', body: { ids: [fx.roleId], fields: ['code', 'menu_codes', 'menu_names', 'description'] }, auth: true },
        { name: '夹具 编辑 幂等', method: 'PUT', path: `/api/admin/roles/${fx.roleId}`, body: { name: 'shadow 角色', description: 7 }, auth: true },
        { name: '夹具 编辑 菜单幂等', method: 'PUT', path: `/api/admin/roles/${fx.roleId}`, body: { menu_ids: { 1: true, 2: true, 21: 'x', 22: null } }, auth: true },
        { name: '夹具 编辑 name=null → 500', method: 'PUT', path: `/api/admin/roles/${fx.roleId}`, body: { name: null }, auth: true },
        { name: '夹具 编辑 编码与已有冲突 → 500', method: 'PUT', path: `/api/admin/roles/${fx.roleId}`, body: { code: 'super_admin' }, auth: true },
        { name: '夹具 列表含夹具', path: '/api/admin/roles', auth: true },
      ] satisfies ShadowCase[])
    : []),
]
