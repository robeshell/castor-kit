import { useEffect, useState } from 'react'
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { AnimatePresence, motion } from 'motion/react'
import {
  Archive,
  ArrowUpDown,
  Columns3,
  Gauge,
  GripVertical,
  Pin,
  Plus,
  RefreshCw,
  Rows3,
  Send,
  Star,
  Trash2,
  Undo2,
  X,
} from 'lucide-react'
import { Trans, useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'
import { formatDateTime } from '@/lib/format'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import {
  batchDeleteAdvancedTableRows,
  batchUpdateAdvancedTableRows,
  createAdvancedTableRow,
  deleteAdvancedTableRow,
  getAdvancedTableRows,
  getAdvancedTableStats,
  reorderAdvancedTableRows,
  updateAdvancedTableRow,
} from '@/modules/component_center/api/advanced_table_page'
import ConfirmAction from '@/shared/components/ConfirmAction'
import DataTable from '@/shared/components/DataTable'
import { FilterBar, FilterSelect, SearchInput } from '@/shared/components/Filters'
import PageHeader from '@/shared/components/PageHeader'
import SegmentedTabs from '@/shared/components/SegmentedTabs'
import StatCard from '@/shared/components/StatCard'
import StatusBadge from '@/shared/components/StatusBadge'
import { useCrudList } from '@/shared/hooks/useCrudList'

const STATUS_META = {
  draft: { label: '草稿', tone: 'info' },
  published: { label: '已发布', tone: 'success' },
  archived: { label: '已归档', tone: 'neutral' },
}
const STATUS_OPTIONS = [
  { label: '草稿', value: 'draft' },
  { label: '已发布', value: 'published' },
  { label: '已归档', value: 'archived' },
]
const CATEGORY_OPTIONS = [
  { label: '通用', value: 'general' },
  { label: '订单', value: 'order' },
  { label: '用户', value: 'user' },
  { label: '财务', value: 'finance' },
  { label: '风控', value: 'risk' },
]
const CATEGORY_MAP = Object.fromEntries(CATEGORY_OPTIONS.map((item) => [item.value, item.label]))
const STATUS_TABS = [
  { label: '全部', value: '' },
  { label: '草稿', value: 'draft' },
  { label: '已发布', value: 'published' },
  { label: '已归档', value: 'archived' },
]
const ALL_COLUMNS = [
  { key: 'row_code', label: '编码' },
  { key: 'name', label: '名称' },
  { key: 'category', label: '分类' },
  { key: 'owner', label: '负责人' },
  { key: 'status', label: '状态' },
  { key: 'priority', label: '优先级' },
  { key: 'progress', label: '进度' },
  { key: 'score', label: '评分' },
  { key: 'tags', label: '标签' },
  { key: 'is_active', label: '启用' },
  { key: 'is_pinned', label: '置顶' },
  { key: 'updated_at', label: '更新时间' },
]

// Actions column is pinned right: keeps an opaque background while scrolling horizontally and matches row hover / selected colors
const STICKY_CELL =
  'sticky right-0 z-[1] bg-card shadow-[inset_1px_0_0_var(--border),-10px_0_12px_-12px_rgba(15,23,42,0.28)] transition-colors duration-150 group-hover/row:bg-[color-mix(in_srgb,var(--muted)_40%,var(--card))] group-data-[state=selected]/row:bg-[color-mix(in_srgb,var(--primary)_9%,var(--card))]'
const STICKY_HEAD = 'sticky right-0 z-[1] bg-[color-mix(in_srgb,var(--muted)_40%,var(--card))] shadow-[inset_1px_0_0_var(--border)]'

function splitTags(value) {
  return String(value || '')
    .split(/[,，]/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function NumberCell({ value, onChange }) {
  return (
    <Input
      type="number"
      min={0}
      max={100}
      value={value === null || value === undefined ? '' : value}
      onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
      className="h-8 w-20 px-2 text-[13px] tabular-nums"
    />
  )
}

function SortableItem({ item, index }) {
  const { t } = useTranslation()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      {...attributes}
      {...listeners}
      className={cn(
        'bg-card relative flex cursor-grab touch-none items-center gap-3 rounded-lg px-3 py-2.5 shadow-[0_0_0_1px_var(--border)] outline-none select-none',
        'focus-visible:ring-ring/50 transition-shadow duration-200 focus-visible:ring-[3px]',
        isDragging &&
          'z-10 cursor-grabbing shadow-[0_0_0_1px_color-mix(in_srgb,var(--primary)_35%,transparent),0_16px_32px_-14px_rgba(15,23,42,0.35)]',
      )}
    >
      <GripVertical className="text-muted-foreground size-4 shrink-0" />
      <span className="text-muted-foreground w-5 text-right text-xs tabular-nums">{index + 1}</span>
      <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{item.name}</span>
      <span className="text-muted-foreground rounded-md border px-1.5 font-mono text-[11px]">{item.row_code}</span>
      <span className="text-muted-foreground w-20 text-right text-xs tabular-nums">{t('排序值: {{value}}', { value: item.sort_order })}</span>
    </div>
  )
}

export default function AdvancedTablePage() {
  const { t } = useTranslation()
  const list = useCrudList(
    (params) =>
      getAdvancedTableRows(params).catch((err) => {
        toast.apiError(err, '加载失败')
        return { items: [], total: 0 }
      }),
    { defaultPerPage: 20 },
  )
  const { data, total, loading, page, perPage, filters, fetchData, handlePageChange } = list
  const [stats, setStats] = useState(null)

  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [pinnedOnly, setPinnedOnly] = useState(false)

  const [selectedRowKeys, setSelectedRowKeys] = useState([])
  const [editingRowId, setEditingRowId] = useState(null)
  const [editingDraft, setEditingDraft] = useState({})
  const [savingRowId, setSavingRowId] = useState(null)
  const [lastSnapshot, setLastSnapshot] = useState(null)
  const [visibleColumns, setVisibleColumns] = useState(ALL_COLUMNS.map((item) => item.key))
  const [sortSheetVisible, setSortSheetVisible] = useState(false)
  const [sortItems, setSortItems] = useState([])
  const [sortSaving, setSortSaving] = useState(false)
  const [createVisible, setCreateVisible] = useState(false)
  const [creating, setCreating] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const fetchStats = () => {
    getAdvancedTableStats()
      .then(setStats)
      .catch(() => setStats((prev) => prev ?? {}))
  }

  useEffect(() => {
    fetchStats()
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial load only
  }, [])

  const onSearch = () => {
    list.handleSearch({ search: search.trim(), category, pinned_only: pinnedOnly })
  }

  // ── Inline editing ───────────────────────────────────────
  const setDraft = (key) => (value) => setEditingDraft((prev) => ({ ...prev, [key]: value }))

  const openInlineEdit = (record) => {
    setEditingRowId(record.id)
    setEditingDraft({
      name: record.name,
      owner: record.owner || '',
      status: record.status || 'draft',
      priority: record.priority ?? 0,
      progress: record.progress ?? 0,
      score: record.score ?? 0,
      tags: record.tags || '',
      remark: record.remark || '',
    })
  }

  const saveInlineEdit = (record) => {
    setLastSnapshot({
      id: record.id,
      payload: {
        name: record.name,
        owner: record.owner,
        status: record.status,
        priority: record.priority,
        progress: record.progress,
        score: record.score,
        tags: record.tags,
        remark: record.remark,
      },
    })
    setSavingRowId(record.id)
    updateAdvancedTableRow(record.id, editingDraft)
      .then(() => {
        toast.success('保存成功')
        setEditingRowId(null)
        fetchData()
        fetchStats()
      })
      .catch((err) => toast.apiError(err, '保存失败'))
      .finally(() => setSavingRowId(null))
  }

  const undoLastEdit = () => {
    if (!lastSnapshot) return
    updateAdvancedTableRow(lastSnapshot.id, lastSnapshot.payload)
      .then(() => {
        toast.success('已撤销最近一次编辑')
        setLastSnapshot(null)
        fetchData()
        fetchStats()
      })
      .catch((err) => toast.apiError(err, '撤销失败'))
  }

  const toggleField = (record, field, checked) => {
    updateAdvancedTableRow(record.id, { [field]: checked })
      .then(() => {
        fetchData()
        if (field === 'is_pinned') fetchStats()
      })
      .catch((err) => toast.apiError(err, '更新失败'))
  }

  const removeRow = async (record) => {
    try {
      await deleteAdvancedTableRow(record.id)
      toast.success('删除成功')
      setSelectedRowKeys((keys) => keys.filter((k) => k !== record.id))
      setLastSnapshot((snap) => (snap?.id === record.id ? null : snap))
      fetchData()
      fetchStats()
    } catch (err) {
      toast.apiError(err, '删除失败')
      throw err
    }
  }

  // ── Drag-and-drop sorting ────────────────────────────────
  const openSortSheet = () => {
    setSortItems([...data].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)).map((item) => ({ ...item })))
    setSortSheetVisible(true)
  }

  const saveSort = () => {
    const payload = sortItems.map((item, index) => ({ id: item.id, sort_order: (index + 1) * 10 }))
    setSortSaving(true)
    reorderAdvancedTableRows(payload)
      .then(() => {
        toast.success('拖拽排序已保存')
        setSortSheetVisible(false)
        fetchData()
      })
      .catch((err) => toast.apiError(err, '排序保存失败'))
      .finally(() => setSortSaving(false))
  }

  // ── Batch actions ────────────────────────────────────────
  const warnEmpty = () => toast.warning('请先勾选数据')

  const doBatchSetStatus = (nextStatus) => {
    if (!selectedRowKeys.length) return warnEmpty()
    batchUpdateAdvancedTableRows({ ids: selectedRowKeys, status: nextStatus })
      .then((res) => {
        toast.success(res?.message || '批量更新成功')
        fetchData()
        fetchStats()
      })
      .catch((err) => toast.apiError(err, '批量更新失败'))
  }

  const doBatchDelete = async () => {
    try {
      const res = await batchDeleteAdvancedTableRows({ ids: selectedRowKeys })
      toast.success(res?.message || '批量删除成功')
      setLastSnapshot((snap) => (snap && selectedRowKeys.includes(snap.id) ? null : snap))
      setSelectedRowKeys([])
      fetchData()
      fetchStats()
    } catch (err) {
      toast.apiError(err, '批量删除失败')
      throw err
    }
  }

  const createRow = () => {
    const rowCode = `ADV-${Date.now().toString().slice(-6)}`
    const safeSortOrder = Math.floor(Date.now() / 1000)
    setCreating(true)
    createAdvancedTableRow({
      // i18n-ignore-next-line: default content of the demo record saved to the database
      name: `新记录-${new Date().toLocaleTimeString('zh-CN', { hour12: false })}`,
      row_code: rowCode,
      category: 'general',
      owner: 'admin',
      status: 'draft',
      priority: 50,
      progress: 0,
      score: 0,
      // i18n-ignore-next-line: default content of the demo record saved to the database
      tags: '新建',
      is_active: true,
      is_pinned: false,
      sort_order: safeSortOrder,
      // i18n-ignore-next-line: default content of the demo record saved to the database
      remark: '可立即进行行内编辑',
    })
      .then(() => {
        toast.success('新增成功')
        setCreateVisible(false)
        list.handleSearch()
        fetchStats()
      })
      .catch((err) => toast.apiError(err, '新增失败'))
      .finally(() => setCreating(false))
  }

  // ── Column definitions ───────────────────────────────────
  const isEditing = (record) => editingRowId === record.id
  const columnDefs = {
    row_code: {
      title: '编码',
      dataIndex: 'row_code',
      width: 120,
      className: 'font-mono text-xs text-muted-foreground',
    },
    name: {
      title: '名称',
      dataIndex: 'name',
      width: 220,
      render: (text, record) =>
        isEditing(record) ? (
          <Input value={editingDraft.name ?? ''} onChange={(e) => setDraft('name')(e.target.value)} className="h-8 text-[13px]" />
        ) : (
          <span className="inline-flex max-w-full items-center gap-1.5">
            {record.is_pinned ? <Pin className="text-primary size-3.5 shrink-0 fill-current" /> : null}
            <span className="truncate font-medium">{text}</span>
          </span>
        ),
    },
    category: {
      title: '分类',
      dataIndex: 'category',
      width: 110,
      render: (value) => (CATEGORY_MAP[value] ? t(CATEGORY_MAP[value]) : value || '-'),
    },
    owner: {
      title: '负责人',
      dataIndex: 'owner',
      width: 120,
      render: (text, record) =>
        isEditing(record) ? (
          <Input value={editingDraft.owner ?? ''} onChange={(e) => setDraft('owner')(e.target.value)} className="h-8 text-[13px]" />
        ) : (
          text || '-'
        ),
    },
    status: {
      title: '状态',
      dataIndex: 'status',
      width: 130,
      render: (value, record) =>
        isEditing(record) ? (
          <Select value={editingDraft.status} onValueChange={setDraft('status')}>
            <SelectTrigger size="sm" className="h-8 w-[110px] text-[13px]">
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
        ) : (
          <StatusBadge tone={STATUS_META[value]?.tone || 'neutral'} dot>
            {STATUS_META[value]?.label || value}
          </StatusBadge>
        ),
    },
    priority: {
      title: '优先级',
      dataIndex: 'priority',
      width: 100,
      className: 'tabular-nums',
      render: (value, record) =>
        isEditing(record) ? <NumberCell value={editingDraft.priority} onChange={setDraft('priority')} /> : (value ?? 0),
    },
    progress: {
      title: '进度(%)',
      dataIndex: 'progress',
      width: 140,
      render: (value, record) => {
        if (isEditing(record)) return <NumberCell value={editingDraft.progress} onChange={setDraft('progress')} />
        const pct = Math.max(0, Math.min(100, Number(value) || 0))
        return (
          <div className="flex items-center gap-2">
            <div className="bg-muted h-1.5 w-16 overflow-hidden rounded-full">
              <div className={cn('h-full rounded-full', pct >= 100 ? 'bg-success' : 'bg-brand-gradient')} style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs tabular-nums">{value ?? 0}</span>
          </div>
        )
      },
    },
    score: {
      title: '评分',
      dataIndex: 'score',
      width: 100,
      className: 'tabular-nums',
      render: (value, record) =>
        isEditing(record) ? <NumberCell value={editingDraft.score} onChange={setDraft('score')} /> : Number(value || 0).toFixed(1),
    },
    tags: {
      title: '标签',
      dataIndex: 'tags',
      width: 200,
      render: (value, record) =>
        isEditing(record) ? (
          <Input value={editingDraft.tags ?? ''} onChange={(e) => setDraft('tags')(e.target.value)} className="h-8 text-[13px]" />
        ) : splitTags(value).length ? (
          <div className="flex flex-wrap gap-1">
            {splitTags(value).map((t) => (
              <span key={t} className="text-muted-foreground inline-flex h-5 items-center rounded-md border px-1.5 text-[11px]">
                {t}
              </span>
            ))}
          </div>
        ) : (
          '-'
        ),
    },
    is_active: {
      title: '启用',
      dataIndex: 'is_active',
      width: 80,
      render: (value, record) => (
        <Switch size="sm" checked={Boolean(value)} onCheckedChange={(checked) => toggleField(record, 'is_active', checked)} aria-label={t('启用')} />
      ),
    },
    is_pinned: {
      title: '置顶',
      dataIndex: 'is_pinned',
      width: 80,
      render: (value, record) => (
        <Switch size="sm" checked={Boolean(value)} onCheckedChange={(checked) => toggleField(record, 'is_pinned', checked)} aria-label={t('置顶')} />
      ),
    },
    updated_at: {
      title: '更新时间',
      dataIndex: 'updated_at',
      width: 170,
      className: 'text-muted-foreground tabular-nums',
      render: (value) => formatDateTime(value),
    },
  }

  const columns = [
    ...ALL_COLUMNS.filter((item) => visibleColumns.includes(item.key)).map((item) => ({ key: item.key, ...columnDefs[item.key] })),
    {
      key: 'actions',
      title: '操作',
      width: 168,
      align: 'right',
      className: STICKY_CELL,
      headerClassName: STICKY_HEAD,
      render: (_, record) =>
        isEditing(record) ? (
          <div className="flex justify-end gap-1">
            <Button size="sm" className="h-7 px-2.5" disabled={savingRowId === record.id} onClick={() => saveInlineEdit(record)}>
              {savingRowId === record.id ? <Spinner /> : null}
              {t('保存')}
            </Button>
            <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setEditingRowId(null)}>
              {t('取消')}
            </Button>
          </div>
        ) : (
          <div className="flex justify-end gap-0.5">
            <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => openInlineEdit(record)}>
              {t('行内编辑')}
            </Button>
            <ConfirmAction title="确认删除该记录？" description={record.name} confirmText="删除" onConfirm={() => removeRow(record)}>
              <Button variant="ghost" size="sm" className="text-danger hover:text-danger h-7 px-2">
                {t('删除')}
              </Button>
            </ConfirmAction>
          </div>
        ),
    },
  ]

  const avg = (v) => (v === null || v === undefined ? 0 : Number(v))
  const decimalsOf = (v) => (Number.isInteger(avg(v)) ? 0 : 2)

  return (
    <div className="space-y-5">
      <PageHeader
        title="高级表格页"
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                fetchData()
                fetchStats()
              }}
            >
              <RefreshCw />
              {t('刷新')}
            </Button>
            <Button variant="outline" size="sm" onClick={openSortSheet}>
              <ArrowUpDown />
              {t('拖拽排序')}
            </Button>
            <Button variant="outline" size="sm" disabled={!lastSnapshot} onClick={undoLastEdit}>
              <Undo2 />
              {t('撤销上次编辑')}
            </Button>
            <Button size="sm" variant="brand" onClick={() => setCreateVisible(true)}>
              <Plus />
              {t('新增')}
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <StatCard loading={!stats} label="总记录" icon={Rows3} value={stats?.total ?? 0} />
        <StatCard loading={!stats} label="已发布" icon={Send} value={stats?.published_count ?? 0} />
        <StatCard loading={!stats} label="置顶" icon={Pin} value={stats?.pinned_count ?? 0} />
        <StatCard loading={!stats} label="平均进度" icon={Gauge} value={avg(stats?.avg_progress)} decimals={decimalsOf(stats?.avg_progress)} suffix="%" />
        <StatCard loading={!stats} label="平均评分" icon={Star} value={avg(stats?.avg_score)} decimals={decimalsOf(stats?.avg_score)} className="col-span-2 md:col-span-1" />
      </div>

      <div>
        <FilterBar
          onSearch={onSearch}
          extra={
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8">
                  <Columns3 />
                  {t('列设置')}
                  <span className="text-muted-foreground tabular-nums">
                    {visibleColumns.length}/{ALL_COLUMNS.length}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">{t('显示列')}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {ALL_COLUMNS.map((item) => (
                  <DropdownMenuCheckboxItem
                    key={item.key}
                    checked={visibleColumns.includes(item.key)}
                    onSelect={(e) => e.preventDefault()}
                    onCheckedChange={(checked) =>
                      setVisibleColumns((prev) =>
                        checked
                          ? ALL_COLUMNS.map((c) => c.key).filter((k) => k === item.key || prev.includes(k))
                          : prev.filter((k) => k !== item.key),
                      )
                    }
                  >
                    {t(item.label)}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          }
        >
          <SearchInput value={search} onChange={setSearch} onSubmit={onSearch} placeholder="搜索名称/编码/标签/负责人" className="sm:w-64" />
          <FilterSelect value={category} onChange={setCategory} options={CATEGORY_OPTIONS} placeholder="分类" allLabel="全部分类" />
          <label className="text-muted-foreground flex h-8 cursor-pointer items-center gap-2 rounded-md border px-2.5 text-[13px]">
            <Switch size="sm" checked={pinnedOnly} onCheckedChange={setPinnedOnly} />
            {t('仅看置顶')}
          </label>
        </FilterBar>

        <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <SegmentedTabs
            value={filters.status ?? ''}
            onChange={(key) => list.handleSearch({ status: key })}
            items={STATUS_TABS}
            className="md:border-b-0"
          />
          <div className="flex flex-wrap items-center gap-2">
            <AnimatePresence initial={false}>
              {selectedRowKeys.length ? (
                <motion.span
                  initial={{ opacity: 0, x: 6 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 6 }}
                  transition={{ duration: 0.18 }}
                  className="bg-brand-soft text-primary inline-flex h-8 items-center gap-1.5 rounded-md pr-1 pl-2.5 text-xs"
                >
                  <span>
                    <Trans
                      i18nKey="已勾选 <0>{{count}}</0> 条"
                      values={{ count: selectedRowKeys.length }}
                      components={[<span key="count" className="font-medium tabular-nums" />]}
                    />
                  </span>
                  <button
                    type="button"
                    aria-label={t('清空勾选')}
                    onClick={() => setSelectedRowKeys([])}
                    className="hover:bg-primary/10 flex size-6 items-center justify-center rounded"
                  >
                    <X className="size-3.5" />
                  </button>
                </motion.span>
              ) : null}
            </AnimatePresence>
            <Button variant="outline" size="sm" className="h-8" onClick={() => doBatchSetStatus('published')}>
              <Send />
              {t('批量发布')}
            </Button>
            <Button variant="outline" size="sm" className="h-8" onClick={() => doBatchSetStatus('archived')}>
              <Archive />
              {t('批量归档')}
            </Button>
            <ConfirmAction
              title="确认批量删除选中记录？"
              description={t('将删除已勾选的 {{count}} 条记录，删除后不可恢复。', { count: selectedRowKeys.length })}
              confirmText="删除"
              disabled={!selectedRowKeys.length}
              onConfirm={doBatchDelete}
            >
              <Button
                variant="outline"
                size="sm"
                className="text-danger hover:text-danger h-8"
                onClick={selectedRowKeys.length ? undefined : warnEmpty}
              >
                <Trash2 />
                {t('批量删除')}
              </Button>
            </ConfirmAction>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={data}
          loading={loading}
          minWidth={1560}
          selectable
          selectedKeys={selectedRowKeys}
          onSelectionChange={setSelectedRowKeys}
          rowClassName={(row) => (isEditing(row) ? 'bg-brand-soft/60 hover:bg-brand-soft/60' : undefined)}
          pagination={{ page, perPage, total, onChange: handlePageChange }}
          emptyTitle="暂无记录"
          emptyDescription={filters.search || filters.category || filters.pinned_only || filters.status ? '换个筛选条件试试' : '点击右上角「新增」创建一条记录'}
        />
      </div>

      {/* Create confirmation */}
      <Dialog open={createVisible} onOpenChange={(next) => !creating && setCreateVisible(next)}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>{t('新增记录')}</DialogTitle>
            <DialogDescription>{t('将创建一条可直接行内编辑的默认记录。')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" disabled={creating} onClick={() => setCreateVisible(false)}>
              {t('取消')}
            </Button>
            <Button disabled={creating} onClick={createRow}>
              {creating ? <Spinner /> : null}
              {t('确定')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Drag-and-drop sorting */}
      <Sheet open={sortSheetVisible} onOpenChange={(next) => !sortSaving && setSortSheetVisible(next)}>
        <SheetContent className="gap-0 p-0 sm:max-w-none" style={{ width: 'min(520px, 100vw)' }}>
          <SheetHeader className="border-b px-6 py-4">
            <SheetTitle>{t('拖拽排序')}</SheetTitle>
            <SheetDescription>
              <Trans
                i18nKey="拖动条目后保存，系统会更新 <0>sort_order</0>，表格将按新顺序展示。"
                components={[<code key="field" className="bg-muted rounded px-1 font-mono text-xs" />]}
              />
            </SheetDescription>
          </SheetHeader>
          <ScrollArea className="min-h-0 flex-1">
            <div className="px-6 py-5">
              {sortItems.length ? (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={({ active, over }) => {
                    if (!over || active.id === over.id) return
                    setSortItems((prev) => {
                      const oldIndex = prev.findIndex((item) => item.id === active.id)
                      const newIndex = prev.findIndex((item) => item.id === over.id)
                      if (oldIndex < 0 || newIndex < 0) return prev
                      return arrayMove(prev, oldIndex, newIndex)
                    })
                  }}
                >
                  <SortableContext items={sortItems.map((item) => item.id)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-2">
                      {sortItems.map((item, index) => (
                        <SortableItem key={item.id} item={item} index={index} />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              ) : (
                <p className="text-muted-foreground py-10 text-center text-[13px]">{t('当前页暂无数据')}</p>
              )}
            </div>
          </ScrollArea>
          <SheetFooter className="flex-row justify-end gap-2 border-t px-6 py-4">
            <Button variant="outline" disabled={sortSaving} onClick={() => setSortSheetVisible(false)}>
              {t('取消')}
            </Button>
            <Button disabled={sortSaving} onClick={saveSort}>
              {sortSaving ? <Spinner /> : null}
              {t('保存排序')}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  )
}
