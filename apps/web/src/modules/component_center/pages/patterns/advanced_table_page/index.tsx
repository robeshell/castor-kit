/**
 * Page patterns → Advanced table: the reference implementation of a table that is worked in place, on the shared demo
 * API (/api/admin/component-center/demo-records).
 *
 * Use it when users edit many rows quickly (triage, bulk status changes) rather than one record at a time in a
 * dialog. Copy:
 * - server-side sorting: sortable column headers (SortHeader) write sort_field / sort_dir into the useCrudList filters,
 *   so paging, the status tabs and reset keep or clear them with the other filters; only columns the API can sort by
 *   (SORT_FIELDS in the module's schema.ts) get a sort button.
 * - inline row editing: one row at a time switches its cells to inputs (a local draft), saved with updateItem; the
 *   values before the last save are kept so it can be undone.
 * - row selection + batch actions: batchUpdate (status / owner / enabled) and batchDelete on the selected ids.
 * - column visibility: a DropdownMenu of checkbox items; the actions column is always shown.
 * Buttons are gated by the cc_patterns_edit / cc_patterns_delete permissions (no permission → no selection column).
 */
import { useEffect, useState, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { AnimatePresence, motion } from 'motion/react'
import { Trans, useTranslation } from 'react-i18next'
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, CircleCheck, CircleOff, Columns3, Trash2, Undo2, UserRound, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'
import { useAuth } from '@/context/AuthContext'
import { formatDate, formatDateTime, formatNumber } from '@/lib/format'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import {
  batchDelete,
  batchUpdate,
  deleteItem,
  getItems,
  updateItem,
  type DemoRecord as Row,
  type DemoRecordBatchUpdateBody,
  type DemoRecordQuery,
} from '@/modules/component_center/api/demo_record'
import {
  CATEGORY_OPTIONS,
  categoryLabel,
  enabledOption,
  isStatus,
  STATUS_OPTIONS,
  statusOption,
  type DemoStatus as Status,
} from '@/modules/component_center/pages/patterns/demo-record-options'
import ConfirmAction from '@/shared/components/ConfirmAction'
import DataTable, { type DataTableColumn } from '@/shared/components/DataTable'
import { FilterBar, FilterSelect, SearchInput } from '@/shared/components/Filters'
import { FormDialog } from '@/shared/components/FormDialog'
import { FormInput } from '@/shared/components/FormFields'
import PageHeader from '@/shared/components/PageHeader'
import SegmentedTabs from '@/shared/components/SegmentedTabs'
import StatusBadge from '@/shared/components/StatusBadge'
import { useCrudList, type CrudListFilters } from '@/shared/hooks/useCrudList'

/** Columns the API sorts by ('' = default order) */
type SortField = Exclude<NonNullable<DemoRecordQuery['sort_field']>, ''>
type SortDir = NonNullable<DemoRecordQuery['sort_dir']>
interface Sort {
  field: SortField
  dir: SortDir
}

const STATUS_TABS: { value: '' | Status; label: string }[] = [{ value: '', label: '全部' }, ...STATUS_OPTIONS]
const SORT_FIELDS: readonly SortField[] = ['name', 'status', 'priority', 'progress', 'amount', 'start_date', 'updated_at']

/** The applied sort, read back from the list filters (only what toggleSort wrote) */
function sortOf(filters: CrudListFilters): Sort | null {
  const field = SORT_FIELDS.find((f) => f === filters.sort_field)
  if (!field) return null
  return { field, dir: filters.sort_dir === 'asc' ? 'asc' : 'desc' }
}

/** Every column the user can show or hide, in display order */
const COLUMNS = [
  { key: 'code', label: '编码' },
  { key: 'name', label: '名称' },
  { key: 'category', label: '分类' },
  { key: 'status', label: '状态' },
  { key: 'owner', label: '负责人' },
  { key: 'priority', label: '优先级' },
  { key: 'progress', label: '进度' },
  { key: 'amount', label: '金额' },
  { key: 'start_date', label: '开始日期' },
  { key: 'is_active', label: '是否启用' },
  { key: 'updated_at', label: '更新时间' },
] as const
type ColumnKey = (typeof COLUMNS)[number]['key']

/** The cells a row edits inline */
interface InlineDraft {
  name: string
  status: Status
  owner: string
  priority: number
  progress: number
  is_active: boolean
}

const toDraft = (record: Row): InlineDraft => ({
  name: record.name ?? '',
  status: record.status ?? 'todo',
  owner: record.owner ?? '',
  priority: record.priority ?? 0,
  progress: record.progress ?? 0,
  is_active: Boolean(record.is_active),
})

interface OwnerFormValues {
  owner: string
}

interface SortHeaderProps {
  field: SortField
  label: string
  sort: Sort | null
  onSort: (field: SortField) => void
  align?: 'left' | 'right'
}

/** A column title that cycles its sort: ascending → descending → default order */
function SortHeader({ field, label, sort, onSort, align = 'left' }: SortHeaderProps) {
  const { t } = useTranslation()
  const dir = sort?.field === field ? sort.dir : null
  const Icon = dir === 'asc' ? ArrowUp : dir === 'desc' ? ArrowDown : ArrowUpDown
  return (
    <button
      type="button"
      onClick={() => onSort(field)}
      className={cn(
        'hover:text-foreground inline-flex items-center gap-1 transition-colors',
        align === 'right' && 'flex-row-reverse',
        dir && 'text-foreground',
      )}
    >
      {t(label)}
      <Icon className={cn('size-3.5', !dir && 'opacity-40')} />
    </button>
  )
}

interface NumberCellProps {
  value: number
  min?: number
  max?: number
  label: string
  onChange: (value: number) => void
}

/** Integer input of an editing row (blank → 0) */
function NumberCell({ value, min, max, label, onChange }: NumberCellProps) {
  const { t } = useTranslation()
  return (
    <Input
      type="number"
      min={min}
      max={max}
      step={1}
      value={value}
      aria-label={t(label)}
      onChange={(e) => onChange(e.target.value === '' ? 0 : Math.trunc(Number(e.target.value)))}
      className="h-8 w-20 px-2 text-[13px] tabular-nums"
    />
  )
}

export default function AdvancedTablePage() {
  const { t } = useTranslation()
  const { hasPermission } = useAuth()
  const canEdit = hasPermission('cc_patterns_edit')
  const canDelete = hasPermission('cc_patterns_delete')

  const list = useCrudList(
    (params) =>
      getItems(params).catch((err: unknown) => {
        toast.apiError(err, '加载失败')
        return { items: [], total: 0 }
      }),
    { defaultPerPage: 20 },
  )
  const { data, total, loading, page, perPage, filters, fetchData, handlePageChange } = list
  const sort = sortOf(filters)
  const statusTab = isStatus(filters.status) ? filters.status : ''

  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [selectedKeys, setSelectedKeys] = useState<number[]>([])
  const [visible, setVisible] = useState<ColumnKey[]>(COLUMNS.map((c) => c.key))
  const [editing, setEditing] = useState<{ id: number; draft: InlineDraft } | null>(null)
  const [saving, setSaving] = useState(false)
  /** The row's values before the last inline save (undo writes them back) */
  const [lastEdit, setLastEdit] = useState<{ id: number; values: InlineDraft } | null>(null)
  const [ownerOpen, setOwnerOpen] = useState(false)

  const ownerForm = useForm<OwnerFormValues>({ defaultValues: { owner: '' } })

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once on mount
  }, [])

  /** Applies filters from page 1; the selection belongs to the old result, so it is cleared */
  const applyFilters = (next: CrudListFilters) => {
    setSelectedKeys([])
    setEditing(null)
    list.handleSearch(next)
  }
  const runSearch = () => applyFilters({ search: search.trim(), category })
  const reset = () => {
    setSearch('')
    setCategory('')
    setSelectedKeys([])
    setEditing(null)
    list.handleReset()
  }
  const toggleSort = (field: SortField) => {
    const next: Sort | null = sort?.field !== field ? { field, dir: 'asc' } : sort.dir === 'asc' ? { field, dir: 'desc' } : null
    applyFilters({ sort_field: next?.field ?? '', sort_dir: next?.dir ?? 'desc' })
  }

  // ── Inline editing ──────────────────────────────────────────────────────────
  const patchDraft = (patch: Partial<InlineDraft>) => setEditing((prev) => prev && { ...prev, draft: { ...prev.draft, ...patch } })

  const saveEdit = async (record: Row) => {
    if (!editing) return
    setSaving(true)
    try {
      await updateItem(record.id, editing.draft)
      setLastEdit({ id: record.id, values: toDraft(record) })
      setEditing(null)
      toast.success('保存成功')
      fetchData()
    } catch (err) {
      toast.apiError(err, '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const undoLastEdit = async () => {
    if (!lastEdit) return
    try {
      await updateItem(lastEdit.id, lastEdit.values)
      setEditing((prev) => (prev?.id === lastEdit.id ? null : prev))
      setLastEdit(null)
      toast.success('已撤销上次编辑')
      fetchData()
    } catch (err) {
      toast.apiError(err, '撤销失败')
    }
  }

  /** A batch change or delete makes the undo snapshot of those rows stale */
  const dropLastEdit = (ids: number[]) => setLastEdit((prev) => (prev && ids.includes(prev.id) ? null : prev))

  const remove = async (record: Row) => {
    try {
      await deleteItem(record.id)
      toast.success('删除成功')
      setSelectedKeys((keys) => keys.filter((k) => k !== record.id))
      dropLastEdit([record.id])
      fetchData()
    } catch (err) {
      toast.apiError(err, '删除失败')
      throw err
    }
  }

  // ── Batch actions ───────────────────────────────────────────────────────────
  /** Sets the same values on every selected row; resolves to whether it succeeded */
  const runBatchUpdate = async (patch: Omit<DemoRecordBatchUpdateBody, 'ids'>) => {
    try {
      await batchUpdate({ ids: selectedKeys, ...patch })
      toast.success(t('已更新 {{count}} 条记录', { count: selectedKeys.length }))
      dropLastEdit(selectedKeys)
      fetchData()
      return true
    } catch (err) {
      toast.apiError(err, '批量更新失败')
      return false
    }
  }

  const openOwnerDialog = () => {
    ownerForm.reset({ owner: '' })
    setOwnerOpen(true)
  }

  const submitOwner = async ({ owner }: OwnerFormValues) => {
    if (await runBatchUpdate({ owner: owner.trim() })) setOwnerOpen(false)
  }

  const removeSelected = async () => {
    try {
      await batchDelete({ ids: selectedKeys })
      toast.success(t('已删除 {{count}} 条记录', { count: selectedKeys.length }))
      dropLastEdit(selectedKeys)
      setSelectedKeys([])
      fetchData()
    } catch (err) {
      toast.apiError(err, '批量删除失败')
      throw err
    }
  }

  // ── Columns ─────────────────────────────────────────────────────────────────
  const draftOf = (record: Row) => (editing?.id === record.id ? editing.draft : null)
  const sortable = (field: SortField, label: string, align?: 'right'): ReactNode => (
    <SortHeader field={field} label={label} sort={sort} onSort={toggleSort} align={align} />
  )

  const columnDefs: Record<ColumnKey, DataTableColumn<Row>> = {
    code: {
      title: '编码',
      dataIndex: 'code',
      width: 130,
      render: (value) => <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-xs whitespace-nowrap">{value}</code>,
    },
    name: {
      title: sortable('name', '名称'),
      dataIndex: 'name',
      minWidth: 180,
      render: (value, record) => {
        const draft = draftOf(record)
        return draft ? (
          <Input value={draft.name} aria-label={t('名称')} onChange={(e) => patchDraft({ name: e.target.value })} className="h-8 text-[13px]" />
        ) : (
          <span className="font-medium">{value}</span>
        )
      },
    },
    category: {
      title: '分类',
      dataIndex: 'category',
      width: 90,
      render: (value) => {
        const label = categoryLabel(value)
        return label ? t(label) : '-'
      },
    },
    status: {
      title: sortable('status', '状态'),
      dataIndex: 'status',
      width: 130,
      render: (value, record) => {
        const draft = draftOf(record)
        if (draft) {
          return (
            <Select value={draft.status} onValueChange={(next) => isStatus(next) && patchDraft({ status: next })}>
              <SelectTrigger size="sm" className="h-8 w-28 text-[13px]" aria-label={t('状态')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {t(o.label)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )
        }
        const option = statusOption(value)
        return option ? (
          <StatusBadge tone={option.tone} dot>
            {option.label}
          </StatusBadge>
        ) : (
          '-'
        )
      },
    },
    owner: {
      title: '负责人',
      dataIndex: 'owner',
      width: 130,
      render: (value, record) => {
        const draft = draftOf(record)
        return draft ? (
          <Input value={draft.owner} aria-label={t('负责人')} onChange={(e) => patchDraft({ owner: e.target.value })} className="h-8 text-[13px]" />
        ) : (
          value || '-'
        )
      },
    },
    priority: {
      title: sortable('priority', '优先级', 'right'),
      dataIndex: 'priority',
      width: 110,
      align: 'right',
      className: 'tabular-nums',
      render: (value, record) => {
        const draft = draftOf(record)
        return draft ? <NumberCell value={draft.priority} label="优先级" onChange={(priority) => patchDraft({ priority })} /> : value
      },
    },
    progress: {
      title: sortable('progress', '进度'),
      dataIndex: 'progress',
      width: 140,
      render: (value, record) => {
        const draft = draftOf(record)
        if (draft) return <NumberCell value={draft.progress} min={0} max={100} label="进度" onChange={(progress) => patchDraft({ progress })} />
        const pct = Math.max(0, Math.min(100, value ?? 0))
        return (
          <div className="flex items-center gap-2">
            <div className="bg-muted h-1.5 w-16 overflow-hidden rounded-full">
              <div className={cn('h-full rounded-full', pct >= 100 ? 'bg-success' : 'bg-brand-gradient')} style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs tabular-nums">{pct}%</span>
          </div>
        )
      },
    },
    amount: {
      title: sortable('amount', '金额', 'right'),
      dataIndex: 'amount',
      width: 120,
      align: 'right',
      className: 'tabular-nums',
      render: (value) => formatNumber(value),
    },
    start_date: {
      title: sortable('start_date', '开始日期'),
      dataIndex: 'start_date',
      width: 120,
      className: 'text-muted-foreground tabular-nums',
      render: (value) => formatDate(value),
    },
    is_active: {
      title: '是否启用',
      dataIndex: 'is_active',
      width: 100,
      render: (value, record) => {
        const draft = draftOf(record)
        if (draft) {
          return <Switch size="sm" checked={draft.is_active} onCheckedChange={(checked) => patchDraft({ is_active: checked })} aria-label={t('是否启用')} />
        }
        const option = enabledOption(Boolean(value))
        return (
          <StatusBadge tone={option.tone} dot>
            {option.label}
          </StatusBadge>
        )
      },
    },
    updated_at: {
      title: sortable('updated_at', '更新时间'),
      dataIndex: 'updated_at',
      width: 170,
      className: 'text-muted-foreground tabular-nums',
      render: (value) => formatDateTime(value),
    },
  }

  const columns: DataTableColumn<Row>[] = [
    ...COLUMNS.filter((c) => visible.includes(c.key)).map((c) => ({ ...columnDefs[c.key], key: c.key })),
    {
      key: 'actions',
      pin: 'end',
      title: '',
      align: 'right',
      width: 140,
      render: (_, record) =>
        draftOf(record) ? (
          <div className="flex justify-end gap-1">
            <Button size="sm" className="h-7 px-2.5" disabled={saving} onClick={() => saveEdit(record)}>
              {saving ? <Spinner /> : null}
              {t('保存')}
            </Button>
            <Button size="sm" variant="ghost" className="h-7 px-2" disabled={saving} onClick={() => setEditing(null)}>
              {t('取消')}
            </Button>
          </div>
        ) : (
          <div className="flex justify-end gap-0.5">
            {canEdit ? (
              <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setEditing({ id: record.id, draft: toDraft(record) })}>
                {t('编辑')}
              </Button>
            ) : null}
            {canDelete ? (
              <ConfirmAction title="确认删除该记录？" description="删除后不可恢复。" confirmText="删除" onConfirm={() => remove(record)}>
                <Button variant="ghost" size="sm" className="text-danger hover:text-danger h-7 px-2">
                  {t('删除')}
                </Button>
              </ConfirmAction>
            ) : null}
          </div>
        ),
    },
  ]

  const columnMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8">
          <Columns3 />
          {t('列设置')}
          <span className="text-muted-foreground tabular-nums">
            {visible.length}/{COLUMNS.length}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">{t('显示列')}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {COLUMNS.map((column) => (
          <DropdownMenuCheckboxItem
            key={column.key}
            checked={visible.includes(column.key)}
            // Keep the menu open while toggling several columns
            onSelect={(e) => e.preventDefault()}
            onCheckedChange={(checked) =>
              setVisible((prev) => (checked ? COLUMNS.map((c) => c.key).filter((k) => k === column.key || prev.includes(k)) : prev.filter((k) => k !== column.key)))
            }
          >
            {t(column.label)}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )

  return (
    <div>
      <PageHeader
        title="高级表格"
        actions={
          canEdit ? (
            <Button variant="outline" size="sm" disabled={!lastEdit} onClick={undoLastEdit}>
              <Undo2 />
              {t('撤销上次编辑')}
            </Button>
          ) : null
        }
      />

      <FilterBar onSearch={runSearch} onReset={reset} extra={columnMenu}>
        <SearchInput value={search} onChange={setSearch} onSubmit={runSearch} placeholder="名称 / 编码" />
        <FilterSelect value={category} onChange={setCategory} options={CATEGORY_OPTIONS} placeholder="分类" allLabel="全部分类" />
      </FilterBar>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <SegmentedTabs value={statusTab} onChange={(status) => applyFilters({ status })} items={STATUS_TABS} variant="pill" className="shrink-0" />
        <AnimatePresence initial={false}>
          {selectedKeys.length ? (
            <motion.div
              initial={{ opacity: 0, x: 6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 6 }}
              transition={{ duration: 0.18 }}
              className="flex flex-wrap items-center gap-2"
            >
              <span className="bg-brand-soft text-primary inline-flex h-8 items-center gap-1.5 rounded-md pr-1 pl-2.5 text-xs">
                <Trans
                  i18nKey="已勾选 <0>{{count}}</0> 条"
                  values={{ count: selectedKeys.length }}
                  components={[<span key="count" className="font-medium tabular-nums" />]}
                />
                <button
                  type="button"
                  aria-label={t('清空勾选')}
                  onClick={() => setSelectedKeys([])}
                  className="hover:bg-primary/10 flex size-6 items-center justify-center rounded"
                >
                  <X className="size-3.5" />
                </button>
              </span>
              {canEdit ? (
                <>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="h-8">
                        {t('设置状态')}
                        <ChevronDown />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {STATUS_OPTIONS.map((o) => (
                        <DropdownMenuItem key={o.value} onSelect={() => runBatchUpdate({ status: o.value })}>
                          <StatusBadge tone={o.tone} variant="plain" dot>
                            {o.label}
                          </StatusBadge>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button variant="outline" size="sm" className="h-8" onClick={openOwnerDialog}>
                    <UserRound />
                    {t('设置负责人')}
                  </Button>
                  <Button variant="outline" size="sm" className="h-8" onClick={() => runBatchUpdate({ is_active: true })}>
                    <CircleCheck />
                    {t('启用')}
                  </Button>
                  <Button variant="outline" size="sm" className="h-8" onClick={() => runBatchUpdate({ is_active: false })}>
                    <CircleOff />
                    {t('停用')}
                  </Button>
                </>
              ) : null}
              {canDelete ? (
                <ConfirmAction
                  title="确认批量删除选中记录？"
                  description={t('将删除已勾选的 {{count}} 条记录，删除后不可恢复。', { count: selectedKeys.length })}
                  confirmText="删除"
                  onConfirm={removeSelected}
                >
                  <Button variant="outline" size="sm" className="text-danger hover:text-danger h-8">
                    <Trash2 />
                    {t('删除')}
                  </Button>
                </ConfirmAction>
              ) : null}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      <DataTable
        columns={columns}
        data={data}
        loading={loading}
        minWidth={1400}
        selectable={canEdit || canDelete}
        selectedKeys={selectedKeys}
        onSelectionChange={setSelectedKeys}
        rowClassName={(record) => (draftOf(record) ? 'bg-brand-soft/60 hover:bg-brand-soft/60' : undefined)}
        pagination={{ page, perPage, total, onChange: handlePageChange }}
        filtered={Boolean(filters.search || filters.category || statusTab)}
        onClearFilters={reset}
        emptyTitle="还没有记录"
        emptyDescription="在「标准列表」新建的示例记录会出现在这里"
      />

      <FormDialog
        open={ownerOpen}
        onOpenChange={setOwnerOpen}
        title="设置负责人"
        description={t('应用到已勾选的 {{count}} 条记录，留空则清空负责人。', { count: selectedKeys.length })}
        form={ownerForm}
        onSubmit={submitOwner}
        size="sm"
      >
        <FormInput control={ownerForm.control} name="owner" label="负责人" rules={{ maxLength: { value: 50, message: '最多 50 个字符' } }} />
      </FormDialog>
    </div>
  )
}
