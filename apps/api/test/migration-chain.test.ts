/**
 * 迁移链完整性
 *
 * 并行生成迁移会让链分叉；Drizzle 迁移链需满足：
 * - meta/_journal.json 的 entries：idx 从 0 连续递增、tag 唯一且以 4 位 idx 开头、when 严格递增
 *   （migrator 只执行 folderMillis 大于库中最后一条记录的迁移，when 乱序 = 迁移被静默跳过）
 * - 每条 entry 有 <tag>.sql 与 meta/<idx>_snapshot.json；drizzle/ 下没有未登记的 .sql
 * - snapshot 的 prevId 串成单链（首条 prevId 为全 0 UUID）：两人并行 generate 会得到同一个 prevId → 分叉
 */

import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'

const DRIZZLE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../drizzle')
const ROOT_PREV_ID = '00000000-0000-0000-0000-000000000000'

interface JournalEntry {
  idx: number
  when: number
  tag: string
}

interface ChainResult {
  passed: boolean
  skipped?: boolean
  head?: string
  error?: string
}

function checkMigrationChain(drizzleDir: string): ChainResult {
  const journalPath = join(drizzleDir, 'meta', '_journal.json')
  if (!existsSync(journalPath)) return { passed: true, skipped: true }
  const entries = (JSON.parse(readFileSync(journalPath, 'utf8')) as { entries?: JournalEntry[] }).entries ?? []
  if (entries.length === 0) return { passed: true, skipped: true }

  const details: string[] = []
  entries.forEach((entry, i) => {
    if (entry.idx !== i) details.push(`idx 不连续: 第 ${i} 条的 idx=${entry.idx}`)
    if (!entry.tag.startsWith(`${String(entry.idx).padStart(4, '0')}_`)) details.push(`tag 与 idx 不符: ${entry.tag}`)
    if (i > 0 && entry.when <= entries[i - 1]!.when) details.push(`when 未严格递增: ${entry.tag}（会被 migrator 跳过）`)
    if (!existsSync(join(drizzleDir, `${entry.tag}.sql`))) details.push(`缺少 SQL 文件: ${entry.tag}.sql`)
  })
  const tags = entries.map((e) => e.tag)
  const dupTags = tags.filter((t, i) => tags.indexOf(t) !== i)
  if (dupTags.length) details.push(`tag 重复: ${dupTags.join(', ')}`)
  const orphanSql = readdirSync(drizzleDir)
    .filter((f) => f.endsWith('.sql'))
    .filter((f) => !tags.includes(f.replace(/\.sql$/, '')))
  if (orphanSql.length) details.push(`SQL 文件未登记到 journal: ${orphanSql.join(', ')}`)

  // snapshot prevId 链：每个 snapshot 指向上一个，首尾相接成单链
  const snapshots: Array<{ id: string; prevId: string; tag: string }> = []
  for (const entry of entries) {
    const file = join(drizzleDir, 'meta', `${String(entry.idx).padStart(4, '0')}_snapshot.json`)
    if (!existsSync(file)) {
      details.push(`缺少快照: meta/${String(entry.idx).padStart(4, '0')}_snapshot.json`)
      continue
    }
    const snap = JSON.parse(readFileSync(file, 'utf8')) as { id: string; prevId: string }
    snapshots.push({ id: snap.id, prevId: snap.prevId, tag: entry.tag })
  }
  const ids = new Set(snapshots.map((s) => s.id))
  const roots = snapshots.filter((s) => s.prevId === ROOT_PREV_ID).map((s) => s.tag)
  const orphans = snapshots.filter((s) => s.prevId !== ROOT_PREV_ID && !ids.has(s.prevId)).map((s) => s.tag)
  const children = new Map<string, string[]>()
  for (const s of snapshots) children.set(s.prevId, [...(children.get(s.prevId) ?? []), s.tag])
  const heads = snapshots.filter((s) => !children.has(s.id)).map((s) => s.tag)
  if (roots.length !== 1) details.push(`多个根: ${JSON.stringify(roots)}`)
  if (heads.length !== 1) details.push(`多个 head: ${JSON.stringify(heads)}（存在分叉）`)
  if (orphans.length) details.push(`prevId 指向未定义祖先: ${JSON.stringify(orphans)}`)
  snapshots.forEach((s, i) => {
    const expectedPrev = i === 0 ? ROOT_PREV_ID : snapshots[i - 1]!.id
    if (s.prevId !== expectedPrev && roots.length === 1 && heads.length === 1 && !orphans.length) {
      details.push(`快照链与 journal 顺序不一致: ${s.tag}`)
    }
  })

  if (details.length) return { passed: false, error: details.join('；') }
  return { passed: true, head: entries[entries.length - 1]!.tag }
}

// ---- 夹具 ----

const tmpDirs: string[] = []
afterEach(() => {
  for (const dir of tmpDirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

interface Spec {
  tag: string
  when: number
  id: string
  prevId: string
  sql?: boolean
  snapshot?: boolean
  idx?: number
}

function writeChain(specs: Spec[], extraSql: string[] = []): string {
  const dir = mkdtempSync(join(tmpdir(), 'ck-test-r8-drizzle-'))
  tmpDirs.push(dir)
  mkdirSync(join(dir, 'meta'))
  const entries = specs.map((s, i) => ({ idx: s.idx ?? i, version: '7', when: s.when, tag: s.tag, breakpoints: true }))
  writeFileSync(join(dir, 'meta', '_journal.json'), JSON.stringify({ version: '7', dialect: 'postgresql', entries }))
  specs.forEach((s, i) => {
    if (s.sql !== false) writeFileSync(join(dir, `${s.tag}.sql`), 'SELECT 1;')
    if (s.snapshot !== false) {
      writeFileSync(
        join(dir, 'meta', `${String(s.idx ?? i).padStart(4, '0')}_snapshot.json`),
        JSON.stringify({ id: s.id, prevId: s.prevId }),
      )
    }
  })
  for (const f of extraSql) writeFileSync(join(dir, f), 'SELECT 1;')
  return dir
}

const linear: Spec[] = [
  { tag: '0000_a', when: 1, id: 'a1', prevId: ROOT_PREV_ID },
  { tag: '0001_b', when: 2, id: 'b1', prevId: 'a1' },
  { tag: '0002_c', when: 3, id: 'c1', prevId: 'b1' },
]

describe('checkMigrationChain', () => {
  it('线性链通过，head 为最后一条', () => {
    expect(checkMigrationChain(writeChain(linear))).toEqual({ passed: true, head: '0002_c' })
  })

  it('分叉（两条迁移基于同一个 prevId）失败', () => {
    const res = checkMigrationChain(writeChain([linear[0]!, linear[1]!, { tag: '0002_c', when: 3, id: 'c1', prevId: 'a1' }]))
    expect(res.passed).toBe(false)
    expect(res.error).toContain('多个 head')
  })

  it('prevId 指向不存在的祖先失败', () => {
    const res = checkMigrationChain(writeChain([linear[0]!, { tag: '0001_b', when: 2, id: 'b1', prevId: 'ghost' }]))
    expect(res.passed).toBe(false)
    expect(res.error).toContain('未定义祖先')
  })

  it('idx 不连续 / when 乱序 / 缺 SQL / 未登记的 SQL / 缺快照 都失败', () => {
    expect(checkMigrationChain(writeChain([linear[0]!, { ...linear[1]!, idx: 2, tag: '0002_b' }])).error).toContain('idx 不连续')
    expect(checkMigrationChain(writeChain([linear[0]!, { ...linear[1]!, when: 1 }])).error).toContain('when 未严格递增')
    expect(checkMigrationChain(writeChain([linear[0]!, { ...linear[1]!, sql: false }])).error).toContain('缺少 SQL 文件: 0001_b.sql')
    expect(checkMigrationChain(writeChain(linear, ['0003_stray.sql'])).error).toContain('未登记到 journal: 0003_stray.sql')
    expect(checkMigrationChain(writeChain([linear[0]!, { ...linear[1]!, snapshot: false }])).error).toContain('缺少快照')
  })

  it('没有 journal 时跳过', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ck-test-r8-drizzle-'))
    tmpDirs.push(dir)
    expect(checkMigrationChain(dir)).toEqual({ passed: true, skipped: true })
  })
})

describe('仓库里的 drizzle 迁移', () => {
  it('journal 线性、每条都有 SQL 与快照，起点是 0000_baseline', () => {
    const res = checkMigrationChain(DRIZZLE_DIR)
    expect(res.error).toBeUndefined()
    expect(res.passed).toBe(true)
    const journal = JSON.parse(readFileSync(join(DRIZZLE_DIR, 'meta', '_journal.json'), 'utf8')) as { entries: JournalEntry[] }
    expect(journal.entries[0]!.tag).toBe('0000_baseline')
  })
})
