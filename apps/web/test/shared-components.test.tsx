/** Behavior tests for the new design system's shared components (DataTable / Filters / FormDialog / ExportDialog / StatusBadge) */
import { describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useForm } from 'react-hook-form'
import DataTable, { DataPagination } from '@/shared/components/DataTable'
import type { DataTableColumn } from '@/shared/components/DataTable'
import { FilterBar, FilterSelect, SearchInput } from '@/shared/components/Filters'
import { FormDialog } from '@/shared/components/FormDialog'
import { FormInput } from '@/shared/components/FormFields'
import ExportDialog from '@/shared/components/data-transfer/ExportDialog'
import CheckableTree from '@/shared/components/CheckableTree'
import StatusBadge from '@/shared/components/StatusBadge'
import TreeSelect from '@/shared/components/TreeSelect'
import type { TreeSelectNode } from '@/shared/components/TreeSelect'
import type { TreeKey } from '@/shared/components/TreeView'
import { userDisplayName } from '@/lib/user'
import UserAvatar from '@/shared/components/UserAvatar'

interface Row {
  id: number
  name: string
  n: number
  /** Never set: the column shows the placeholder */
  missing?: string
}

const COLUMNS: DataTableColumn<Row>[] = [
  { key: 'name', title: '名称', dataIndex: 'name' },
  { key: 'n', title: '数量', dataIndex: 'n', render: (v) => `${v} 个` },
  { key: 'empty', title: '空列', dataIndex: 'missing' },
]
const ROWS: Row[] = [
  { id: 1, name: 'alpha', n: 3 },
  { id: 2, name: 'beta', n: 5 },
]

/** list[index], throwing when it is missing */
function nth<T>(list: readonly T[], index: number): T {
  const item = list[index]
  if (item === undefined) throw new Error(`no item ${index} in a list of ${list.length}`)
  return item
}

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
    await userEvent.click(nth(screen.getAllByLabelText('选择'), 1))
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

  it('没有 key 和 dataIndex 的列以列序号作 React key', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const columns: DataTableColumn<Row>[] = [
      { title: '甲', render: (_, row) => `${row.name}-a` },
      { title: '乙', render: (_, row) => `${row.name}-b` },
    ]
    render(<DataTable columns={columns} data={ROWS} />)
    expect(screen.getByText('alpha-a')).toBeInTheDocument()
    expect(screen.getByText('beta-b')).toBeInTheDocument()
    const keyWarnings = consoleError.mock.calls.filter((args) => args.some((arg) => String(arg).includes('key')))
    consoleError.mockRestore()
    expect(keyWarnings).toEqual([])
  })
})

describe('DataPagination', () => {
  it('perPage 不是正数时按一页处理', () => {
    const { container } = render(<DataPagination page={1} perPage={0} total={50} />)
    expect(screen.getByText('第 1–50 条，共 50 条')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '第 1 页' })).toHaveAttribute('aria-current', 'page')
    expect(screen.queryByRole('button', { name: '第 2 页' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('下一页')).toBeDisabled()
    expect(container.textContent).not.toMatch(/Infinity|NaN/)
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

function DialogHarness({ onSubmit }: { onSubmit: (values: { username: string }) => void }) {
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

describe('UserAvatar', () => {
  it('没有图片（或图片未加载）时显示名字首字母', () => {
    render(<UserAvatar name="alice" />)
    expect(screen.getByText('A')).toBeInTheDocument()
    render(<UserAvatar />)
    expect(screen.getByText('?')).toBeInTheDocument()
  })

  it('显示名：昵称优先，其次用户名', () => {
    expect(userDisplayName({ nickname: '张三', username: 'zhangsan' })).toBe('张三')
    expect(userDisplayName({ nickname: null, username: 'zhangsan' })).toBe('zhangsan')
    expect(userDisplayName(null)).toBe('')
  })
})

const DEPTS: TreeSelectNode<number>[] = [
  { id: 1, name: '总部', code: 'hq', children: [{ id: 2, name: '研发部', code: 'rd', children: [{ id: 3, name: '前端组', code: 'fe' }] }] },
  { id: 4, name: '分公司', code: 'branch' },
]

describe('TreeSelect', () => {
  it('显示完整路径；按层级缩进列出；选择与清空', async () => {
    const onChange = vi.fn()
    const { rerender } = render(<TreeSelect tree={DEPTS} value={null} onChange={onChange} placeholder="全部部门" />)
    expect(screen.getByRole('combobox')).toHaveTextContent('全部部门')

    await userEvent.click(screen.getByRole('combobox'))
    const options = screen.getAllByRole('option').map((o) => o.textContent)
    expect(options).toEqual(['总部hq', '研发部rd', '前端组fe', '分公司branch'])
    await userEvent.click(screen.getByRole('option', { name: /前端组/ }))
    expect(onChange).toHaveBeenLastCalledWith(3)

    rerender(<TreeSelect tree={DEPTS} value={3} onChange={onChange} />)
    expect(screen.getByRole('combobox')).toHaveTextContent('总部 / 研发部 / 前端组')
    await userEvent.click(screen.getByRole('button', { name: '清空' }))
    expect(onChange).toHaveBeenLastCalledWith(null)
  })

  it('excludeId 连同子树一起隐藏；noneLabel 选项选 null', async () => {
    const onChange = vi.fn()
    render(<TreeSelect tree={DEPTS} value={4} onChange={onChange} excludeId={2} noneLabel="（无）顶级" />)
    await userEvent.click(screen.getByRole('combobox'))
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['（无）顶级', '总部hq', '分公司branch'])
    await userEvent.click(screen.getByRole('option', { name: '（无）顶级' }))
    expect(onChange).toHaveBeenLastCalledWith(null)
  })
})

describe('CheckableTree', () => {
  const tree = [
    { key: 1, label: '总部', children: [{ key: 2, label: '研发部' }, { key: 3, label: '市场部' }] },
    { key: 4, label: '分公司' },
  ]
  const checkboxOf = (label: string) => screen.getByText(label).closest('[role="treeitem"]')
  /** The keys of onChange's last call */
  const lastKeys = (onChange: Mock<(keys: TreeKey[]) => void>) => onChange.mock.lastCall?.[0] ?? []

  it('勾选父级联动全部子级；取消一个子级后父级变为半选', async () => {
    const onChange = vi.fn<(keys: TreeKey[]) => void>()
    const { rerender } = render(<CheckableTree tree={tree} value={[]} onChange={onChange} />)
    await userEvent.click(screen.getByText('总部'))
    expect([...lastKeys(onChange)].sort()).toEqual([1, 2, 3])

    rerender(<CheckableTree tree={tree} value={[1, 2, 3]} onChange={onChange} />)
    await userEvent.click(screen.getByText('市场部'))
    expect(lastKeys(onChange)).toEqual([2])

    rerender(<CheckableTree tree={tree} value={[2]} onChange={onChange} />)
    expect(checkboxOf('总部')).toHaveAttribute('aria-checked', 'mixed')
    expect(checkboxOf('研发部')).toHaveAttribute('aria-checked', 'true')
    expect(checkboxOf('分公司')).toHaveAttribute('aria-checked', 'false')
  })

  it('全部子级勾选时父级自动算作勾选', async () => {
    const onChange = vi.fn<(keys: TreeKey[]) => void>()
    render(<CheckableTree tree={tree} value={[2]} onChange={onChange} />)
    await userEvent.click(screen.getByText('市场部'))
    expect([...lastKeys(onChange)].sort()).toEqual([1, 2, 3])
  })

  it('is one Tab stop: arrows move between rows, Space toggles the focused row', async () => {
    const onChange = vi.fn<(keys: TreeKey[]) => void>()
    render(<CheckableTree aria-label="部门" tree={tree} value={[]} onChange={onChange} />)
    expect(screen.getByRole('tree', { name: '部门' })).toBeInTheDocument()
    const items = screen.getAllByRole('treeitem')
    expect(items.map((item) => item.tabIndex)).toEqual([0, -1, -1, -1])

    await userEvent.tab()
    expect(checkboxOf('总部')).toHaveFocus()
    await userEvent.keyboard('{ArrowDown}{ArrowDown}')
    expect(checkboxOf('市场部')).toHaveFocus()
    await userEvent.keyboard(' ')
    expect(lastKeys(onChange)).toEqual([3])
    await userEvent.keyboard('{ArrowLeft}')
    expect(checkboxOf('总部')).toHaveFocus()
    await userEvent.keyboard('{End}')
    expect(checkboxOf('分公司')).toHaveFocus()
  })

  it('collapses and expands with ← / →', async () => {
    render(<CheckableTree tree={tree} value={[]} onChange={vi.fn()} />)
    await userEvent.tab()
    await userEvent.keyboard('{ArrowLeft}')
    expect(checkboxOf('总部')).toHaveAttribute('aria-expanded', 'false')
    await waitFor(() => expect(screen.queryByText('研发部')).not.toBeInTheDocument())
    await userEvent.keyboard('{ArrowRight}')
    expect(checkboxOf('总部')).toHaveAttribute('aria-expanded', 'true')
  })
})

describe('keyboard and names', () => {
  it('DataTable onRowClick: the primary cell holds a button; Enter and a row click each call it once', async () => {
    const onRowClick = vi.fn()
    render(<DataTable columns={COLUMNS} data={ROWS} onRowClick={onRowClick} isRowActive={(row) => row.id === 2} />)
    const button = screen.getByRole('button', { name: 'alpha' })
    button.focus()
    await userEvent.keyboard('{Enter}')
    expect(onRowClick).toHaveBeenCalledTimes(1)
    await userEvent.click(screen.getByText('5 个'))
    expect(onRowClick).toHaveBeenCalledTimes(2)
    expect(onRowClick).toHaveBeenLastCalledWith(ROWS[1], 1)
    expect(screen.getByRole('button', { name: 'beta' })).toHaveAttribute('aria-current', 'true')
  })

  it('FilterSelect is named by its filter; the trigger shows the value', () => {
    render(<FilterSelect value="" onChange={vi.fn()} options={[{ label: '启用', value: 'on' }]} placeholder="状态" />)
    expect(screen.getByRole('combobox', { name: '状态' })).toHaveTextContent('全部状态')
  })

  it('SearchInput is a named search box', () => {
    render(<SearchInput value="" onChange={vi.fn()} placeholder="搜索用户名" />)
    expect(screen.getByRole('searchbox', { name: '搜索用户名' })).toBeInTheDocument()
  })

  it('TreeSelect clear button sits next to the trigger, not inside it', () => {
    render(<TreeSelect tree={DEPTS} value={3} onChange={vi.fn()} />)
    const clear = screen.getByRole('button', { name: '清空' })
    expect(screen.getByRole('combobox').contains(clear)).toBe(false)
  })
})
