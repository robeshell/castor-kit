import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { ArrowDown, ArrowUp, ChevronRight, ChevronsDownUp, ChevronsUpDown, Network, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { formatDateTime } from '@/lib/format'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { createDepartment, deleteDepartment, getDepartments, sortDepartment, updateDepartment } from '@/modules/admin/api/departments'
import { getUsers } from '@/modules/admin/api/users'
import ConfirmAction from '@/shared/components/ConfirmAction'
import DataTable from '@/shared/components/DataTable'
import { FilterBar, FilterSelect, SearchInput } from '@/shared/components/Filters'
import { FormDialog } from '@/shared/components/FormDialog'
import { FormGrid, FormInput, FormNumber, FormSelect, FormTreeSelect } from '@/shared/components/FormFields'
import PageHeader from '@/shared/components/PageHeader'
import StatusBadge from '@/shared/components/StatusBadge'

const STATUS_OPTIONS = [
  { label: '正常', value: 'active' },
  { label: '停用', value: 'disabled' },
]
const DEFAULT_VALUES = { parent_id: null, name: '', code: '', leader_id: null, sort_order: 0, status: 'active' }

const collectParentIds = (depts) => depts.flatMap((d) => (d.children?.length ? [d.id, ...collectParentIds(d.children)] : []))

// Tree -> table rows with depth; collapsed nodes hide their subtree
const toRows = (depts, expanded, depth = 0) =>
  depts.flatMap((d) => {
    const hasChildren = Boolean(d.children?.length)
    const row = { ...d, _depth: depth, _hasChildren: hasChildren }
    if (!hasChildren || !expanded.has(d.id)) return [row]
    return [row, ...toRows(d.children, expanded, depth + 1)]
  })

function IconButton({ label, onClick, children }) {
  const { t } = useTranslation()
  const text = t(label)
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" className="text-muted-foreground size-7" aria-label={text} onClick={onClick}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{text}</TooltipContent>
    </Tooltip>
  )
}

/**
 * Department management: tree table (expand / collapse, add child, move up / down) + create / edit dialog.
 * Departments are the vocabulary of data scope (roles: "own department", "custom departments"; users: which department).
 */
export default function Departments() {
  const { t } = useTranslation()
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [query, setQuery] = useState({ search: '', status: '' })
  const [expanded, setExpanded] = useState(new Set())
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [fullTree, setFullTree] = useState([])
  const [userOptions, setUserOptions] = useState([])
  const form = useForm({ defaultValues: DEFAULT_VALUES })

  // No synchronous setState here: the initial effect calls load() directly (loading starts as true)
  const load = (params = query) =>
    getDepartments(params)
      .then((res) => {
        const tree = Array.isArray(res) ? res : []
        setData(tree)
        setExpanded(new Set(collectParentIds(tree)))
        if (!params.search && !params.status) setFullTree(tree)
      })
      .catch((err) => toast.apiError(err, '加载失败'))
      .finally(() => setLoading(false))

  const fetchData = (params = query) => {
    setLoading(true)
    return load(params)
  }

  useEffect(() => {
    load({ search: '', status: '' })
    // Leader options: needs the users permission; without it the field stays empty
    getUsers({ per_page: 200 })
      .then((res) =>
        setUserOptions((res?.items || []).map((u) => ({ label: u.nickname ? `${u.nickname} (${u.username})` : u.username, value: u.id }))),
      )
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const rows = useMemo(() => toRows(data, expanded), [data, expanded])
  const allParentIds = useMemo(() => collectParentIds(data), [data])
  const allExpanded = allParentIds.length > 0 && allParentIds.every((id) => expanded.has(id))
  const filtered = Boolean(query.search || query.status)

  const toggleExpand = (id) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const refresh = async () => {
    await fetchData()
    // The parent picker always needs the whole tree
    if (filtered) getDepartments().then((res) => setFullTree(Array.isArray(res) ? res : [])).catch(() => {})
  }

  const openCreate = (parentId = null) => {
    setEditing(null)
    form.reset({ ...DEFAULT_VALUES, parent_id: parentId })
    setFormOpen(true)
  }

  const openEdit = (record) => {
    setEditing(record)
    form.reset({
      parent_id: record.parent_id,
      name: record.name,
      code: record.code,
      leader_id: record.leader_id,
      sort_order: record.sort_order ?? 0,
      status: record.status || 'active',
    })
    setFormOpen(true)
  }

  const submit = async (values) => {
    const payload = { ...values, leader_id: values.leader_id || null, sort_order: values.sort_order ?? 0 }
    try {
      if (editing) await updateDepartment(editing.id, payload)
      else await createDepartment(payload)
      toast.success(editing ? '部门已更新' : '部门已创建')
      setFormOpen(false)
      if (payload.parent_id) setExpanded((prev) => new Set(prev).add(payload.parent_id))
      refresh()
    } catch (err) {
      toast.apiError(err, '操作失败')
      throw err
    }
  }

  const remove = async (record) => {
    try {
      await deleteDepartment(record.id)
      toast.success('部门已删除')
      refresh()
    } catch (err) {
      toast.apiError(err, '删除失败')
      throw err
    }
  }

  const handleSort = (id, direction) => {
    sortDepartment(id, direction)
      .then((res) => {
        if (res?.changed) toast.success('排序成功')
        else toast.info(res?.message || '无需调整')
        refresh()
      })
      .catch((err) => toast.apiError(err, '排序失败'))
  }

  const runSearch = () => {
    const next = { search: search.trim(), status }
    setQuery(next)
    fetchData(next)
  }
  const reset = () => {
    setSearch('')
    setStatus('')
    setQuery({ search: '', status: '' })
    fetchData({ search: '', status: '' })
  }

  const columns = [
    {
      key: 'name',
      title: '部门名称',
      dataIndex: 'name',
      minWidth: 220,
      render: (value, row) => (
        <div className="flex min-w-0 items-center gap-1.5" style={{ paddingLeft: row._depth * 18 }}>
          <button
            type="button"
            aria-label={expanded.has(row.id) ? t('收起') : t('展开')}
            onClick={() => toggleExpand(row.id)}
            className={cn(
              'text-muted-foreground hover:bg-muted flex size-5 shrink-0 items-center justify-center rounded transition-colors',
              !row._hasChildren && 'invisible',
            )}
          >
            <ChevronRight className={cn('size-3.5 transition-transform duration-200', expanded.has(row.id) && 'rotate-90')} />
          </button>
          <Network className="text-muted-foreground size-3.5 shrink-0" />
          <span className="truncate font-medium">{value}</span>
        </div>
      ),
    },
    {
      key: 'code',
      title: '部门编码',
      dataIndex: 'code',
      width: 150,
      render: (v) => (
        <StatusBadge tone="neutral" className="font-mono">
          {v}
        </StatusBadge>
      ),
    },
    { key: 'leader_name', title: '负责人', dataIndex: 'leader_name', width: 140 },
    {
      key: 'user_count',
      title: '人数',
      dataIndex: 'user_count',
      width: 72,
      align: 'right',
      className: 'tabular-nums',
      render: (v) => v || 0,
    },
    { key: 'sort_order', title: '排序', dataIndex: 'sort_order', width: 64, align: 'right', className: 'tabular-nums' },
    {
      key: 'status',
      title: '状态',
      dataIndex: 'status',
      width: 88,
      render: (v) => (
        <StatusBadge tone={v === 'disabled' ? 'neutral' : 'success'} dot>
          {v === 'disabled' ? t('停用') : t('正常')}
        </StatusBadge>
      ),
    },
    {
      key: 'created_at',
      title: '创建时间',
      dataIndex: 'created_at',
      width: 170,
      className: 'text-muted-foreground tabular-nums whitespace-nowrap',
      render: (v) => formatDateTime(v, ''),
    },
    {
      key: 'actions',
      title: '',
      align: 'right',
      width: 236,
      render: (_, record) => (
        <div className="flex items-center justify-end gap-0.5">
          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => openCreate(record.id)}>
            {t('添加下级')}
          </Button>
          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => openEdit(record)}>
            {t('编辑')}
          </Button>
          <IconButton label="上移" onClick={() => handleSort(record.id, 'up')}>
            <ArrowUp />
          </IconButton>
          <IconButton label="下移" onClick={() => handleSort(record.id, 'down')}>
            <ArrowDown />
          </IconButton>
          <ConfirmAction
            title={t('删除部门 {{name}}？', { name: record.name })}
            description="有下级部门或部门内还有用户时无法删除。"
            confirmText="删除"
            onConfirm={() => remove(record)}
          >
            <Button variant="ghost" size="sm" className="text-danger hover:text-danger h-7 px-2">
              {t('删除')}
            </Button>
          </ConfirmAction>
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="部门管理"
        actions={
          <Button size="sm" variant="brand" onClick={() => openCreate()}>
            <Plus />
            {t('新建部门')}
          </Button>
        }
      />

      <FilterBar
        onSearch={runSearch}
        onReset={reset}
        extra={
          allParentIds.length > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground h-8"
              onClick={() => setExpanded(allExpanded ? new Set() : new Set(allParentIds))}
            >
              {allExpanded ? <ChevronsDownUp /> : <ChevronsUpDown />}
              {allExpanded ? t('全部收起') : t('全部展开')}
            </Button>
          ) : null
        }
      >
        <SearchInput value={search} onChange={setSearch} onSubmit={runSearch} placeholder="搜索部门名称 / 编码" />
        <FilterSelect value={status} onChange={setStatus} options={STATUS_OPTIONS} placeholder="状态" />
      </FilterBar>

      <DataTable
        columns={columns}
        data={rows}
        loading={loading}
        dense
        minWidth={1100}
        emptyTitle={filtered ? '没有找到部门' : '还没有部门'}
        emptyDescription={filtered ? '换个关键词试试' : '点击右上角「新建部门」搭建组织架构'}
      />

      <FormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        title={editing ? '编辑部门' : '新建部门'}
        description={editing ? t('正在编辑 {{name}}', { name: editing.name }) : undefined}
        form={form}
        onSubmit={submit}
      >
        <FormTreeSelect
          control={form.control}
          name="parent_id"
          label="上级部门"
          tree={fullTree}
          excludeId={editing?.id}
          placeholder="不选则为顶级部门"
          noneLabel="（无）作为顶级部门"
          searchPlaceholder="搜索部门名称 / 编码"
          emptyText="没有匹配的部门"
        />
        <FormGrid>
          <FormInput
            control={form.control}
            name="name"
            label="部门名称"
            placeholder="例如 研发部"
            rules={{ required: '请输入部门名称', maxLength: { value: 100, message: '部门名称不能超过 100 个字符' } }}
          />
          <FormInput
            control={form.control}
            name="code"
            label="部门编码"
            placeholder="例如 rd"
            inputClassName="font-mono"
            rules={{ required: '请输入部门编码', maxLength: { value: 50, message: '部门编码不能超过 50 个字符' } }}
          />
          <FormSelect control={form.control} name="leader_id" label="负责人" options={userOptions} placeholder="选择负责人" clearable />
          <FormNumber control={form.control} name="sort_order" label="排序" min={0} step={1} />
        </FormGrid>
        <FormSelect control={form.control} name="status" label="状态" options={STATUS_OPTIONS} />
      </FormDialog>
    </div>
  )
}
