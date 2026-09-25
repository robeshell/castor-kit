/** Behavior tests for the new design system's shared components (DataTable / Filters / FormDialog / ExportDialog / StatusBadge) */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useForm } from 'react-hook-form'
import DataTable from '@/shared/components/DataTable'
import { FilterBar, SearchInput } from '@/shared/components/Filters'
import { FormDialog } from '@/shared/components/FormDialog'
import { FormInput } from '@/shared/components/FormFields'
import ExportDialog from '@/shared/components/data-transfer/ExportDialog'
import StatusBadge from '@/shared/components/StatusBadge'

const COLUMNS = [
  { key: 'name', title: '名称', dataIndex: 'name' },
  { key: 'n', title: '数量', dataIndex: 'n', render: (v) => `${v} 个` },
  { key: 'empty', title: '空列', dataIndex: 'missing' },
]
const ROWS = [
  { id: 1, name: 'alpha', n: 3 },
  { id: 2, name: 'beta', n: 5 },
]

describe('DataTable', () => {
  it('渲染列与自定义 render，空值显示占位符', () => {
    render(<DataTable columns={COLUMNS} data={ROWS} />)
    expect(screen.getByText('名称')).toBeInTheDocument()
    expect(screen.getByText('alpha')).toBeInTheDocument()
    expect(screen.getByText('5 个')).toBeInTheDocument()
    expect(screen.getAllByText('-')).toHaveLength(2)
  })

  it('无数据时显示空态文案', () => {
    render(<DataTable columns={COLUMNS} data={[]} emptyTitle="没有找到用户" />)
    expect(screen.getByText('没有找到用户')).toBeInTheDocument()
  })

  it('勾选：单选与全选回调带正确的 keys', async () => {
    const onSelectionChange = vi.fn()
    render(<DataTable columns={COLUMNS} data={ROWS} selectable selectedKeys={[]} onSelectionChange={onSelectionChange} />)
    await userEvent.click(screen.getByLabelText('全选'))
    expect(onSelectionChange).toHaveBeenLastCalledWith([1, 2], ROWS)
    await userEvent.click(screen.getAllByLabelText('选择')[1])
    expect(onSelectionChange).toHaveBeenLastCalledWith([2], [ROWS[1]])
  })

  it('分页：显示范围并翻页', async () => {
    const onChange = vi.fn()
    render(<DataTable columns={COLUMNS} data={ROWS} pagination={{ page: 1, perPage: 2, total: 5, onChange }} />)
    expect(screen.getByText('第 1–2 条，共 5 条')).toBeInTheDocument()
    await userEvent.click(screen.getByLabelText('下一页'))
    expect(onChange).toHaveBeenCalledWith(2)
    await userEvent.click(screen.getByText('3'))
    expect(onChange).toHaveBeenCalledWith(3)
  })
})

describe('Filters', () => {
  it('SearchInput 回车触发查询，清空按钮清空', async () => {
    const onSubmit = vi.fn()
    const onChange = vi.fn()
    render(<SearchInput value="abc" onChange={onChange} onSubmit={onSubmit} />)
    fireEvent.keyDown(screen.getByPlaceholderText('搜索'), { key: 'Enter' })
    expect(onSubmit).toHaveBeenCalled()
    await userEvent.click(screen.getByLabelText('清空'))
    expect(onChange).toHaveBeenCalledWith('')
  })

  it('FilterBar 查询 / 重置按钮', async () => {
    const onSearch = vi.fn()
    const onReset = vi.fn()
    render(<FilterBar onSearch={onSearch} onReset={onReset} />)
    await userEvent.click(screen.getByText('查询'))
    await userEvent.click(screen.getByText('重置'))
    expect(onSearch).toHaveBeenCalledTimes(1)
    expect(onReset).toHaveBeenCalledTimes(1)
  })
})

function DialogHarness({ onSubmit }) {
  const form = useForm({ defaultValues: { username: '' } })
  return (
    <FormDialog open onOpenChange={() => {}} title="新建用户" form={form} onSubmit={onSubmit}>
      <FormInput control={form.control} name="username" label="用户名" rules={{ required: '请输入用户名' }} />
    </FormDialog>
  )
}

describe('FormDialog + FormFields', () => {
  it('必填校验阻止提交并显示文案；填写后提交拿到表单值', async () => {
    const onSubmit = vi.fn()
    render(<DialogHarness onSubmit={onSubmit} />)
    await userEvent.click(screen.getByText('保存'))
    expect(await screen.findByText('请输入用户名')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
    await userEvent.type(screen.getByLabelText(/用户名/), 'zhangsan')
    await userEvent.click(screen.getByText('保存'))
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ username: 'zhangsan' }))
  })
})

describe('ExportDialog', () => {
  it('默认字段勾选、格式切换并回传', async () => {
    const onConfirm = vi.fn()
    render(
      <ExportDialog
        open
        onOpenChange={() => {}}
        fieldOptions={[
          { label: 'ID', value: 'id' },
          { label: '名称', value: 'name' },
        ]}
        defaultFields={['name']}
        onConfirm={onConfirm}
      />,
    )
    await userEvent.click(screen.getByText('CSV'))
    await userEvent.click(screen.getByText('导出'))
    expect(onConfirm).toHaveBeenCalledWith({ fields: ['name'], fileType: 'csv' })
  })
})

describe('StatusBadge', () => {
  it('按 tone 渲染语义色类', () => {
    render(<StatusBadge tone="success" dot>启用</StatusBadge>)
    expect(screen.getByText('启用').className).toContain('text-success')
  })
})
