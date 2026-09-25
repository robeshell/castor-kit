/**
 * 定时任务 shadow-diff 用例（对齐 AuraStack backend/app/admin/api/scheduled_task.py）
 *
 * 依赖固定 id 的种子数据（960001+，前缀 ck_test_r6_），运行前先写入测试库：
 *   npx tsx -e "import('./scripts/shadow-cases/scheduled-task.ts').then((m) => console.log(m.SEED_SQL))" | psql <测试库 URL>
 * 种子可重复执行（先删后插）。两个后端都要关闭调度器（Flask ENABLE_TASK_SCHEDULER=false，Node 不设 RUN_SCHEDULER_IN_WEB）。
 *
 * 不放进 shadow 的用例（在 vitest 里验证）：
 * - 新增时 URL 为空 / 非 http(s) / 内网 / urlsplit ValueError：Flask 未捕获 → 500；Node 有意改为 400 + 具体原因
 *   （urlsplit ValueError 新增、编辑都是 400「请求地址格式不合法」）
 *
 * 已知有意差异（shadow 会报不一致）：
 * - 「编辑 地址 localhost」：Node 文案附带解析结果「不允许访问内网地址（localhost 解析为 127.0.0.1）」
 * - 删除成功、新增成功：两边各写一次库，第二次必然不同
 * - 目标为内网地址的已存量任务手动执行：Python 执行阶段不做 SSRF 复检会真的发请求，Node 在连接阶段拦截（有意加固）
 */

import type { ShadowCase } from './types'

const T = '/api/admin/scheduled-tasks'
const A = 960001 // 启用，*/5，公网 IP，有执行记录
const B = 960002 // 停用
const C = 960003 // 启用，目标返回 400（手动执行 → failed）
const D = 960004 // 请求头不是 JSON
const E = 960005 // 请求头是 JSON 数组
const F = 960006 // 幂等更新用

export const SEED_SQL = `
DELETE FROM scheduled_tasks WHERE id BETWEEN 960001 AND 960099 OR task_code LIKE 'ck_test_r6_shadow_%';
INSERT INTO scheduled_tasks (id, name, task_code, cron_expression, request_method, request_url, request_headers, request_body,
  timeout_seconds, is_active, remark, last_status, last_error, last_duration_ms, run_count, last_run_at, next_run_at, created_at, updated_at)
VALUES
 (${A}, '影子任务A', 'ck_test_r6_shadow_a', '*/5 * * * *', 'GET', 'https://1.1.1.1/cdn-cgi/trace', '{"X-Trace": "1"}', NULL,
  10, true, NULL, 'success', NULL, 120, 2, '2026-09-01 10:00:00.5', '2030-01-01 00:00:00', '2026-09-01 09:00:00', '2026-09-01 10:00:00.123456'),
 (${B}, '影子任务B', 'ck_test_r6_shadow_b', '0 3 * * *', 'POST', 'https://1.1.1.1/cdn-cgi/trace', NULL, '{"k": 1}',
  30, false, '备注B', 'idle', NULL, NULL, 0, NULL, NULL, '2026-09-02 09:00:00', '2026-09-02 09:00:00'),
 (${C}, '影子任务C', 'ck_test_r6_shadow_c', '0 0 1 * 1', 'GET', 'https://1.1.1.1/dns-query', NULL, NULL,
  10, true, NULL, 'failed', 'HTTP 400', 50, 1, '2026-09-03 10:00:00', '2030-01-01 00:05:00', '2026-09-03 09:00:00', '2026-09-03 10:00:00'),
 (${D}, '影子任务D', 'ck_test_r6_shadow_d', '* * * * *', 'GET', 'https://1.1.1.1/cdn-cgi/trace', 'not-json', NULL,
  10, false, NULL, 'idle', NULL, NULL, 0, NULL, NULL, '2026-09-04 09:00:00', '2026-09-04 09:00:00'),
 (${E}, '影子任务E', 'ck_test_r6_shadow_e', '* * * * *', 'GET', 'https://1.1.1.1/cdn-cgi/trace', '[1, 2]', NULL,
  10, false, NULL, 'idle', NULL, NULL, 0, NULL, NULL, '2026-09-05 09:00:00', '2026-09-05 09:00:00'),
 (${F}, '影子任务F', 'ck_test_r6_shadow_f', '0 0 * * 0', 'GET', 'https://1.1.1.1/cdn-cgi/trace', NULL, NULL,
  10, false, '备注F', 'idle', NULL, NULL, 0, NULL, NULL, '2026-09-06 09:00:00', '2026-09-06 09:00:00');
INSERT INTO scheduled_task_runs (id, task_id, trigger_type, status, response_status, response_body, error_message, started_at, finished_at, duration_ms, created_at)
VALUES
 (960101, ${A}, 'scheduled', 'success', 200, 'fl=1', NULL, '2026-09-01 09:55:00.1', '2026-09-01 09:55:00.3', 200, '2026-09-01 09:55:00.3'),
 (960102, ${A}, 'manual', 'failed', 500, 'oops', 'HTTP 500', '2026-09-01 10:00:00', '2026-09-01 10:00:00.5', 500, '2026-09-01 10:00:00.5'),
 (960103, ${C}, 'scheduled', 'failed', 400, '', 'HTTP 400', '2026-09-03 10:00:00', '2026-09-03 10:00:00.05', 50, '2026-09-03 10:00:00.05');
`

/** 执行结果里必然不同的字段 */
const RUN_IGNORE = [
  'id', 'started_at', 'finished_at', 'duration_ms', 'created_at', 'updated_at', 'last_run_at', 'next_run_at',
  'run_count', 'last_duration_ms', 'response_body',
]

export const cases: ShadowCase[] = [
  // ---- 列表 ----
  { name: '列表 默认', path: T, auth: true },
  { name: '列表 search 编码', path: `${T}?search=ck_test_r6_shadow`, auth: true },
  { name: '列表 search 地址', path: `${T}?search=dns-query`, auth: true },
  { name: '列表 search 名称 + 分页', path: `${T}?search=${encodeURIComponent('影子任务')}&page=2&per_page=2`, auth: true },
  { name: '列表 is_active=true', path: `${T}?search=ck_test_r6_shadow&is_active=true`, auth: true },
  { name: '列表 is_active=停用', path: `${T}?search=ck_test_r6_shadow&is_active=${encodeURIComponent('停用')}`, auth: true },
  { name: '列表 is_active 非法值忽略', path: `${T}?search=ck_test_r6_shadow&is_active=maybe`, auth: true },
  { name: '列表 status=failed', path: `${T}?search=ck_test_r6_shadow&status=failed`, auth: true },
  { name: '列表 search 两侧空白', path: `${T}?search=%20ck_test_r6_shadow_b%20`, auth: true },
  { name: '列表 非法分页', path: `${T}?page=abc&per_page=0&search=ck_test_r6_shadow`, auth: true },
  { name: '列表 per_page 钳制', path: `${T}?per_page=999&search=ck_test_r6_shadow`, auth: true },
  { name: '列表 未登录', path: T },

  // ---- 详情 ----
  { name: '详情', path: `${T}/${A}`, auth: true },
  { name: '详情 停用任务', path: `${T}/${B}`, auth: true },
  { name: '详情 不存在', path: `${T}/99999999`, auth: true },
  { name: '详情 非数字 id', path: `${T}/abc`, auth: true },

  // ---- 执行记录 ----
  { name: '执行记录 默认', path: `${T}/runs?per_page=5`, auth: true },
  { name: '执行记录 按任务', path: `${T}/runs?task_id=${A}`, auth: true },
  { name: '执行记录 按任务 + 状态', path: `${T}/runs?task_id=${A}&status=failed`, auth: true },
  { name: '执行记录 task_id 带空白', path: `${T}/runs?task_id=%20${A}%20`, auth: true },
  { name: '执行记录 task_id 非法', path: `${T}/runs?task_id=abc&per_page=3`, auth: true },
  { name: '执行记录 task_id=0', path: `${T}/runs?task_id=0&per_page=3`, auth: true },
  { name: '执行记录 status 过滤', path: `${T}/runs?status=failed&per_page=3`, auth: true },

  // ---- 新增：校验失败 ----
  { name: '新增 缺名称', method: 'POST', path: T, body: { request_url: 'https://1.1.1.1/x' }, auth: true },
  { name: '新增 名称空白', method: 'POST', path: T, body: { name: '  ', task_code: 'x', request_url: 'https://1.1.1.1/x' }, auth: true },
  { name: '新增 缺编码', method: 'POST', path: T, body: { name: 'n', request_url: 'https://1.1.1.1/x' }, auth: true },
  { name: '新增 缺 cron', method: 'POST', path: T, body: { name: 'n', task_code: 'x', request_url: 'https://1.1.1.1/x' }, auth: true },
  {
    name: '新增 方法非法',
    method: 'POST',
    path: T,
    body: { name: 'n', task_code: 'x', cron_expression: '* * * * *', request_url: 'https://1.1.1.1/x', request_method: 'head' },
    auth: true,
  },
  {
    name: '新增 方法空白',
    method: 'POST',
    path: T,
    body: { name: 'n', task_code: 'x', cron_expression: '* * * * *', request_url: 'https://1.1.1.1/x', request_method: '  ' },
    auth: true,
  },
  {
    name: '新增 编码重复',
    method: 'POST',
    path: T,
    body: { name: 'n', task_code: 'ck_test_r6_shadow_a', cron_expression: '* * * * *', request_url: 'https://1.1.1.1/x' },
    auth: true,
  },
  ...[
    ['cron 段数', '* * * *'],
    ['cron 越界', '60 * * * *'],
    ['cron 步长', '*/0 * * * *'],
    ['cron 区间', '0 0 * * 5-7'],
    ['cron 一年无触发', '0 0 30 2 *'],
    ['cron 空字段', '1,,2 * * * *'],
  ].map(
    ([label, cron]): ShadowCase => ({
      name: `新增 ${label}`,
      method: 'POST',
      path: T,
      body: { name: 'n', task_code: 'ck_test_r6_shadow_new', cron_expression: cron, request_url: 'https://1.1.1.1/x' },
      auth: true,
    }),
  ),
  ...[
    ['请求头非 JSON', 'not json'],
    ['请求头 JSON 数组', '[1, 2]'],
    ['请求头 列表值', ['a']],
    ['请求头 数字', 5],
    ['请求头 布尔', true],
  ].map(
    ([label, headers]): ShadowCase => ({
      name: `新增 ${label}`,
      method: 'POST',
      path: T,
      body: { name: 'n', task_code: 'ck_test_r6_shadow_new', cron_expression: '* * * * *', request_url: 'https://1.1.1.1/x', request_headers: headers },
      auth: true,
    }),
  ),

  // ---- 编辑 ----
  { name: '编辑 不存在', method: 'PUT', path: `${T}/99999999`, body: {}, auth: true },
  { name: '编辑 非数字 id', method: 'PUT', path: `${T}/abc`, body: {}, auth: true },
  { name: '编辑 名称为空', method: 'PUT', path: `${T}/${F}`, body: { name: '' }, auth: true },
  { name: '编辑 编码为空', method: 'PUT', path: `${T}/${F}`, body: { task_code: null }, auth: true },
  { name: '编辑 编码重复', method: 'PUT', path: `${T}/${F}`, body: { task_code: 'ck_test_r6_shadow_a' }, auth: true },
  { name: '编辑 方法非法', method: 'PUT', path: `${T}/${F}`, body: { request_method: 'TRACE' }, auth: true },
  { name: '编辑 cron 非法', method: 'PUT', path: `${T}/${F}`, body: { cron_expression: 'a b c d e' }, auth: true },
  { name: '编辑 请求头非法', method: 'PUT', path: `${T}/${F}`, body: { request_headers: '{bad' }, auth: true },
  ...[
    ['地址为空', ''],
    ['地址 ftp', 'ftp://example.com/x'],
    ['地址 file', 'file:///etc/passwd'],
    ['地址 缺主机', 'http:///path'],
    ['地址 端口越界', 'http://1.1.1.1:99999/x'],
    ['地址 端口 0', 'http://1.1.1.1:0/x'],
    ['地址 端口非数字', 'http://1.1.1.1:8a/x'],
    ['地址 环回', 'http://127.0.0.1/x'],
    ['地址 元数据', 'http://169.254.169.254/latest/meta-data/'],
    ['地址 私网', 'http://10.0.0.1/x'],
    ['地址 0.0.0.0', 'http://0.0.0.0/x'],
    ['地址 IPv6 环回', 'http://[::1]/x'],
    ['地址 localhost', 'http://localhost:8000/x'],
    ['地址 大写协议', 'HTTP://127.0.0.1/x'],
    ['地址 userinfo 绕过', 'http://1.1.1.1@127.0.0.1/x'],
  ].map(
    ([label, url]): ShadowCase => ({ name: `编辑 ${label}`, method: 'PUT', path: `${T}/${F}`, body: { request_url: url }, auth: true }),
  ),
  // 幂等更新：Flask 先写，Node 再写同样的值 → 没有变化的列不发 UPDATE，updated_at 保持 Flask 写入的值
  { name: '编辑 幂等 超时钳制', method: 'PUT', path: `${T}/${F}`, body: { timeout_seconds: 500 }, auth: true },
  { name: '编辑 幂等 非法超时回落', method: 'PUT', path: `${T}/${F}`, body: { timeout_seconds: 'abc' }, auth: true },
  { name: '编辑 幂等 is_active 非法值保持', method: 'PUT', path: `${T}/${F}`, body: { is_active: 'maybe', remark: '  备注F  ' }, auth: true },
  { name: '编辑 幂等 请求头对象', method: 'PUT', path: `${T}/${F}`, body: { request_headers: { 'X-中文': '值', n: 1, b: true } }, auth: true },
  { name: '编辑 幂等 请求头文本', method: 'PUT', path: `${T}/${F}`, body: { request_headers: ' {"b": 1.0, "a": [1, "x"]} ' }, auth: true },
  { name: '编辑 幂等 请求头清空', method: 'PUT', path: `${T}/${F}`, body: { request_headers: '' }, auth: true },
  { name: '编辑 幂等 方法小写', method: 'PUT', path: `${T}/${F}`, body: { request_method: ' post ', request_body: '  ' }, auth: true },
  { name: '编辑 幂等 恢复', method: 'PUT', path: `${T}/${F}`, body: { request_method: 'GET', timeout_seconds: 10, remark: '备注F' }, auth: true },
  // 启用任务会按当前时间重算 next_run_at，两边调用可能跨分钟
  {
    name: '编辑 启用后重算下次执行',
    method: 'PUT',
    path: `${T}/${C}`,
    body: { cron_expression: '0 0 1 * 1', is_active: true },
    auth: true,
    ignoreKeys: ['next_run_at', 'updated_at'],
  },

  // ---- 删除 ----
  { name: '删除 不存在', method: 'DELETE', path: `${T}/99999999`, auth: true },

  // ---- 手动执行 ----
  { name: '执行 不存在', method: 'POST', path: `${T}/99999999/run`, auth: true },
  { name: '执行 请求头非 JSON', method: 'POST', path: `${T}/${D}/run`, auth: true },
  { name: '执行 请求头是数组', method: 'POST', path: `${T}/${E}/run`, auth: true },
  { name: '执行 目标返回 400', method: 'POST', path: `${T}/${C}/run`, auth: true, ignoreKeys: RUN_IGNORE },
  { name: '执行 成功', method: 'POST', path: `${T}/${A}/run`, auth: true, ignoreKeys: RUN_IGNORE },
]
