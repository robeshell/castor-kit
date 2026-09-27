import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@/i18n'
import type { CardListPageItem } from '@/modules/component_center/api/card_list_page'
import { DEFAULT_FORM_VALUES, toFormValues } from '@/modules/component_center/pages/admin/card_list_page/form'
import { generateCalendarData, localDateKey } from '@/modules/component_center/pages/dataviz/heatmap_page/calendar'
import { canFormat } from '@/modules/component_center/pages/editor/code_editor_page/formatting'
import SchemaSheet from '@/modules/component_center/pages/ai/ai_sql_page/SchemaSheet'

vi.mock('@/modules/component_center/api/ai_sql', () => ({ getDBSchema: vi.fn() }))
const aiSql = await import('@/modules/component_center/api/ai_sql')

describe('卡片列表表单', () => {
  const record: CardListPageItem = {
    id: 7,
    title: '卡片',
    card_code: 'card_007',
    subtitle: null,
    category: null,
    cover_url: null,
    tag: '新品',
    status: 'published',
    owner: 'admin',
    priority: 3,
    is_active: null,
    description: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-02T00:00:00Z',
  }

  it('编辑时只带表单字段（PUT 不含 id / 时间戳）', () => {
    const values = toFormValues(record)
    expect(Object.keys(values).sort()).toEqual(Object.keys(DEFAULT_FORM_VALUES).sort())
    expect(values).not.toHaveProperty('id')
    expect(values).not.toHaveProperty('created_at')
    expect(values).toMatchObject({ title: '卡片', card_code: 'card_007', tag: '新品', status: 'published', priority: 3 })
  })

  it('null 显示为后端保存时的默认值：is_active → true，category → general', () => {
    expect(toFormValues(record)).toMatchObject({ is_active: true, category: 'general' })
    expect(toFormValues({ ...record, is_active: false, category: 'event' })).toMatchObject({ is_active: false, category: 'event' })
  })
})

describe('热力图日历数据', () => {
  // A random source that makes the value reveal the branch: weekday → 17, weekend → 11
  const fixedRandom = () => 0.99
  const isWeekendKey = (key: string) => {
    const [y, m, d] = key.split('-').map(Number) as [number, number, number]
    const day = new Date(y, m - 1, d).getDay()
    return day === 0 || day === 6
  }

  // Just after local midnight and just before it: in any time zone other than UTC, one of them falls on a different
  // UTC day, which is where UTC labels and local weekdays used to disagree
  it.each([
    ['00:30', new Date(2026, 8, 27, 0, 30)],
    ['23:30', new Date(2026, 8, 27, 23, 30)],
  ])('按本地日期标注，周末判断与标签一致（本地 %s）', (_label, now) => {
    const data = generateCalendarData(now, fixedRandom)
    expect(data).toHaveLength(365)
    expect(data.at(-1)![0]).toBe('2026-09-27')
    expect(data[0]![0]).toBe(localDateKey(new Date(2025, 8, 28)))
    for (const [key, value] of data) expect(value).toBe(isWeekendKey(key) ? 11 : 17)
  })

  it('localDateKey 补零', () => {
    expect(localDateKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
  })
})

describe('代码编辑器格式化', () => {
  it('只有 Monaco 自带格式化器的语言可以格式化', () => {
    for (const lang of ['javascript', 'typescript', 'json', 'html', 'css']) expect(canFormat(lang)).toBe(true)
    for (const lang of ['python', 'sql', 'java']) expect(canFormat(lang)).toBe(false)
  })
})

describe('AI SQL 表结构', () => {
  const SCHEMA = { schema: 'TABLE users (\n  id  integer NOT NULL\n)', tables: ['users'] }

  beforeEach(() => vi.mocked(aiSql.getDBSchema).mockReset())
  afterEach(cleanup)

  it('首次加载失败显示错误和重试，而不是「暂无可查询的表」；重试成功后显示表', async () => {
    vi.mocked(aiSql.getDBSchema).mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce(SCHEMA)
    render(<SchemaSheet open onOpenChange={() => {}} onQueryTable={() => {}} />)
    const retry = await screen.findByRole('button', { name: '重试' })
    expect(screen.getByText('获取数据库结构失败')).toBeInTheDocument()
    expect(screen.queryByText('暂无可查询的表')).not.toBeInTheDocument()

    await userEvent.click(retry)
    expect(await screen.findByText('users')).toBeInTheDocument()
    expect(aiSql.getDBSchema).toHaveBeenCalledTimes(2)
  })

  it('加载失败后重新打开会再次请求；成功后不再重复请求', async () => {
    vi.mocked(aiSql.getDBSchema).mockRejectedValueOnce(new Error('network')).mockResolvedValue(SCHEMA)
    const props = { onOpenChange: () => {}, onQueryTable: () => {} }
    const { rerender } = render(<SchemaSheet open {...props} />)
    await screen.findByRole('button', { name: '重试' })

    rerender(<SchemaSheet open={false} {...props} />)
    rerender(<SchemaSheet open {...props} />)
    expect(await screen.findByText('users')).toBeInTheDocument()
    expect(aiSql.getDBSchema).toHaveBeenCalledTimes(2)

    rerender(<SchemaSheet open={false} {...props} />)
    rerender(<SchemaSheet open {...props} />)
    expect(await screen.findByText('users')).toBeInTheDocument()
    expect(aiSql.getDBSchema).toHaveBeenCalledTimes(2)
  })
})
