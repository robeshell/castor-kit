import { describe, expect, it } from 'vitest'
import { toIso, utcNowIso, utcNowText, utcTextToMillis } from '@/common/serialize'
import { openTestDb } from './helpers'
import { admin_users } from '@/db/schema'

describe('时间格式（ISO 8601，UTC，带 Z）', () => {
  it('toIso：空格换 T、小数秒补齐 6 位、加 Z', () => {
    expect(toIso('2026-08-01 12:35:48.834152')).toBe('2026-08-01T12:35:48.834152Z')
    expect(toIso('2026-08-01 12:35:48')).toBe('2026-08-01T12:35:48.000000Z')
    // PostgreSQL text output drops trailing zeros; the API always writes 6 digits
    expect(toIso('2026-08-01 12:35:48.68794')).toBe('2026-08-01T12:35:48.687940Z')
    expect(toIso('2026-08-01 12:35:48.683')).toBe('2026-08-01T12:35:48.683000Z')
    expect(toIso(null)).toBeNull()
    // Standard parsers read it as the same instant
    expect(new Date(toIso('2026-08-01 12:35:48.683')!).getTime()).toBe(Date.UTC(2026, 7, 1, 12, 35, 48, 683))
  })

  it('utcNowIso / utcNowText：API 格式与数据库文本', () => {
    const at = new Date(Date.UTC(2026, 8, 24, 1, 2, 3, 45))
    expect(utcNowIso(at)).toBe('2026-09-24T01:02:03.045000Z')
    expect(utcNowIso(new Date(Date.UTC(2026, 8, 24, 1, 2, 3, 0)))).toBe('2026-09-24T01:02:03.000000Z')
    expect(utcNowText(at)).toBe('2026-09-24 01:02:03.045000')
    expect(toIso(utcNowText(at))).toBe(utcNowIso(at))
  })

  it('utcTextToMillis：数据库文本（UTC）→ 毫秒', () => {
    expect(utcTextToMillis('2026-09-24 01:02:03.045678')).toBe(Date.UTC(2026, 8, 24, 1, 2, 3, 45))
    expect(utcTextToMillis('2026-09-24T01:02:03')).toBe(Date.UTC(2026, 8, 24, 1, 2, 3))
    expect(utcTextToMillis('2026-09-24T01:02:03Z')).toBeNaN()
  })

  it('Drizzle 读出的 timestamp 是原样文本（不经 Date，不丢微秒、不偏移时区）', async () => {
    const handle = openTestDb()
    try {
      const { rows } = await handle.pool.query<{ raw: string }>(
        `SELECT '2026-08-01 12:35:48.834152'::timestamp AS raw`,
      )
      expect(rows[0]!.raw).toBe('2026-08-01 12:35:48.834152')
      const users = await handle.db.select({ created_at: admin_users.created_at }).from(admin_users).limit(1)
      if (users[0]?.created_at) expect(users[0].created_at).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d{1,6})?$/)
    } finally {
      await handle.pool.end()
    }
  })
})
