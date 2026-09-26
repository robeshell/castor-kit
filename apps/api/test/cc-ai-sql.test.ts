/**
 * AI data query: all SQL safety-check cases,
 * plus verification on a real PostgreSQL of the read-only engine, LIMIT wrapping, sensitive-table filtering, literal stripping, rejection of writes and every route branch.
 * generate, which needs AI, uses a local fake upstream (test/cc-ai-fake-upstream.ts) and never calls a real AI service.
 */

import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { loadConfig } from '@/config'
import { ReadonlyDb } from '@/db/readonly'
import { decimalStr, pgToPy, pyFloatRepr, pyStrRepr, toResponseValue } from '@/modules/component-center/ai-sql/pg-values'
import { cleanSql, isSafeSql, isVisibleTable, stripLiterals } from '@/modules/component-center/ai-sql/schema'
import type { DbHandle } from '@/db/client'
import { startFakeUpstream, type FakeUpstream } from './cc-ai-fake-upstream'
import {
  FIXTURE_PASSWORD,
  FIXTURE_USER,
  SUPER_PASSWORD,
  SUPER_USER,
  TEST_DATABASE_URL,
  buildTestApp,
  cleanupFixture,
  createFixture,
  loginSession,
  openTestDb,
  superAdminSession,
  type AuthedSession,
} from './helpers'

const P = 'ck_test_r7_'
const TABLE = `${P}sql_types`
const EXECUTE = '/api/admin/component-center/ai/sql/execute'
const GENERATE = '/api/admin/component-center/ai/sql/generate'
const SCHEMA = '/api/admin/component-center/ai/sql/schema'
const EXEC_ERROR = 'SQL 执行错误，请检查语法或表权限'
const INTERNAL = '服务器内部错误，请稍后重试'

// ---- SQL safety checks ----

describe('isSafeSql', () => {
  it('allows basic select / with cte / trailing semicolon', () => {
    expect(isSafeSql('SELECT * FROM kanban_boards')[0]).toBe(true)
    expect(isSafeSql('WITH x AS (SELECT 1) SELECT * FROM x')[0]).toBe(true)
    expect(isSafeSql('SELECT * FROM kanban_boards;')[0]).toBe(true)
  })

  it('blocks multi statement', () => {
    const [ok, reason] = isSafeSql('SELECT 1; DROP TABLE x')
    expect(ok).toBe(false)
    expect(reason).toContain('分号')
  })

  it('blocks pg_read_file / select into / set role / for update / copy', () => {
    expect(isSafeSql("SELECT pg_read_file('/etc/passwd')")[0]).toBe(false)
    expect(isSafeSql('SELECT 1 INTO new_table')[0]).toBe(false)
    expect(isSafeSql('SET ROLE postgres')[0]).toBe(false)
    expect(isSafeSql('SELECT * FROM t FOR UPDATE')[0]).toBe(false)
    expect(isSafeSql('COPY t TO stdout')[0]).toBe(false)
  })

  it('column name delete / into not false positive', () => {
    expect(isSafeSql('SELECT delete_status FROM t')[0]).toBe(true)
    expect(isSafeSql('SELECT into_x FROM t')[0]).toBe(true)
  })

  it('string literal keyword not false positive', () => {
    expect(isSafeSql("SELECT 'delete' AS label, 'drop table' AS txt FROM t")[0]).toBe(true)
    expect(isSafeSql('SELECT "DROP" FROM t')[0]).toBe(true)
  })

  it('string literal dangerous func not false positive', () => {
    expect(isSafeSql("SELECT 'pg_sleep(999)' AS note FROM t")[0]).toBe(true)
  })

  it('real dangerous func still blocked', () => {
    expect(isSafeSql('SELECT pg_sleep(5)')[0]).toBe(false)
    expect(isSafeSql("SELECT pg_read_file('/etc/passwd')")[0]).toBe(false)
  })

  it('sensitive tables hidden', () => {
    for (const table of [
      'admin_users', 'login_logs', 'operation_logs', 'roles', 'menus',
      'user_roles', 'role_menus', 'scheduled_tasks', 'scheduled_task_runs',
    ]) {
      expect(isVisibleTable(table)).toBe(false)
    }
    expect(isVisibleTable('kanban_boards')).toBe(true)
    expect(isVisibleTable('AUDIT_x')).toBe(false)
    expect(isVisibleTable(null)).toBe(true)
  })

  it('ai sql engine fail-closed in production', () => {
    expect(() => loadConfig({ NODE_ENV: 'production', SECRET_KEY: 's', ADMIN_PASSWORD: 'p', DATABASE_URL: 'postgresql://superuser:pw@db/castor_kit' })).toThrow(
      /AI_SQL_DATABASE_URL/,
    )
  })

  it('ai sql engine uses explicit url in production', () => {
    const config = loadConfig({
      NODE_ENV: 'production',
      SECRET_KEY: 's',
      ADMIN_PASSWORD: 'p',
      DATABASE_URL: 'postgresql://superuser:pw@db/castor_kit',
      AI_SQL_DATABASE_URL: 'postgresql://castor_kit_ro:pw@db/castor_kit',
    })
    expect(config.aiSqlDatabaseUrl.startsWith('postgresql://castor_kit_ro')).toBe(true)
  })

  it('ai sql engine dev fallback to main db', () => {
    const config = loadConfig({ NODE_ENV: 'development', DEV_DATABASE_URL: 'postgresql://superuser:pw@db/castor_kit' })
    expect(config.aiSqlDatabaseUrl).toContain('@db/castor_kit')
  })
})

describe('isSafeSql 细节', () => {
  it('各拦截原因文案', () => {
    expect(isSafeSql('UPDATE t SET a = 1')).toEqual([false, '只允许 SELECT 查询语句'])
    expect(isSafeSql("SELECT ';'")).toEqual([false, '仅允许单条语句，不能包含分号'])
    expect(isSafeSql('SELECT 1 AS do')).toEqual([false, 'SQL 包含不允许的操作关键字：DO'])
    expect(isSafeSql('WITH d AS (DELETE FROM t RETURNING *) SELECT * FROM d')).toEqual([false, 'SQL 包含不允许的操作关键字：DELETE'])
    expect(isSafeSql('SELECT * FROM t FOR\n\tSHARE')).toEqual([false, '不允许使用 FOR UPDATE / FOR SHARE'])
    expect(isSafeSql('select pg_sleep (1)')).toEqual([false, 'SQL 使用了不允许的函数：pg_sleep'])
  })

  it('注释剥离、尾部多个分号', () => {
    expect(isSafeSql('-- x\nSELECT 1 /* delete */ -- drop')[0]).toBe(true)
    expect(isSafeSql('select 1 ;;  ')[0]).toBe(true)
    expect(isSafeSql('select 1; ;')[0]).toBe(false)
  })

  it('单词边界按 Unicode 单词字符（Python re）', () => {
    expect(isSafeSql('SELECT 1 AS 中DELETE')[0]).toBe(true)
    expect(isSafeSql('SELECT 1 AS éSET')[0]).toBe(true)
    expect(isSafeSql('SELECT 1 AS "x" , 2 AS a·DELETE')[0]).toBe(false)
  })

  it('字面量剥离与 markdown 代码块清理', () => {
    expect(stripLiterals(`SELECT 'it''s', "a""b" FROM t`)).toBe('SELECT  ,   FROM t')
    expect(cleanSql('```sql\nSELECT 1;\n```')).toBe('SELECT 1;')
    expect(cleanSql('  ```\nSELECT 2\n```  ')).toBe('SELECT 2')
    expect(cleanSql('```SQL SELECT 3```')).toBe('SELECT 3')
  })
})

describe('Python 值转换', () => {
  it('Decimal / float repr / str repr', () => {
    expect(decimalStr('1.50')).toBe('1.50')
    expect(decimalStr('0.00000012')).toBe('1.2E-7')
    expect(decimalStr('0.0000001000')).toBe('1.000E-7')
    expect(decimalStr('0.0000000')).toBe('0E-7')
    expect(decimalStr('0.00')).toBe('0.00')
    expect(decimalStr('-0.0000001')).toBe('-1E-7')
    expect(decimalStr('100000000000000000000')).toBe('100000000000000000000')
    expect(pyFloatRepr(2)).toBe('2.0')
    expect(pyFloatRepr(1e-5)).toBe('1e-05')
    expect(pyFloatRepr(1e16)).toBe('1e+16')
    expect(pyFloatRepr(1.2345679e20)).toBe('1.2345679e+20')
    expect(pyFloatRepr(-0)).toBe('-0.0')
    expect(pyFloatRepr(0.0001)).toBe('0.0001')
    expect(pyStrRepr("it's")).toBe(`"it's"`)
    expect(pyStrRepr(`q'"`)).toBe(`'q\\'"'`)
    expect(pyStrRepr('\x01\x7f\x85\xa0\u200b\u2028 é😀')).toBe("'\\x01\\x7f\\x85\\xa0\\u200b\\u2028 é😀'")
  })

  it('interval → str(timedelta)（年=365 天、月=30 天）', () => {
    const iv = (text: string) => toResponseValue(pgToPy(text, 1186))
    expect(iv('1 day 02:00:00')).toBe('1 day, 2:00:00')
    expect(iv('-1 days +02:03:04.5')).toBe('-1 day, 2:03:04.500000')
    expect(iv('1 year 2 mons 3 days')).toBe('428 days, 0:00:00')
    expect(iv('-00:00:01')).toBe('-1 day, 23:59:59')
    expect(iv('00:00:00')).toBe('0:00:00')
    expect(iv('-3 days -04:00:00')).toBe('-4 days, 20:00:00')
  })

  it('json 保序、大整数精确、repr', () => {
    const json = toResponseValue(pgToPy('{"b": 1, "a": {"1": 2, "0": [1e2, -0.0, 12345678901234567890, true, null, "s"]}}', 114))
    expect(json).toBe("{'b': 1, 'a': {'1': 2, '0': [100.0, -0.0, 12345678901234567890, True, None, 's']}}")
    expect(JSON.stringify({ v: toResponseValue(pgToPy('9007199254740993', 20)) })).toBe('{"v":9007199254740993}')
    expect(toResponseValue(pgToPy('"str"', 3802))).toBe('str')
  })

  it('数组 / 时间 / range', () => {
    expect(toResponseValue(pgToPy('{"2024-01-01 12:00:00","2024-01-01 12:00:00.5"}', 1115))).toBe(
      '[datetime.datetime(2024, 1, 1, 12, 0), datetime.datetime(2024, 1, 1, 12, 0, 0, 500000)]',
    )
    expect(toResponseValue(pgToPy('{"2024-01-01 20:00:00+08"}', 1185))).toBe(
      '[datetime.datetime(2024, 1, 1, 20, 0, tzinfo=datetime.timezone(datetime.timedelta(seconds=28800)))]',
    )
    expect(toResponseValue(pgToPy('{1.5,2}', 1231))).toBe("[Decimal('1.5'), Decimal('2')]")
    expect(toResponseValue(pgToPy('{NULL,"NULL","a,b"}', 1009))).toBe("[None, 'NULL', 'a,b']")
    expect(toResponseValue(pgToPy('2024-06-01 01:02:03.4567-03:30', 1184))).toBe('2024-06-01T01:02:03.456700-03:30')
    expect(toResponseValue(pgToPy('infinity', 1114))).toBe('9999-12-31T23:59:59.999999')
    expect(toResponseValue(pgToPy('24:00:00', 1083))).toBe('00:00:00')
    expect(toResponseValue(pgToPy('[1,5)', 3904))).toBe('[1, 5)')
    expect(toResponseValue(pgToPy('{"[1,5)",empty}', 3905))).toBe("[NumericRange(1, 5, '[)'), NumericRange(empty=True)]")
    expect(toResponseValue(pgToPy('{192.168.0.1}', 1041))).toBe("['192.168.0.1']")
    expect(toResponseValue(pgToPy('{$12.50}', 791))).toBe('{$12.50}')
  })
})

// ---- Read-only connection pool (real PG) ----

describe('ReadonlyDb（只读引擎）', () => {
  let ro: ReadonlyDb
  beforeAll(() => {
    ro = new ReadonlyDb(TEST_DATABASE_URL, 5000, { max: 1 })
  })
  afterAll(async () => {
    await ro.close()
  })

  it('连接级 + 事务级强制只读：绕过 isSafeSql 的写语句也被数据库拒绝', async () => {
    await expect(ro.query(`CREATE TABLE ${P}should_not_exist (id int)`)).rejects.toThrow(/read-only transaction/)
    const opts = await ro.query("SELECT current_setting('default_transaction_read_only'), current_setting('transaction_read_only')")
    expect(opts.rows[0]).toEqual(['on', 'on'])
  })

  it('池化连接被 set_config 毒化也无效（事务回滚 + 每次重新 SET LOCAL）', async () => {
    await ro.query("SELECT set_config('default_transaction_read_only', 'off', false)")
    await expect(ro.query(`CREATE TABLE ${P}should_not_exist (id int)`)).rejects.toThrow(/read-only transaction/)
    const again = await ro.query("SELECT current_setting('default_transaction_read_only')")
    expect(again.rows[0]).toEqual(['on'])
  })

  it('statement_timeout 生效', async () => {
    const fast = new ReadonlyDb(TEST_DATABASE_URL, 100, { max: 1 })
    try {
      await expect(fast.query('SELECT pg_sleep(1)')).rejects.toThrow(/statement timeout/)
      const t = await fast.query("SELECT current_setting('statement_timeout')")
      expect(t.rows[0]).toEqual(['100ms'])
    } finally {
      await fast.close()
    }
  })

  it('扩展协议：单次只能执行一条语句', async () => {
    await expect(ro.query('SELECT 1; SELECT 2')).rejects.toThrow()
  })

  it('原始文本行 + 列类型 OID', async () => {
    const res = await ro.query("SELECT 1::int8 AS a, NULL::text AS b, '2024-01-01 00:00:00'::timestamp AS c")
    expect(res.fields).toEqual([
      { name: 'a', dataTypeID: 20 },
      { name: 'b', dataTypeID: 25 },
      { name: 'c', dataTypeID: 1114 },
    ])
    expect(res.rows).toEqual([['1', null, '2024-01-01 00:00:00']])
  })
})

// ---- Routes ----

describe('AI SQL 路由', () => {
  let app: FastifyInstance
  let unconfigured: FastifyInstance
  let handle: DbHandle
  let s: AuthedSession
  let noKey: AuthedSession
  let up: FakeUpstream

  beforeAll(async () => {
    handle = openTestDb()
    up = await startFakeUpstream()
    app = await buildTestApp({ settingsEnv: { AI_API_BASE: up.url, AI_API_KEY: 'x', AI_MODEL: 'm' } })
    unconfigured = await buildTestApp()
    // createFixture first removes all ck_test_ users (including the super test account), so create fixtures before logging in as super
    await createFixture(handle)
    s = await superAdminSession(app, handle)
    noKey = await loginSession(unconfigured, SUPER_USER, SUPER_PASSWORD)
    await handle.pool.query(`DROP TABLE IF EXISTS ${TABLE}`)
    await handle.pool.query(`DROP TYPE IF EXISTS ${P}enum_t`)
    await handle.pool.query(`DROP DOMAIN IF EXISTS ${P}dom_t`)
    await handle.pool.query(`CREATE TYPE ${P}enum_t AS ENUM ('a', 'bbb')`)
    await handle.pool.query(`CREATE DOMAIN ${P}dom_t AS varchar(7)`)
    await handle.pool.query(`
      CREATE TABLE ${TABLE} (
        id serial PRIMARY KEY, a bigint NOT NULL DEFAULT 5, c varchar, d char(3), e numeric, f numeric(10,0),
        h double precision, i timestamp(3), j timestamptz, l timetz, p jsonb, q int[], s boolean DEFAULT true,
        u varchar(20) DEFAULT 'x', z xml, al int GENERATED ALWAYS AS IDENTITY, am int GENERATED ALWAYS AS (a * 2) STORED,
        an "char", en ${P}enum_t, dm ${P}dom_t, vb varbit(4)
      )`)
    await handle.pool.query(`INSERT INTO ${TABLE} (c, e, p, q) SELECT 'row' || g, g * 1.5, '{"k": "v"}', ARRAY[g] FROM generate_series(1, 3) g`)
  })

  afterAll(async () => {
    await handle.pool.query(`DROP TABLE IF EXISTS ${TABLE}`)
    await handle.pool.query(`DROP TYPE IF EXISTS ${P}enum_t`)
    await handle.pool.query(`DROP DOMAIN IF EXISTS ${P}dom_t`)
    await cleanupFixture(handle)
    await app.close()
    await unconfigured.close()
    await up.close()
    await handle.pool.end()
  })

  it('未登录 401；无权限 403', async () => {
    for (const [method, url] of [['GET', SCHEMA], ['POST', EXECUTE], ['POST', GENERATE]] as const) {
      const res = await app.inject({ method, url, payload: method === 'POST' ? { sql: 'SELECT 1' } : undefined })
      expect(res.statusCode).toBe(401)
      expect(res.json()).toEqual({ error: '未授权访问', redirect: '/admin/login' })
    }
    const plain = await loginSession(app, FIXTURE_USER, FIXTURE_PASSWORD)
    for (const [method, url] of [['GET', SCHEMA], ['POST', EXECUTE], ['POST', GENERATE]] as const) {
      const res = await plain.inject({ method, url, payload: method === 'POST' ? {} : undefined })
      expect(res.statusCode).toBe(403)
      expect(res.json()).toEqual({ error: '无权限' })
    }
  })

  it('schema：敏感表不出现在 tables 与 schema 文本里；类型名为大写 SQL 类型写法', async () => {
    const res = await s.inject({ url: SCHEMA })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { tables: string[]; schema: string }
    expect(Object.keys(body).sort()).toEqual(['schema', 'tables'])
    expect(body.tables).toEqual([...body.tables].sort())
    expect(body.tables).toContain('kanban_boards')
    expect(body.tables).toContain(TABLE)
    for (const hidden of ['admin_users', 'roles', 'menus', 'user_roles', 'role_menus', 'operation_logs', 'login_logs', 'scheduled_tasks', 'scheduled_task_runs']) {
      expect(body.tables).not.toContain(hidden)
      expect(body.schema).not.toContain(`TABLE ${hidden} (`)
    }
    const block = body.schema.split('\n\n').find((b) => b.startsWith(`TABLE ${TABLE} (`))
    expect(block).toBe(
      [
        `TABLE ${TABLE} (`,
        `  id  INTEGER NOT NULL DEFAULT nextval('${TABLE}_id_seq'::regclass),`,
        '  a  BIGINT NOT NULL DEFAULT 5,',
        '  c  VARCHAR,',
        '  d  CHAR(3),',
        '  e  NUMERIC,',
        '  f  NUMERIC(10, 0),',
        '  h  DOUBLE PRECISION,',
        '  i  TIMESTAMP,',
        '  j  TIMESTAMP,',
        '  l  TIME,',
        '  p  JSONB,',
        '  q  ARRAY,',
        '  s  BOOLEAN DEFAULT true,',
        "  u  VARCHAR(20) DEFAULT 'x'::character varying,",
        '  z  NULL,',
        '  al  INTEGER NOT NULL,',
        '  am  INTEGER,',
        '  an  VARCHAR,',
        '  en  VARCHAR(3),',
        '  dm  DOMAIN,',
        '  vb  BIT',
        ')',
      ].join('\n'),
    )
  })

  it('execute：参数校验', async () => {
    for (const body of [{}, { sql: '' }, { sql: '  \n' }, { sql: null }, { sql: 0 }]) {
      const res = await s.inject({ method: 'POST', url: EXECUTE, payload: body })
      expect(res.statusCode).toBe(400)
      expect(res.json()).toEqual({ error: 'SQL 不能为空' })
    }
    // Non-string truthy value → global 500 generic message
    for (const sql of [5, ['SELECT 1'], { a: 1 }, true]) {
      const res = await s.inject({ method: 'POST', url: EXECUTE, payload: { sql } })
      expect(res.statusCode).toBe(500)
      expect(res.json()).toEqual({ error: INTERNAL })
    }
  })

  it('execute：写操作 / 多语句 / 高危函数被拒（400 仅 error）', async () => {
    const cases: [string, string][] = [
      ['DELETE FROM kanban_boards', '只允许 SELECT 查询语句'],
      ['SELECT 1; DROP TABLE x', '仅允许单条语句，不能包含分号'],
      ['SELECT 1 INTO new_table', 'SQL 包含不允许的操作关键字：INTO'],
      ["SELECT set_config('default_transaction_read_only','off',false)", 'SQL 使用了不允许的函数：set_config'],
      ['SELECT pg_sleep(5)', 'SQL 使用了不允许的函数：pg_sleep'],
    ]
    for (const [sql, error] of cases) {
      const res = await s.inject({ method: 'POST', url: EXECUTE, payload: { sql } })
      expect(res.statusCode).toBe(400)
      expect(res.json()).toEqual({ error })
    }
  })

  it('execute：通过 isSafeSql 但会写库的语句由只读事务拦下', async () => {
    const res = await s.inject({ method: 'POST', url: EXECUTE, payload: { sql: `SELECT nextval('${TABLE}_id_seq')` } })
    expect(res.statusCode).toBe(400)
    expect(res.json()).toEqual({ error: EXEC_ERROR, sql: `SELECT nextval('${TABLE}_id_seq')` })
    const count = await handle.pool.query(`SELECT last_value, is_called FROM ${TABLE}_id_seq`)
    expect(count.rows[0]).toEqual({ last_value: '3', is_called: true })
  })

  it('execute：LIMIT 包裹与 truncated', async () => {
    const big = await s.inject({ method: 'POST', url: EXECUTE, payload: { sql: 'SELECT generate_series(1, 301) AS n;' } })
    expect(big.statusCode).toBe(200)
    const body = big.json()
    expect(Object.keys(body).sort()).toEqual(['columns', 'row_count', 'rows', 'sql', 'truncated'])
    expect(body.sql).toBe('SELECT generate_series(1, 301) AS n;')
    expect(body.columns).toEqual(['n'])
    expect(body.row_count).toBe(200)
    expect(body.truncated).toBe(true)
    expect(body.rows[199]).toEqual({ n: 200 })

    const exact = (await s.inject({ method: 'POST', url: EXECUTE, payload: { sql: 'SELECT generate_series(1, 200) AS n' } })).json()
    expect(exact.row_count).toBe(200)
    expect(exact.truncated).toBe(false)
  })

  it('execute：字面量剥离后放行，结果行按 Python 规则序列化', async () => {
    const res = await s.inject({
      method: 'POST',
      url: EXECUTE,
      payload: { sql: `  SELECT id, c, e, p, q, 'delete' AS label, 1 AS "DROP" FROM ${TABLE} ORDER BY id  ` },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.sql).toBe(`SELECT id, c, e, p, q, 'delete' AS label, 1 AS "DROP" FROM ${TABLE} ORDER BY id`)
    expect(body.columns).toEqual(['id', 'c', 'e', 'p', 'q', 'label', 'DROP'])
    expect(body.rows[0]).toEqual({ id: 1, c: 'row1', e: '1.5', p: "{'k': 'v'}", q: '[1]', label: 'delete', DROP: 1 })
  })

  it('execute：执行错误 400 带 sql；重复列名取最后一个值', async () => {
    const bad = await s.inject({ method: 'POST', url: EXECUTE, payload: { sql: 'SELECT * FROM no_such_table_xyz' } })
    expect(bad.statusCode).toBe(400)
    expect(bad.json()).toEqual({ error: EXEC_ERROR, sql: 'SELECT * FROM no_such_table_xyz' })
    const dup = (await s.inject({ method: 'POST', url: EXECUTE, payload: { sql: 'SELECT 1 AS a, 2 AS a' } })).json()
    expect(dup.columns).toEqual(['a', 'a'])
    expect(dup.rows).toEqual([{ a: 2 }])
  })

  it('execute：LIKE 里的 % 正常执行（不被当作占位符）', async () => {
    const res = await s.inject({ method: 'POST', url: EXECUTE, payload: { sql: "SELECT 1 AS a WHERE 'abc' LIKE '%b%'" } })
    expect(res.statusCode).toBe(200)
    expect(res.json().rows).toEqual([{ a: 1 }])
  })

  it('generate：参数校验', async () => {
    for (const body of [{}, { question: '' }, { question: ' \u3000 ' }, { question: null }]) {
      const res = await s.inject({ method: 'POST', url: GENERATE, payload: body })
      expect(res.statusCode).toBe(400)
      expect(res.json()).toEqual({ error: '问题不能为空' })
    }
    const res = await s.inject({ method: 'POST', url: GENERATE, payload: { question: { a: 1 } } })
    expect(res.statusCode).toBe(500)
    expect(res.json()).toEqual({ error: INTERNAL })
  })

  it('generate：成功（系统提示词 + schema 文本 + 问题发给上游）', async () => {
    const before = up.requests.length
    const res = await s.inject({ method: 'POST', url: GENERATE, payload: { question: '  列出看板  ' } })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.sql).toBe('SELECT id, title FROM kanban_boards ORDER BY id LIMIT 3')
    expect(Object.keys(body).sort()).toEqual(['columns', 'row_count', 'rows', 'sql', 'truncated'])
    expect(body.columns).toEqual(['id', 'title'])

    const req = up.requests[before]!
    expect(req.headers.authorization).toBe('Bearer x')
    expect(req.body.model).toBe('m')
    expect(req.body.stream).toBeUndefined()
    const [system, user] = req.body.messages!
    expect(system!.role).toBe('system')
    expect(String(system!.content)).toContain('你是一个 PostgreSQL 专家')
    expect(user!.role).toBe('user')
    const schemaText = (await s.inject({ url: SCHEMA })).json().schema
    expect(user!.content).toBe(`数据库结构如下：\n\n${schemaText}\n\n问题：列出看板`)
  })

  it('generate：markdown 代码块被剥掉；生成写语句 400 带 sql；执行失败 400 带 sql', async () => {
    const fence = (await s.inject({ method: 'POST', url: GENERATE, payload: { question: 'q:fence' } })).json()
    expect(fence.sql).toBe('SELECT 1 AS one;')
    expect(fence.rows).toEqual([{ one: 1 }])

    const unsafe = await s.inject({ method: 'POST', url: GENERATE, payload: { question: 'q:unsafe' } })
    expect(unsafe.statusCode).toBe(400)
    expect(unsafe.json()).toEqual({ error: '只允许 SELECT 查询语句', sql: 'DELETE FROM kanban_boards' })

    const bad = await s.inject({ method: 'POST', url: GENERATE, payload: { question: 'q:badsql' } })
    expect(bad.statusCode).toBe(400)
    expect(bad.json()).toEqual({ error: EXEC_ERROR, sql: 'SELECT * FROM no_such_table_xyz' })
  })

  it('generate：上游/配置错误分支', async () => {
    const configError = { error: 'AI 生成失败，请检查模型配置后重试' }
    for (const [question, expected] of [
      ['q:status500', { error: 'AI 生成失败（模型服务返回 500），请检查模型配置后重试' }],
      ['q:status429', { error: 'AI 生成失败：模型服务的调用次数已达上限（429），请稍后再试' }],
      ['q:notjson', configError],
      ['q:nocontent', configError],
      ['q:nochoices', configError],
    ] as const) {
      const res = await s.inject({ method: 'POST', url: GENERATE, payload: { question } })
      expect(res.statusCode).toBe(500)
      expect(res.json()).toEqual(expected)
    }
    // AI_API_KEY not configured
    const res = await noKey.inject({ method: 'POST', url: GENERATE, payload: { question: 'x' } })
    expect(res.statusCode).toBe(500)
    expect(res.json()).toEqual(configError)
  })

  it('generate：没有接口地址 → 配置错误；上游连不上 → 通用错误', async () => {
    const badBase = await buildTestApp({ settingsEnv: { AI_API_KEY: 'x' } })
    const refused = await buildTestApp({ settingsEnv: { AI_API_BASE: 'http://127.0.0.1:1', AI_API_KEY: 'x', AI_MODEL: 'm' } })
    try {
      const a = await loginSession(badBase, SUPER_USER, SUPER_PASSWORD)
      const r1 = await a.inject({ method: 'POST', url: GENERATE, payload: { question: 'x' } })
      expect(r1.json()).toEqual({ error: 'AI 生成失败，请检查模型配置后重试' })
      const b = await loginSession(refused, SUPER_USER, SUPER_PASSWORD)
      const r2 = await b.inject({ method: 'POST', url: GENERATE, payload: { question: 'x' } })
      expect(r2.statusCode).toBe(500)
      expect(r2.json()).toEqual({ error: 'AI 生成失败' })
    } finally {
      await badBase.close()
      await refused.close()
    }
  })
})
