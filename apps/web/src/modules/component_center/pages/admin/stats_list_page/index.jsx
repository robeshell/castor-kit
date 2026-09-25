import { useEffect, useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import ReactECharts from 'echarts-for-react'
import { AnimatePresence, motion } from 'motion/react'
import { Archive, CircleCheck, Download, Layers, Plus, Upload, Wallet, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { chartBase, useChartColors } from '@/lib/chart-theme'
import { formatDateTime } from '@/lib/format'
import { EASE_OUT } from '@/lib/motion'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import {
  createStatsListPage,
  deleteStatsListPage,
  downloadStatsListPageTemplate,
  exportStatsListPage,
  getStatsListPageList,
  getStatsListPageStats,
  importStatsListPage,
  updateStatsListPage,
} from '@/modules/component_center/api/stats_list_page'
import ConfirmAction from '@/shared/components/ConfirmAction'
import DataTable from '@/shared/components/DataTable'
import ExportDialog from '@/shared/components/data-transfer/ExportDialog'
import ImportDialog from '@/shared/components/data-transfer/ImportDialog'
import { FilterBar, FilterSelect, SearchInput } from '@/shared/components/Filters'
import { DescriptionList, DetailSheet } from '@/shared/components/FormDialog'
import { FormGrid, FormInput, FormNumber, FormSelect, FormSwitch, FormTextarea } from '@/shared/components/FormFields'
import PageHeader from '@/shared/components/PageHeader'
import Panel from '@/shared/components/Panel'
import StatCard, { CountUp } from '@/shared/components/StatCard'
import StatusBadge from '@/shared/components/StatusBadge'
import { useCrudList } from '@/shared/hooks/useCrudList'
import { downloadBlobFile } from '@/shared/utils/file'
import StepFormDialog from '@/modules/component_center/pages/admin/stats_list_page/StepFormDialog'

const CATEGORY_OPTIONS = [
  { label: '通用', value: 'general' },
  { label: '订单', value: 'order' },
  { label: '用户', value: 'user' },
  { label: '财务', value: 'finance' },
  { label: '风控', value: 'risk' },
]

const STATUS_OPTIONS = [
  { label: '草稿', value: 'draft' },
  { label: '已发布', value: 'published' },
  { label: '已归档', value: 'archived' },
]

const ACTIVE_OPTIONS = [
  { label: '启用', value: 'true' },
  { label: '停用', value: 'false' },
]

const EXPORT_FIELDS = [
  { label: 'ID', value: 'id' },
  { label: '名称', value: 'name' },
  { label: '编码', value: 'item_code' },
  { label: '分类', value: 'category' },
  { label: '发布状态', value: 'status' },
  { label: '金额', value: 'amount' },
  { label: '数量', value: 'quantity' },
  { label: '负责人', value: 'owner' },
  { label: '优先级', value: 'priority' },
  { label: '启用状态', value: 'is_active' },
  { label: '描述', value: 'description' },
  { label: '创建时间', value: 'created_at' },
  { label: '更新时间', value: 'updated_at' },
]

const STEPS = [
  { title: '基础信息', description: '名称与分类', fields: ['name', 'item_code'] },
  { title: '数值配置', description: '金额与数量', fields: ['amount', 'quantity', 'priority'] },
  { title: '发布设置', description: '状态与描述', fields: ['status', 'description'] },
]

const EMPTY_VALUES = {
  name: '',
  item_code: '',
  category: 'general',
  owner: '',
  amount: 0,
  quantity: 0,
  priority: 0,
  is_active: true,
  status: 'draft',
  description: '',
}

const CATEGORY_LABEL_MAP = Object.fromEntries(CATEGORY_OPTIONS.map((o) => [o.value, o.label]))
const STATUS_META = {
  draft: { label: '草稿', tone: 'info' },
  published: { label: '已发布', tone: 'success' },
  archived: { label: '已归档', tone: 'neutral' },
}

const normalizeFileType = (raw) => (['csv', 'xls', 'xlsx'].includes(raw) ? raw : 'xlsx')
const money = (value) =>
  `¥ ${Number(value || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const formatAmount = (value) => (typeof value === 'number' ? money(value) : '-')
const statusMeta = (value) => STATUS_META[value] || STATUS_META.draft

function toFormValues(record) {
  if (!record) return { ...EMPTY_VALUES }
  return {
    name: record.name ?? '',
    item_code: record.item_code ?? '',
    category: record.category || 'general',
    owner: record.owner ?? '',
    amount: record.amount ?? 0,
    quantity: record.quantity ?? 0,
    priority: record.priority ?? 0,
    is_active: record.is_active !== false,
    status: record.status || 'draft',
    description: record.description ?? '',
  }
}

// ─── 分类分布（环形图 + 图例） ───────────────────────────────────────────────

function CategoryDistribution({ stats, loading }) {
  const c = useChartColors()
  const chartRef = useRef(null)
  const items = useMemo(() => stats?.category_stats || [], [stats])
  const total = stats?.total || 0
  const palette = useMemo(() => chartBase(c).color, [c])

  const option = useMemo(() => {
    const base = chartBase(c)
    return {
      color: base.color,
      textStyle: base.textStyle,
      tooltip: {
        ...base.tooltip,
        trigger: 'item',
        formatter: (p) =>
          `${p.marker}${p.name}<br/><span style="font-variant-numeric:tabular-nums">${p.value} 条 · ${p.percent}%</span>`,
      },
      series: [
        {
          type: 'pie',
          radius: ['64%', '88%'],
          center: ['50%', '50%'],
          avoidLabelOverlap: true,
          padAngle: 2,
          itemStyle: { borderRadius: 4, borderColor: c.card, borderWidth: 2 },
          label: { show: false },
          labelLine: { show: false },
          emphasis: { scale: true, scaleSize: 4 },
          data: items.map((item) => ({ name: CATEGORY_LABEL_MAP[item.category] || item.category, value: item.count })),
        },
      ],
      animationDuration: 700,
      animationEasing: 'cubicOut',
    }
  }, [c, items])

  const highlight = (index, on) => {
    const chart = chartRef.current?.getEchartsInstance?.()
    chart?.dispatchAction({ type: on ? 'highlight' : 'downplay', seriesIndex: 0, dataIndex: index })
  }

  return (
    <Panel title="分类分布" className="h-full">
      {loading && !stats ? (
        <div className="flex items-center gap-6">
          <Skeleton className="size-40 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </div>
        </div>
      ) : items.length === 0 ? (
        <div className="text-muted-foreground flex h-40 items-center justify-center text-[13px]">暂无分类数据</div>
      ) : (
        <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
          <div className="relative size-40 shrink-0">
            <ReactECharts ref={chartRef} option={option} style={{ height: 160, width: 160 }} notMerge opts={{ renderer: 'svg' }} />
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <CountUp value={total} className="text-xl leading-none font-semibold" />
              <span className="text-muted-foreground mt-1 text-[11px]">总记录</span>
            </div>
          </div>
          <ul className="w-full min-w-0 flex-1 space-y-0.5">
            {items.map((item, index) => {
              const pct = total > 0 ? Math.round((item.count / total) * 100) : 0
              return (
                <li
                  key={item.category}
                  onMouseEnter={() => highlight(index, true)}
                  onMouseLeave={() => highlight(index, false)}
                  className="hover:bg-muted/60 grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 rounded-md px-2 py-1.5 text-[13px] transition-colors"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: palette[index % palette.length] }} />
                    <span className="truncate">{CATEGORY_LABEL_MAP[item.category] || item.category}</span>
                  </span>
                  <span className="tabular-nums">
                    {item.count}
                    <span className="text-muted-foreground ml-1 text-xs">({pct}%)</span>
                  </span>
                  <span className="text-muted-foreground w-28 text-right text-xs tabular-nums">{money(item.amount)}</span>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </Panel>
  )
}

// ─── 发布状态（堆叠条） ──────────────────────────────────────────────────────

function StatusDistribution({ stats, loading }) {
  const total = stats?.total || 0
  const segments = [
    { key: 'published', label: '已发布', value: stats?.published_count || 0, className: 'bg-success' },
    { key: 'draft', label: '草稿', value: stats?.draft_count || 0, className: 'bg-primary' },
    { key: 'archived', label: '已归档', value: stats?.archived_count || 0, className: 'bg-muted-foreground/50' },
  ]
  const activePct = total > 0 ? Math.round(((stats?.active_count || 0) / total) * 100) : 0

  return (
    <Panel title="发布状态" className="h-full">
      {loading && !stats ? (
        <div className="space-y-3">
          <Skeleton className="h-2.5 w-full rounded-full" />
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-2/3" />
          ))}
        </div>
      ) : (
        <div className="space-y-5">
          <div className="bg-muted flex h-2.5 overflow-hidden rounded-full">
            {segments.map((seg) => (
              <motion.div
                key={seg.key}
                className={cn('h-full first:rounded-l-full last:rounded-r-full', seg.className)}
                initial={{ width: 0 }}
                animate={{ width: total > 0 ? `${(seg.value / total) * 100}%` : 0 }}
                transition={{ duration: 0.7, ease: EASE_OUT }}
              />
            ))}
          </div>
          <ul className="space-y-2">
            {segments.map((seg) => (
              <li key={seg.key} className="flex items-center justify-between text-[13px]">
                <span className="flex items-center gap-2">
                  <span className={cn('size-2 rounded-full', seg.className)} />
                  {seg.label}
                </span>
                <span className="tabular-nums">
                  {seg.value}
                  <span className="text-muted-foreground ml-1 text-xs">
                    ({total > 0 ? Math.round((seg.value / total) * 100) : 0}%)
                  </span>
                </span>
              </li>
            ))}
          </ul>
          <Separator />
          <div className="flex items-center justify-between text-[13px]">
            <span className="text-muted-foreground">启用率</span>
            <span className="tabular-nums">
              <span className="font-medium">{activePct}%</span>
              <span className="text-muted-foreground ml-1.5 text-xs">
                启用 {stats?.active_count || 0} · 停用 {stats ? stats.total - stats.active_count : 0}
              </span>
            </span>
          </div>
        </div>
      )}
    </Panel>
  )
}

// ─── 分步表单：信息确认 ───────────────────────────────────────────────────────

function SummaryCard({ values }) {
  const rows = [
    ['名称', values.name],
    ['编码', values.item_code],
    ['分类', CATEGORY_LABEL_MAP[values.category] || '-'],
    ['金额', `¥ ${values.amount ?? 0}`],
    ['数量', values.quantity ?? 0],
  ]
  return (
    <div className="bg-muted/40 rounded-lg border px-4 py-3">
      <div className="text-muted-foreground mb-2 text-xs">信息确认</div>
      <dl className="space-y-1.5 text-[13px]">
        {rows.map(([label, value]) => (
          <div key={label} className="grid grid-cols-[64px_minmax(0,1fr)] gap-2">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="truncate tabular-nums">{value === '' || value === null || value === undefined ? '-' : String(value)}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

// ─── 页面 ─────────────────────────────────────────────────────────────────────

export default function StatsListPage() {
  const list = useCrudList(
    (params) =>
      getStatsListPageList(params).catch((err) => {
        toast.apiError(err, '加载数据失败')
        return { items: [], total: 0 }
      }),
    { defaultPerPage: 20 },
  )
  const { data, total, loading, page, perPage, filters, fetchData, handlePageChange } = list

  const [stats, setStats] = useState(null)
  // 仅首屏无数据时显示骨架；刷新时保留旧数据，数字直接滚动到新值
  const [statsLoading, setStatsLoading] = useState(true)

  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [owner, setOwner] = useState('')
  const [isActive, setIsActive] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const [selectedKeys, setSelectedKeys] = useState([])
  const [editing, setEditing] = useState(null)
  const [formOpen, setFormOpen] = useState(false)
  const [step, setStep] = useState(0)
  const [detail, setDetail] = useState(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)

  const form = useForm({ defaultValues: EMPTY_VALUES, mode: 'onTouched' })

  const fetchStats = () => {
    getStatsListPageStats()
      .then((res) => setStats(res))
      .catch(() => {})
      .finally(() => setStatsLoading(false))
  }

  const reloadAll = () => {
    fetchStats()
    fetchData()
  }

  useEffect(() => {
    fetchStats()
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅首次加载
  }, [])

  const runSearch = () => {
    setSelectedKeys([])
    list.handleSearch({
      search: search.trim(),
      category: category || '',
      owner: owner.trim(),
      is_active: isActive || '',
      status: statusFilter || '',
    })
  }

  const reset = () => {
    setSearch('')
    setCategory('')
    setOwner('')
    setIsActive('')
    setStatusFilter('')
    setSelectedKeys([])
    list.handleReset()
  }

  const openCreate = () => {
    setEditing(null)
    setStep(0)
    form.reset(toFormValues(null))
    setFormOpen(true)
  }

  const openEdit = (record) => {
    setEditing(record)
    setStep(0)
    form.reset(toFormValues(record))
    setFormOpen(true)
  }

  const openDetail = (record) => {
    setDetail(record)
    setDetailOpen(true)
  }

  const submit = async (values) => {
    try {
      if (editing?.id) await updateStatsListPage(editing.id, values)
      else await createStatsListPage(values)
      toast.success(editing?.id ? '更新成功' : '创建成功')
      setFormOpen(false)
      reloadAll()
    } catch (err) {
      toast.apiError(err, '保存失败')
      throw err
    }
  }

  const remove = async (record) => {
    try {
      await deleteStatsListPage(record.id)
      toast.success('删除成功')
      setSelectedKeys((keys) => keys.filter((k) => k !== record.id))
      reloadAll()
    } catch (err) {
      toast.apiError(err, '删除失败')
      throw err
    }
  }

  const handleExport = async ({ fields, fileType }) => {
    const type = normalizeFileType(fileType)
    const hasSelected = selectedKeys.length > 0
    const payload = { fields, file_type: type, export_mode: hasSelected ? 'selected' : 'filtered' }
    if (hasSelected) payload.ids = selectedKeys
    else payload.filters = filters
    try {
      const blob = await exportStatsListPage(payload)
      downloadBlobFile(blob, `stats_list_page_export.${type}`)
      toast.success('导出成功')
      setExportOpen(false)
    } catch (err) {
      toast.apiError(err, '导出失败')
    }
  }

  const columns = [
    { key: 'id', title: 'ID', dataIndex: 'id', width: 64, className: 'text-muted-foreground tabular-nums' },
    { key: 'name', title: '名称', dataIndex: 'name', minWidth: 140, render: (v) => <span className="font-medium">{v}</span> },
    {
      key: 'item_code',
      title: '编码',
      dataIndex: 'item_code',
      width: 150,
      render: (v) => (v ? <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-xs whitespace-nowrap">{v}</code> : null),
    },
    { key: 'category', title: '分类', dataIndex: 'category', width: 80, render: (v) => CATEGORY_LABEL_MAP[v] || v || '-' },
    {
      key: 'status',
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: (v) => {
        const m = statusMeta(v)
        return (
          <StatusBadge tone={m.tone} dot>
            {m.label}
          </StatusBadge>
        )
      },
    },
    { key: 'amount', title: '金额', dataIndex: 'amount', width: 130, align: 'right', className: 'tabular-nums', render: formatAmount },
    {
      key: 'quantity',
      title: '数量',
      dataIndex: 'quantity',
      width: 80,
      align: 'right',
      className: 'tabular-nums',
      render: (v) => (v ?? 0).toLocaleString(),
    },
    { key: 'owner', title: '负责人', dataIndex: 'owner', width: 100, render: (v) => v || '-' },
    {
      key: 'is_active',
      title: '启用',
      dataIndex: 'is_active',
      width: 76,
      render: (v) => (
        <StatusBadge tone={v ? 'success' : 'neutral'} variant="plain">
          {v ? '启用' : '停用'}
        </StatusBadge>
      ),
    },
    {
      key: 'updated_at',
      title: '更新时间',
      dataIndex: 'updated_at',
      width: 160,
      className: 'text-muted-foreground tabular-nums',
      render: (v) => formatDateTime(v),
    },
    {
      key: 'actions',
      title: '',
      align: 'right',
      width: 160,
      render: (_, record) => (
        <div className="flex justify-end gap-0.5">
          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => openDetail(record)}>
            查看
          </Button>
          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => openEdit(record)}>
            编辑
          </Button>
          <ConfirmAction title="确认删除该记录？" description="删除后不可恢复" confirmText="删除" onConfirm={() => remove(record)}>
            <Button variant="ghost" size="sm" className="text-danger hover:text-danger h-7 px-2">
              删除
            </Button>
          </ConfirmAction>
        </div>
      ),
    },
  ]

  const hasFilters = Object.values(filters).some((v) => v !== '' && v !== undefined)

  return (
    <div className="space-y-5">
      <PageHeader
        title="统计列表页"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
              <Upload />
              导入
            </Button>
            <Button variant="outline" size="sm" onClick={() => setExportOpen(true)}>
              <Download />
              导出
            </Button>
            <Button size="sm" variant="brand" onClick={openCreate}>
              <Plus />
              新建记录
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          loading={statsLoading && !stats}
          label="总记录数"
          icon={Layers}
          value={stats?.total ?? 0}
          suffix="条"
          delta={`已启用 ${stats?.active_count ?? 0}`}
          deltaTone="neutral"
        />
        <StatCard
          loading={statsLoading && !stats}
          label="已发布"
          icon={CircleCheck}
          value={stats?.published_count ?? 0}
          suffix="条"
          delta={`草稿 ${stats?.draft_count ?? 0}`}
          deltaTone="neutral"
        />
        <StatCard
          loading={statsLoading && !stats}
          label="已归档"
          icon={Archive}
          value={stats?.archived_count ?? 0}
          suffix="条"
          delta={`已停用 ${stats ? stats.total - stats.active_count : 0}`}
          deltaTone="neutral"
        />
        <StatCard
          loading={statsLoading && !stats}
          label="总金额"
          icon={Wallet}
          value={stats?.total_amount ?? 0}
          decimals={2}
          suffix="元"
          delta={`均值 ${money(stats?.avg_amount)}`}
          deltaTone="neutral"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <CategoryDistribution stats={stats} loading={statsLoading} />
        </div>
        <div className="lg:col-span-2">
          <StatusDistribution stats={stats} loading={statsLoading} />
        </div>
      </div>

      <div>
        <FilterBar onSearch={runSearch} onReset={reset}>
          <SearchInput value={search} onChange={setSearch} onSubmit={runSearch} placeholder="名称 / 编码 / 负责人" />
          <FilterSelect value={category} onChange={setCategory} options={CATEGORY_OPTIONS} placeholder="分类" allLabel="全部分类" className="w-32" />
          <Input
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') runSearch()
            }}
            placeholder="负责人"
            className="h-8 w-32 text-[13px]"
          />
          <FilterSelect value={isActive} onChange={setIsActive} options={ACTIVE_OPTIONS} placeholder="启用状态" allLabel="全部启用状态" />
          <FilterSelect value={statusFilter} onChange={setStatusFilter} options={STATUS_OPTIONS} placeholder="状态" allLabel="全部状态" className="w-32" />
        </FilterBar>

        <AnimatePresence>
          {selectedKeys.length > 0 ? (
            <motion.div
              initial={{ opacity: 0, y: -6, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: -6, height: 0 }}
              className="overflow-hidden"
            >
              <div className="bg-brand-soft mb-3 flex items-center gap-3 rounded-lg px-3 py-2 text-[13px]">
                <span>
                  已勾选 <span className="font-medium tabular-nums">{selectedKeys.length}</span> 条，导出时将优先导出勾选数据
                </span>
                <Button variant="ghost" size="sm" className="ml-auto h-7" onClick={() => setSelectedKeys([])}>
                  <X />
                  清空勾选
                </Button>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <DataTable
          columns={columns}
          data={data}
          loading={loading}
          selectable
          selectedKeys={selectedKeys}
          onSelectionChange={setSelectedKeys}
          pagination={{ page, perPage, total, onChange: handlePageChange }}
          minWidth={1180}
          emptyTitle="暂无记录"
          emptyDescription={hasFilters ? '换个筛选条件试试' : '点击右上角「新建记录」添加第一条数据'}
        />
      </div>

      <StepFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        title={editing?.id ? '编辑记录' : '新建记录'}
        description={editing?.id ? `正在编辑 ${editing.name}` : undefined}
        form={form}
        steps={STEPS}
        step={step}
        onStepChange={setStep}
        onSubmit={submit}
        submitText={editing?.id ? '保存' : '提交'}
        renderStep={(index, values) => {
          if (index === 0) {
            return (
              <FormGrid>
                <FormInput control={form.control} name="name" label="名称" rules={{ required: '请输入名称' }} />
                <FormInput
                  control={form.control}
                  name="item_code"
                  label="编码"
                  placeholder="例如：item_001"
                  rules={{ required: '请输入编码' }}
                  disabled={Boolean(editing?.id)}
                />
                <FormSelect control={form.control} name="category" label="分类" options={CATEGORY_OPTIONS} />
                <FormInput control={form.control} name="owner" label="负责人" placeholder="例如：admin" />
              </FormGrid>
            )
          }
          if (index === 1) {
            return (
              <FormGrid>
                <FormNumber
                  control={form.control}
                  name="amount"
                  label="金额"
                  min={0}
                  step={0.01}
                  rules={{ min: { value: 0, message: '金额不能小于 0' } }}
                />
                <FormNumber
                  control={form.control}
                  name="quantity"
                  label="数量"
                  min={0}
                  step={1}
                  rules={{ min: { value: 0, message: '数量不能小于 0' } }}
                />
                <FormNumber
                  control={form.control}
                  name="priority"
                  label="优先级"
                  min={0}
                  max={9999}
                  step={1}
                  rules={{
                    min: { value: 0, message: '优先级范围 0–9999' },
                    max: { value: 9999, message: '优先级范围 0–9999' },
                  }}
                />
                <FormSwitch control={form.control} name="is_active" label="启用" className="self-end" />
              </FormGrid>
            )
          }
          return (
            <div className="space-y-4">
              <FormSelect control={form.control} name="status" label="发布状态" options={STATUS_OPTIONS} />
              <FormTextarea
                control={form.control}
                name="description"
                label="描述"
                rows={4}
                inputClassName="min-h-24"
                rules={{ maxLength: { value: 300, message: '描述最多 300 字' } }}
                description={`${(values.description || '').length} / 300`}
              />
              <SummaryCard values={values} />
            </div>
          )
        }}
      />

      <DetailSheet
        open={detailOpen}
        onOpenChange={setDetailOpen}
        title="记录详情"
        description={detail?.name}
        footer={
          <>
            <Button variant="outline" onClick={() => setDetailOpen(false)}>
              关闭
            </Button>
            <Button
              onClick={() => {
                setDetailOpen(false)
                openEdit(detail)
              }}
            >
              编辑
            </Button>
          </>
        }
      >
        {detail ? (
          <div className="space-y-5">
            <DescriptionList
              items={[
                { label: 'ID', value: <span className="tabular-nums">{detail.id}</span> },
                { label: '名称', value: detail.name },
                { label: '编码', value: <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-xs whitespace-nowrap">{detail.item_code}</code> },
                { label: '分类', value: CATEGORY_LABEL_MAP[detail.category] || detail.category || '-' },
                {
                  label: '发布状态',
                  value: (
                    <StatusBadge tone={statusMeta(detail.status).tone} dot>
                      {statusMeta(detail.status).label}
                    </StatusBadge>
                  ),
                },
                { label: '金额', value: <span className="tabular-nums">{formatAmount(detail.amount)}</span> },
                { label: '数量', value: <span className="tabular-nums">{(detail.quantity ?? 0).toLocaleString()}</span> },
                { label: '负责人', value: detail.owner || '-' },
                { label: '优先级', value: <span className="tabular-nums">{detail.priority ?? 0}</span> },
                {
                  label: '启用',
                  value: (
                    <StatusBadge tone={detail.is_active ? 'success' : 'neutral'} dot>
                      {detail.is_active ? '启用' : '停用'}
                    </StatusBadge>
                  ),
                },
                { label: '创建时间', value: <span className="tabular-nums">{formatDateTime(detail.created_at)}</span> },
                { label: '更新时间', value: <span className="tabular-nums">{formatDateTime(detail.updated_at)}</span> },
              ]}
            />
            {detail.description ? (
              <>
                <Separator />
                <div className="space-y-1.5">
                  <div className="text-[13px] font-medium">描述</div>
                  <p className="text-muted-foreground text-[13px] leading-relaxed whitespace-pre-wrap">{detail.description}</p>
                </div>
              </>
            ) : null}
          </div>
        ) : null}
      </DetailSheet>

      <ExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        title="统计列表页导出字段"
        ruleHint={
          selectedKeys.length > 0 ? `已勾选 ${selectedKeys.length} 条，将优先导出勾选数据` : '未勾选数据时，将按当前筛选条件导出'
        }
        fieldOptions={EXPORT_FIELDS}
        defaultFields={['name', 'item_code', 'category', 'status', 'amount', 'quantity', 'owner', 'updated_at']}
        onConfirm={handleExport}
      />

      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        title="导入统计列表页数据"
        targetLabel="统计列表页"
        onDownloadTemplate={(fileType) =>
          downloadStatsListPageTemplate(normalizeFileType(fileType))
            .then((blob) => {
              downloadBlobFile(blob, `stats_list_page_import_template.${normalizeFileType(fileType)}`)
              toast.success('模板下载成功')
            })
            .catch((err) => toast.apiError(err, '模板下载失败'))
        }
        onImport={(file) => importStatsListPage(file)}
        onImported={(res) => {
          toast.success(`导入成功：新增 ${res?.created || 0} 条，更新 ${res?.updated || 0} 条`)
          reloadAll()
        }}
        errorExportFileName="stats_list_page_import_error_rows.csv"
      />
    </div>
  )
}
