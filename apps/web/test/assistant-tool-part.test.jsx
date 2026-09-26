/** AI assistant tool calls: lookup / read lines, and the approval card for writes in each state */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import '@/i18n'
import ToolPart from '@/components/app/assistant/ToolPart'

const write = (state, extra = {}) => ({
  type: 'tool-api_write',
  toolCallId: 'c1',
  state,
  input: { method: 'PUT', path: '/api/admin/departments/3', body: { name: '质量部' }, summary: '把部门改名为质量部' },
  approval: { id: 'ap1' },
  ...extra,
})

describe('assistant ToolPart', () => {
  it('查找接口与读取：一行说明，读取结果按状态码显示', () => {
    const { rerender } = render(<ToolPart part={{ type: 'tool-search_api', state: 'output-available', input: { query: '用户 列表' } }} />)
    expect(screen.getByText('查找接口：用户 列表')).toBeInTheDocument()

    const read = { type: 'tool-api_get', state: 'output-available', input: { path: '/api/admin/roles' } }
    rerender(<ToolPart part={{ ...read, output: { status: 200, data: '{}' } }} />)
    expect(screen.getByText('GET /api/admin/roles')).toBeInTheDocument()
    expect(screen.getByText('完成')).toBeInTheDocument()
    rerender(<ToolPart part={{ ...read, output: { status: 403, data: '{}' } }} />)
    expect(screen.getByText('没有权限')).toBeInTheDocument()
  })

  it('写操作等待确认：显示说明、方法路径与数据，点击允许 / 拒绝回传审批 ID', () => {
    const onRespond = vi.fn()
    render(<ToolPart part={write('approval-requested')} onRespond={onRespond} />)
    expect(screen.getByText('把部门改名为质量部')).toBeInTheDocument()
    expect(screen.getByText('PUT /api/admin/departments/3')).toBeInTheDocument()
    expect(screen.getByText(/"name": "质量部"/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /允许执行/ }))
    fireEvent.click(screen.getByRole('button', { name: /拒绝/ }))
    expect(onRespond.mock.calls).toEqual([
      ['ap1', true],
      ['ap1', false],
    ])
  })

  it('已执行 / 已拒绝：不再显示按钮', () => {
    const { rerender } = render(
      <ToolPart part={write('output-available', { approval: { id: 'ap1', approved: true }, output: { status: 200, data: '{}' } })} />,
    )
    expect(screen.getByText('已允许')).toBeInTheDocument()
    expect(screen.getByText('完成')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /允许执行/ })).toBeNull()

    rerender(<ToolPart part={write('output-denied', { approval: { id: 'ap1', approved: false } })} />)
    expect(screen.getByText('已拒绝，没有执行')).toBeInTheDocument()
    expect(screen.queryByRole('button')).toBeNull()
  })
})
