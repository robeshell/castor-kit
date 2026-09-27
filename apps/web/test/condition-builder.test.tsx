/** Behavior tests for the shared ConditionBuilder: adding / editing / removing conditions and groups through the UI */
import { useState } from 'react'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Controller, useForm } from 'react-hook-form'
import ConditionBuilder, { type ConditionField, type ConditionTree } from '@/shared/components/ConditionBuilder'

type Key = 'name' | 'amount' | 'status' | 'paid' | 'created_at'

const FIELDS: ConditionField<Key>[] = [
  { key: 'name', label: '名称', type: 'text' },
  { key: 'amount', label: '金额', type: 'number' },
  {
    key: 'status',
    label: '状态',
    type: 'select',
    options: [
      { label: '草稿', value: 'draft' },
      { label: '已发布', value: 'published' },
    ],
  },
  { key: 'paid', label: '已付款', type: 'boolean' },
  { key: 'created_at', label: '创建时间', type: 'date', operators: ['between', 'gt'] },
]

const EMPTY: ConditionTree<Key> = { logic: 'AND', items: [], groups: [] }

/** The builder with its value in state, reporting every change */
function Harness({ initial = EMPTY, onChange, disabled }: { initial?: ConditionTree<Key>; onChange?: (v: ConditionTree<Key>) => void; disabled?: boolean }) {
  const [value, setValue] = useState(initial)
  return (
    <ConditionBuilder
      fields={FIELDS}
      value={value}
      disabled={disabled}
      onChange={(next) => {
        setValue(next)
        onChange?.(next)
      }}
    />
  )
}

/** The builder as a react-hook-form field: the form hands back a copy of the value after every change */
function FormHarness({ initial }: { initial: ConditionTree<Key> }) {
  const form = useForm<{ conditions: ConditionTree<Key> }>({ defaultValues: { conditions: initial } })
  return (
    <Controller
      control={form.control}
      name="conditions"
      render={({ field }) => <ConditionBuilder fields={FIELDS} value={field.value} onChange={field.onChange} />}
    />
  )
}

/** The value passed to the latest onChange call */
function lastValue(spy: ReturnType<typeof vi.fn<(v: ConditionTree<Key>) => void>>): ConditionTree<Key> {
  const call = spy.mock.lastCall
  if (!call) throw new Error('onChange was not called')
  return call[0]
}

async function pick(trigger: HTMLElement, option: string) {
  await userEvent.click(trigger)
  await userEvent.click(await screen.findByRole('option', { name: option }))
}

describe('ConditionBuilder', () => {
  // motion measures heights for the row animations and calls scrollTo, which jsdom only logs as not implemented
  beforeAll(() => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  })

  it('shows the empty hint, and adding a condition uses the first field and its first operator', async () => {
    const onChange = vi.fn<(v: ConditionTree<Key>) => void>()
    render(<Harness onChange={onChange} />)
    expect(screen.getByText('暂无条件，点击“新增条件”开始配置')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: '新增条件' }))
    expect(lastValue(onChange)).toEqual({ logic: 'AND', items: [{ field: 'name', operator: 'contains', value: '' }], groups: [] })

    await userEvent.type(screen.getByRole('textbox', { name: '值' }), 'acme')
    expect(lastValue(onChange).items[0]).toEqual({ field: 'name', operator: 'contains', value: 'acme' })
  })

  it('changing the field resets the operator and the value to the new type', async () => {
    const onChange = vi.fn<(v: ConditionTree<Key>) => void>()
    render(<Harness initial={{ logic: 'AND', items: [{ field: 'name', operator: 'eq', value: 'acme' }], groups: [] }} onChange={onChange} />)

    await pick(screen.getByRole('combobox', { name: '字段' }), '金额')
    expect(lastValue(onChange).items[0]).toEqual({ field: 'amount', operator: 'eq', value: null })

    await userEvent.type(screen.getByRole('spinbutton', { name: '输入条件值' }), '42')
    expect(lastValue(onChange).items[0]?.value).toBe(42)
  })

  it('offers the operators of the field type, or the subset the field lists', async () => {
    render(<Harness initial={{ logic: 'AND', items: [{ field: 'created_at', operator: 'between', value: ['', ''] }], groups: [] }} />)
    await userEvent.click(screen.getByRole('combobox', { name: '操作符' }))
    expect((await screen.findAllByRole('option')).map((o) => o.textContent)).toEqual(['在范围内', '晚于'])
  })

  it('keeps the value when the operator keeps its shape, and resets it otherwise', async () => {
    const onChange = vi.fn<(v: ConditionTree<Key>) => void>()
    render(<Harness initial={{ logic: 'AND', items: [{ field: 'amount', operator: 'eq', value: 5 }], groups: [] }} onChange={onChange} />)

    await pick(screen.getByRole('combobox', { name: '操作符' }), '大于')
    expect(lastValue(onChange).items[0]).toEqual({ field: 'amount', operator: 'gt', value: 5 })

    await pick(screen.getByRole('combobox', { name: '操作符' }), '在范围内')
    expect(lastValue(onChange).items[0]).toEqual({ field: 'amount', operator: 'between', value: [null, null] })
    await userEvent.type(screen.getByRole('spinbutton', { name: '最大值' }), '100')
    expect(lastValue(onChange).items[0]?.value).toEqual([null, 100])

    await pick(screen.getByRole('combobox', { name: '操作符' }), '为空')
    expect(lastValue(onChange).items[0]).toEqual({ field: 'amount', operator: 'empty', value: null })
    expect(screen.getByText('无需填写值')).toBeInTheDocument()
  })

  it('select values keep the option value; boolean fields pick yes / no', async () => {
    const onChange = vi.fn<(v: ConditionTree<Key>) => void>()
    render(
      <Harness
        initial={{
          logic: 'AND',
          items: [
            { field: 'status', operator: 'eq', value: '' },
            { field: 'paid', operator: 'eq', value: true },
          ],
          groups: [],
        }}
        onChange={onChange}
      />,
    )
    const [statusValue, paidValue] = screen.getAllByRole('combobox', { name: '值' })
    if (!statusValue || !paidValue) throw new Error('value selects missing')
    await pick(statusValue, '已发布')
    expect(lastValue(onChange).items[0]?.value).toBe('published')
    await pick(paidValue, '否')
    expect(lastValue(onChange).items[1]?.value).toBe(false)
  })

  it('switches the logic, adds and removes groups and conditions', async () => {
    const onChange = vi.fn<(v: ConditionTree<Key>) => void>()
    render(<Harness initial={{ logic: 'AND', items: [{ field: 'name', operator: 'contains', value: 'a' }], groups: [] }} onChange={onChange} />)

    await userEvent.click(screen.getByRole('button', { name: '满足任一' }))
    expect(lastValue(onChange).logic).toBe('OR')

    await userEvent.click(screen.getByRole('button', { name: '新增条件组' }))
    expect(lastValue(onChange).groups).toEqual([{ logic: 'AND', items: [{ field: 'name', operator: 'contains', value: '' }] }])
    // The connector between the top-level condition and the group follows the root logic
    expect(screen.getByText('或')).toBeInTheDocument()

    const [removeTopLevel] = screen.getAllByRole('button', { name: '删除条件' })
    if (!removeTopLevel) throw new Error('remove button missing')
    await userEvent.click(removeTopLevel)
    expect(lastValue(onChange).items).toEqual([])
    await userEvent.click(screen.getByRole('button', { name: '删除条件组' }))
    expect(lastValue(onChange)).toEqual({ logic: 'OR', items: [], groups: [] })
  })

  it('edits inside a group only touch that group', async () => {
    const onChange = vi.fn<(v: ConditionTree<Key>) => void>()
    render(
      <Harness initial={{ logic: 'AND', items: [], groups: [{ logic: 'AND', items: [{ field: 'name', operator: 'eq', value: 'x' }] }] }} onChange={onChange} />,
    )
    const group = screen.getByRole('group', { name: '条件组' })
    await userEvent.click(within(group).getByRole('button', { name: '满足任一' }))
    await userEvent.click(within(group).getByRole('button', { name: '新增条件' }))
    expect(lastValue(onChange)).toEqual({
      logic: 'AND',
      items: [],
      groups: [
        {
          logic: 'OR',
          items: [
            { field: 'name', operator: 'eq', value: 'x' },
            { field: 'name', operator: 'contains', value: '' },
          ],
        },
      ],
    })
  })

  it('inside react-hook-form, typing keeps the same inputs and their focus', async () => {
    render(
      <FormHarness
        initial={{
          logic: 'AND',
          items: [{ field: 'name', operator: 'contains', value: '' }],
          groups: [{ logic: 'AND', items: [{ field: 'name', operator: 'eq', value: '' }] }],
        }}
      />,
    )
    const [top, inGroup] = screen.getAllByRole('textbox', { name: '值' })
    if (!top || !inGroup) throw new Error('value inputs missing')

    await userEvent.type(top, 'abc')
    expect(top).toHaveFocus()
    expect(top).toHaveValue('abc')
    await userEvent.type(inGroup, 'xy')
    expect(inGroup).toHaveFocus()
    expect(inGroup).toHaveValue('xy')
    // No row was remounted (a remount would leave the old row behind in its exit animation)
    expect(screen.getAllByRole('textbox', { name: '值' })).toEqual([top, inGroup])
  })

  it('disabled: nothing can be added', () => {
    render(<Harness disabled />)
    expect(screen.getByRole('button', { name: '新增条件' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '新增条件组' })).toBeDisabled()
  })
})
