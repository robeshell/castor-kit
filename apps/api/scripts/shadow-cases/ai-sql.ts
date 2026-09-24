import type { ShadowCase } from './types'

/**
 * AI 数据查询。execute / schema 不调用 AI，任何配置下都可比较。
 * 调用 LLM 的 generate 用例只在 SHADOW_FAKE_AI=1 时启用：两个后端都要以
 * `AI_API_BASE=http://127.0.0.1:<port> AI_API_KEY=fake-key AI_MODEL=fake-model` 启动并指向同一个假上游
 * （`npx tsx test/cc-ai-fake-upstream.ts 5178`，按问题文本返回固定 SQL / 错误），绝不能指向真实 AI 服务。
 */
const FAKE_AI = process.env.SHADOW_FAKE_AI === '1'

const exec = (name: string, sql: unknown, extra: Partial<ShadowCase> = {}): ShadowCase => ({
  name: `execute ${name}`,
  method: 'POST',
  path: '/api/admin/component-center/ai/sql/execute',
  body: { sql },
  auth: true,
  ...extra,
})

const gen = (name: string, question: unknown): ShadowCase => ({
  name: `generate ${name}`,
  method: 'POST',
  path: '/api/admin/component-center/ai/sql/generate',
  body: { question },
  auth: true,
})

export const cases: ShadowCase[] = [
  { name: 'schema 未登录', path: '/api/admin/component-center/ai/sql/schema' },
  { name: 'schema', path: '/api/admin/component-center/ai/sql/schema', auth: true },
  { name: 'execute 未登录', method: 'POST', path: '/api/admin/component-center/ai/sql/execute', body: { sql: 'SELECT 1' } },
  { name: 'generate 未登录', method: 'POST', path: '/api/admin/component-center/ai/sql/generate', body: { question: 'x' } },
  { name: 'execute 缺 CSRF', method: 'POST', path: '/api/admin/component-center/ai/sql/execute', body: { sql: 'SELECT 1' }, auth: true, noCsrf: true },
  { name: 'execute GET → 404', path: '/api/admin/component-center/ai/sql/execute', auth: true },

  // ---- 参数 ----
  exec('空 body', undefined, { body: {} }),
  exec('空串', ''),
  exec('空白', '   \n\t'),
  exec('null', null),
  exec('数字 0', 0),
  // 非字符串真值（5 / 数组 / 对象）在 Flask 里是未捕获的 AttributeError：debug 模式的 oracle 返回 Werkzeug 调试页，
  // 生产返回 JSON 500 通用文案；Node 对齐生产行为，用 vitest 覆盖，不放进 shadow
  gen('空 body', ''),
  gen('空白问题', '  \u3000 '),

  // ---- 安全拦截 ----
  exec('非 SELECT', 'UPDATE kanban_boards SET name = 1'),
  exec('SET ROLE', 'SET ROLE postgres'),
  exec('COPY', 'COPY t TO stdout'),
  exec('多语句', 'SELECT 1; DROP TABLE x'),
  exec('字面量里的分号也拒', "SELECT ';' AS x"),
  exec('INTO', 'SELECT 1 INTO new_table'),
  exec('FOR UPDATE', 'SELECT * FROM kanban_boards FOR UPDATE'),
  exec('FOR  SHARE 多空白', 'SELECT * FROM kanban_boards FOR\n\tSHARE'),
  exec('pg_read_file', "SELECT pg_read_file('/etc/passwd')"),
  exec('pg_sleep 空格括号', 'SELECT pg_sleep (5)'),
  exec('set_config', "SELECT set_config('default_transaction_read_only','off',false)"),
  exec('dblink', "select DBLINK('x','y')"),
  exec('小写 delete 关键字', 'select 1 as x where exists (select 1) and 1=1 or delete'),
  exec('DO 关键字', 'SELECT 1 AS do'),
  exec('WITH 写 CTE', 'WITH d AS (DELETE FROM kanban_boards RETURNING *) SELECT * FROM d'),
  exec('注释里的关键字不算', 'SELECT 1 AS a -- drop table x'),
  exec('块注释里的关键字不算', 'SELECT /* delete */ 1 AS a'),
  exec('注释前置', '/* hi */ SELECT 1 AS a'),
  exec('行注释前置', '-- hi\nSELECT 1 AS a'),
  exec('Unicode 单词边界', 'SELECT 1 AS 中DELETE'),
  exec('Unicode 单词边界 2', 'SELECT 1 AS "x" , 2 AS éSET'),

  // ---- 字面量剥离 / 误杀 ----
  exec('字面量 delete', "SELECT 'delete' AS label, 'drop table' AS txt"),
  exec('双引号标识符 DROP', 'SELECT 1 AS "DROP"'),
  exec('字面量 pg_sleep', "SELECT 'pg_sleep(999)' AS note"),
  exec('列名 delete_status', 'SELECT 1 AS delete_status'),
  exec('列名 into_x', 'SELECT 1 AS into_x'),

  // ---- 执行 / LIMIT 包裹 / 截断 ----
  exec('基本', 'SELECT id, title FROM kanban_boards ORDER BY id LIMIT 5'),
  exec('尾部分号', 'SELECT 1 AS a;'),
  exec('尾部多个分号', 'select 1 as a ;;  '),
  exec('WITH CTE', 'WITH x AS (SELECT 1 AS n) SELECT * FROM x'),
  exec('截断 200', 'SELECT generate_series(1, 300) AS n'),
  exec('恰好 200', 'SELECT generate_series(1, 200) AS n'),
  exec('空结果', 'SELECT 1 AS a WHERE false'),
  exec('重复列名', 'SELECT 1 AS a, 2 AS a'),
  exec('无列名', 'SELECT 1, 2'),
  exec('语法错误', 'SELECT FROM WHERE'),
  exec('表不存在', 'SELECT * FROM no_such_table_xyz'),
  exec('除零', 'SELECT 1/0 AS x'),
  exec('敏感表只是不暴露 schema，开发环境回退主库时仍可查', "SELECT count(*) > 0 AS has_admin FROM admin_users WHERE username = 'admin'"),
  exec('只读：nextval 被拒', "SELECT nextval('kanban_boards_id_seq')"),
  exec('只读：写函数被拒', "SELECT pg_advisory_xact_lock(1) IS NULL AS locked"),
  exec('注释吞掉包裹', 'SELECT 1 AS a -- tail'),

  // ---- 类型转换（psycopg2 语义）----
  exec('标量类型', "SELECT 1::int2 a, 2::int4 b, 9007199254740993::int8 c, 1.50::numeric d, 0.00000012::numeric e, 0.0000000::numeric e2, 1e20::numeric f, 'NaN'::numeric g, 1.5::float8 h, 0.1::float4 i, 1e-7::float8 j, 1e16::float8 k, true l, 'x'::char(3) m, 'ab'::name n, 'e'::\"char\" o, 1::oid p, 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid q, 12.5::money r, '192.168.0.1/24'::inet s, B'101' t, point(1,2) u"),
  exec('时间类型', "SELECT '2024-01-01'::date a, '2024-01-01 12:00:00'::timestamp b, '2024-01-01 12:00:00.5'::timestamp c, '2024-01-01 00:00:00+00'::timestamptz d, '2024-06-01 01:02:03.4567-03:30'::timestamptz e, '12:34:56.123'::time f, '12:00:00+08'::timetz g, '12:00:00.25-05:30'::timetz h, '24:00:00'::time i, 'infinity'::timestamp j, '-infinity'::timestamp k, 'infinity'::date l, '-infinity'::date m, 'infinity'::timestamptz n, '1900-01-01 00:00:00+08:05:43'::timestamptz o"),
  exec('BC 日期报错', "SELECT '0044-03-15 BC'::date a"),
  exec('interval', "SELECT '1 day 02:00:00'::interval a, '-1 day +02:03:04.5'::interval b, '1 year 2 mons 3 days'::interval c, '-00:00:01'::interval d, '0'::interval e, '1000 days 25:00:00'::interval f, '-3 days -04:00:00'::interval g, '2 years -3 mons +4 days -05:06:07.891'::interval h, '1 mon'::interval i, '-2 days'::interval j"),
  exec('interval 溢出', "SELECT '-178000000 years'::interval a"),
  exec('json / jsonb', "SELECT '{\"b\": 1, \"a\": {\"1\": 2, \"0\": [1e2, -0.0, 0.5e-10, 12345678901234567890, true, null, \"s\"]}}'::json a, '{\"k\": \"it''s \\\"q\\\"\"}'::jsonb b, '\"str\"'::json c, '3'::json d, 'null'::json e, '[1, 2.5]'::jsonb f, '{\"z\":1,\"a\":2,\"a\":3}'::json g, '12345678901234567890'::json h"),
  exec('数组', "SELECT ARRAY[1,2] a, ARRAY['a','b''c'] b, ARRAY[1.5,2]::numeric[] c, ARRAY['2024-01-01'::date] d, ARRAY[true,null] e, ARRAY[1.5::float8, 2, 1e-5, 1e16, 'NaN', '-Infinity'] f, ARRAY[[1,2],[3,4]] g, '{}'::int[] h, ARRAY[NULL::text, 'NULL', 'a,b', '{x}', ' sp ', 'q\"x', E'back\\\\slash'] i, ARRAY['x'::name] j, ARRAY[1]::int8[] k"),
  exec('数组 时间', "SELECT ARRAY['2024-01-01 12:00:00'::timestamp, '2024-01-01 12:00:05', '2024-01-01 12:00:00.5', '2024-01-01 00:00:00'] a, ARRAY['2024-01-01 12:00:00+00'::timestamptz, '2024-01-01 12:00:00-03:30'] b, ARRAY['12:00'::time, '12:00:01', '00:00:00.000001'] c, ARRAY['1 day 2 hours'::interval, '0', '-1 sec', '3 hours', '1.5 sec'] d, ARRAY['a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid] e, ARRAY['12:00+08'::timetz, '12:00+00'] f, ARRAY['{\"a\":1}'::jsonb, '[1]'] g, ARRAY['{\"a\":[1,{}]}'::json] h"),
  exec('字符串 repr 转义', "SELECT ARRAY[E'\\x01\\x7f\\u0085\\u00a0\\u200b\\u2028 é\\U0001F600', E'q\\'\"', E'only\\'single', E'tab\\there\\nnl\\rcr', ''] a, E'\\x01 plain \\u00a0' b"),
  exec('未知类型数组原样', "SELECT ARRAY['192.168.0.1'::inet] a, ARRAY['10.0.0.0/8'::cidr] b, ARRAY[12.5::money] c, ARRAY['08:00:2b:01:02:03'::macaddr] d, ARRAY[B'101'] e, ARRAY['<a/>'::xml] f, ARRAY[point(1,2)] g, ARRAY['a b'::tsvector] i, ARRAY[1::oid] j, ARRAY['pg_class'::regclass] k, ARRAY[row(1,'x')] l, '1 2'::int2vector m, '1 2'::oidvector n, ARRAY[1::int2] o, ARRAY['ab'::varchar(5)] p, row(1, 'x') q"),
  exec('range', "SELECT int4range(1,5) a, int8range(NULL, 5, '(]') b, numrange(1.5, 2.50) c, daterange('2024-01-01', '2024-02-01') d, tsrange('2024-01-01 00:00', '2024-01-02 00:00:00.5') e, tstzrange('2024-01-01 00:00+00', NULL) f, 'empty'::int4range g, ARRAY[int4range(1,5), 'empty'] h, ARRAY[daterange('2024-01-01', NULL)] i, ARRAY[tstzrange('2024-01-01 00:00+00', '2024-01-01 00:00:00.25+00', '[]')] j, ARRAY[numrange(NULL, 0.0000001)] k"),
  exec('多段范围 / 位串', "SELECT '{[1,2), [5,7)}'::int4multirange m, B'1'::varbit v, ARRAY[1.5::numeric(5,2)] n, 'a b'::tsquery q"),
  exec('枚举 / 域 / 枚举数组（依赖测试库里的 ck_test_r7_* 类型，不存在时两边都报错）', "SELECT 'a'::ck_test_r7_mood e, 1.5::ck_test_r7_dom2 d, 'x'::ck_test_r7_dom d2, '{\"a\"}'::ck_test_r7_mood[] ea"),
  exec('LIKE 不含 %', "SELECT 1 AS a WHERE 'abc' LIKE 'a_c'"),
  exec('业务表 json 列', 'SELECT id, variables FROM ai_prompt_templates ORDER BY id LIMIT 5'),
  exec('业务表 numeric/date', 'SELECT id, score, created_at FROM cc_advanced_table_rows ORDER BY id LIMIT 5'),
  exec('聚合 array_agg', 'SELECT array_agg(title ORDER BY id) AS names, count(*) AS c FROM kanban_boards'),

  // ---- generate（需要假上游）----
  ...(FAKE_AI
    ? [
        gen('默认 SQL', '列出看板'),
        gen('提示词逐字一致（schema 文本 + 系统提示词哈希）', 'q:hash'),
        gen('markdown 代码块', 'q:fence'),
        gen('生成了写语句', 'q:unsafe'),
        gen('生成的 SQL 执行失败', 'q:badsql'),
        gen('上游 500', 'q:status500'),
        gen('上游非 JSON', 'q:notjson'),
        gen('上游缺 content', 'q:nocontent'),
        gen('上游缺 choices', 'q:nochoices'),
        gen('问题前后空白', '  q:fence \n'),
      ]
    : []),
]
