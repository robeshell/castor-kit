/**
 * shadow-diff：分别登录 Flask（参考 oracle）与 Node 两个后端，对同一批请求做 JSON diff（rewrite-plan §11）。
 *
 * 用法：
 *   pnpm shadow-diff -- --flask http://localhost:5003 --node http://localhost:5002 [--user admin --password admin123]
 *
 * 两个后端应连同一个库。已知的不可比字段在 normalize() 里处理：
 * - csrf_token 每个会话随机 → 只比较是否存在
 * - menu_codes：Python 是 list(set(...))，顺序不保证 → 排序后比较
 * - roles：SQLAlchemy secondary 关系的加载顺序不保证 → 按 id 排序后比较
 * - /health 的 timestamp 是各自的当前时间 → 只比较格式
 * 用例按模块放在 scripts/shadow-cases/<module>.ts（导出 `cases: ShadowCase[]`），互不冲突。
 * 写接口用例两个后端都会真实写库：只在测试库上跑，并用 ignoreKeys 忽略 id / 时间等必然不同的字段。
 * `--only <前缀>` 只跑名称以该前缀开头的用例（前缀即文件名，如 --only users）。
 */

import { readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import type { ShadowCase } from './shadow-cases/types'

const { values: args } = parseArgs({
  options: {
    flask: { type: 'string', default: 'http://localhost:5003' },
    node: { type: 'string', default: 'http://localhost:5002' },
    user: { type: 'string', default: 'admin' },
    password: { type: 'string', default: 'admin123' },
    only: { type: 'string' },
  },
})

const casesDir = join(dirname(fileURLToPath(import.meta.url)), 'shadow-cases')
const CASES: ShadowCase[] = []
for (const file of readdirSync(casesDir).filter((f) => f.endsWith('.ts') && f !== 'types.ts').sort()) {
  const mod = (await import(pathToFileURL(join(casesDir, file)).href)) as { cases: ShadowCase[] }
  const prefix = file.replace(/\.ts$/, '')
  for (const c of mod.cases) CASES.push({ ...c, name: `${prefix}: ${c.name}` })
}

interface Session {
  base: string
  cookie: string
  csrf: string
}

async function login(base: string): Promise<Session> {
  const res = await fetch(`${base}/api/admin/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: args.user, password: args.password }),
  })
  if (res.status !== 200) throw new Error(`${base} 登录失败：${res.status} ${await res.text()}`)
  const cookie = res.headers
    .getSetCookie()
    .map((c) => c.split(';', 1)[0])
    .join('; ')
  const body = (await res.json()) as { csrf_token: string }
  return { base, cookie, csrf: body.csrf_token }
}

async function call(session: Session, c: ShadowCase): Promise<{ status: number; body: unknown }> {
  const headers: Record<string, string> = {}
  if (c.auth) headers.cookie = session.cookie
  if (c.body !== undefined) headers['content-type'] = 'application/json'
  const method = c.method ?? 'GET'
  if (c.auth && method !== 'GET' && !c.noCsrf) headers['x-csrf-token'] = session.csrf
  const res = await fetch(`${session.base}${c.path}`, {
    method,
    headers,
    body: c.body === undefined ? undefined : JSON.stringify(c.body),
    redirect: 'manual',
  })
  const buf = Buffer.from(await res.arrayBuffer())
  const ctype = res.headers.get('content-type') ?? ''
  if (ctype.includes('spreadsheetml')) {
    // xlsx 是 zip，字节里含时间戳；比较解析后的单元格
    const ExcelJS = (await import('exceljs')).default
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(buf as unknown as ArrayBuffer)
    const rows: unknown[] = []
    wb.worksheets[0]?.eachRow((row) => rows.push((row.values as unknown[]).slice(1)))
    return { status: res.status, body: { xlsx: rows, disposition: res.headers.get('content-disposition') } }
  }
  const text = buf.toString('utf8')
  let body: unknown = ctype.includes('text/csv') ? { csv: text, disposition: res.headers.get('content-disposition') } : text
  try {
    body = JSON.parse(text)
  } catch {
    /* 非 JSON 原样比较 */
  }
  return { status: res.status, body }
}

function normalize(value: unknown, key = '', ignore: Set<string> = new Set()): unknown {
  if (Array.isArray(value)) {
    const items = value.map((v) => normalize(v, '', ignore))
    if (key === 'menu_codes') return [...(items as string[])].sort()
    if (key === 'roles') return [...(items as { id: number }[])].sort((a, b) => a.id - b.id)
    return items
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => {
          if (ignore.has(k)) return [k, '<ignored>']
          if (k === 'csrf_token') return [k, typeof v === 'string' && v.length > 0 ? '<token>' : v]
          if (k === 'timestamp' && typeof v === 'string') return [k, v.replace(/\d/g, '0').replace(/\.0+$/, '')]
          return [k, normalize(v, k, ignore)]
        }),
    )
  }
  return value
}

function diff(a: unknown, b: unknown, path = '$'): string[] {
  if (JSON.stringify(a) === JSON.stringify(b)) return []
  if (a && b && typeof a === 'object' && typeof b === 'object' && Array.isArray(a) === Array.isArray(b)) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)])
    return [...keys].flatMap((k) =>
      diff((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], `${path}.${k}`),
    )
  }
  return [`${path}: flask=${JSON.stringify(a)?.slice(0, 200)} node=${JSON.stringify(b)?.slice(0, 200)}`]
}

const [flask, node] = await Promise.all([login(args.flask), login(args.node)])
let failures = 0
for (const c of CASES.filter((x) => !args.only || x.name.startsWith(args.only))) {
  // 写接口顺序执行，避免两个后端并发写同一行
  const fr = await call(flask, c)
  const nr = await call(node, c)
  const ignore = new Set(c.ignoreKeys ?? [])
  const problems = [
    ...(fr.status !== nr.status ? [`status: flask=${fr.status} node=${nr.status}`] : []),
    ...diff(normalize(fr.body, '', ignore), normalize(nr.body, '', ignore)),
  ]
  if (problems.length === 0) {
    console.log(`✓ ${c.name}`)
  } else {
    failures += 1
    console.log(`✗ ${c.name}`)
    for (const p of problems.slice(0, 20)) console.log(`    ${p}`)
  }
}
console.log(failures === 0 ? '\nshadow-diff：无差异' : `\nshadow-diff：${failures} 个用例有差异`)
process.exit(failures === 0 ? 0 : 1)
