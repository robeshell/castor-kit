import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { formatDateTime } from '@/common/serialize'
import { currentTimeZone, formatInZone, isTimeZone, withTimeZone, withZoneOffset, zoneOffsetMinutes } from '@/common/time-zone'
import { field, parseBody } from '@/common/validation'

describe('common/time-zone', () => {
  it('时区名：只认运行时知道的 IANA 名称', () => {
    for (const zone of ['UTC', 'Asia/Shanghai', 'America/New_York']) expect(isTimeZone(zone), zone).toBe(true)
    for (const zone of ['', 'Not/A_Zone', 'x'.repeat(80), 8, null]) expect(isTimeZone(zone), String(zone)).toBe(false)
  })

  it('当前时区：请求外为 UTC，withTimeZone 内为指定时区', () => {
    expect(currentTimeZone()).toBe('UTC')
    expect(withTimeZone('Asia/Tokyo', () => currentTimeZone())).toBe('Asia/Tokyo')
  })

  it('时刻 → 时区的墙上时间；偏移随夏令时变化', () => {
    const at = Date.UTC(2026, 0, 15, 20, 30, 5)
    expect(formatInZone(at, 'Asia/Shanghai')).toBe('2026-01-16 04:30:05')
    expect(zoneOffsetMinutes(at, 'Asia/Shanghai')).toBe(480)
    expect(zoneOffsetMinutes(at, 'America/New_York')).toBe(-300)
    expect(zoneOffsetMinutes(Date.UTC(2026, 6, 1), 'America/New_York')).toBe(-240)
    expect(zoneOffsetMinutes(at, 'Asia/Kolkata')).toBe(330)
  })

  it('导出：数据库里的 UTC 时间按当前时区格式化', () => {
    expect(formatDateTime('2026-01-15 20:30:05.123456')).toBe('2026-01-15 20:30:05')
    expect(withTimeZone('Asia/Shanghai', () => formatDateTime('2026-01-15 20:30:05.123456'))).toBe('2026-01-16 04:30:05')
    expect(withTimeZone('Asia/Shanghai', () => formatDateTime('2026-01-15T20:30:05.123456Z'))).toBe('2026-01-16 04:30:05')
    expect(formatDateTime(null)).toBe('')
  })

  it('导入：不带时区的时间补上当前时区的偏移，再由 field.dateTime 换算成 UTC', () => {
    expect(withZoneOffset('2026-01-15 08:30', 'Asia/Shanghai')).toBe('2026-01-15 08:30+08:00')
    expect(withZoneOffset('2026-07-01T08:30:00.5', 'America/New_York')).toBe('2026-07-01T08:30:00.5-04:00')
    expect(withZoneOffset('2026-01-15 08:30', 'Asia/Kolkata')).toBe('2026-01-15 08:30+05:30')
    // Already zoned, or not a date-time: unchanged
    expect(withZoneOffset('2026-01-15T08:30:00Z', 'Asia/Shanghai')).toBe('2026-01-15T08:30:00Z')
    expect(withZoneOffset('abc', 'Asia/Shanghai')).toBe('abc')
    const body = z.object({ at: field.dateTime('时间') })
    expect(parseBody(body, { at: withTimeZone('Asia/Shanghai', () => withZoneOffset('2026-01-15 08:30')) })).toEqual({ at: '2026-01-15 00:30:00' })
  })
})
