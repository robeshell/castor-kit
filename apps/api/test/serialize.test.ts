import { describe, expect, it } from 'vitest'
import { toIso, utcNowIso } from '@/common/serialize'
import { openTestDb } from './helpers'
import { admin_users } from '@/db/schema'

describe('时间格式（isoformat 风格）', () => {
  it('toIso：空格换 T、小数秒补齐 6 位、不加 Z', () => {
    expect(toIso('2026-08-01 12:35:48.834152')).toBe('2026-08-01T12:35:48.834152')
    expect(toIso('2026-08-01 12:35:48')).toBe('2026-08-01T12:35:48')
    // PostgreSQL 文本输出去掉了末尾 0，Python isoformat 固定 6 位
    expect(toIso('2026-08-01 12:35:48.68794')).toBe('2026-08-01T12:35:48.687940')
    expect(toIso('2026-08-01 12:35:48.683')).toBe('2026-08-01T12:35:48.683000')
    expect(toIso(null)).toBeNull()
  })

  it('utcNowIso：毫秒补齐为 6 位，毫秒为 0 时省略小数', () => {
    expect(utcNowIso(new Date(Date.UTC(2026, 8, 24, 1, 2, 3, 45)))).toBe('2026-09-24T01:02:03.045000')
    expect(utcNowIso(new Date(Date.UTC(2026, 8, 24, 1, 2, 3, 0)))).toBe('2026-09-24T01:02:03')
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
