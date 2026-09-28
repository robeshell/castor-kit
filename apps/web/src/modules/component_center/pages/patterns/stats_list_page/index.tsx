/**
 * Page patterns → Stats list: the reference implementation of a list with a statistics header, on the shared demo API
 * (/api/admin/component-center/demo-records, see modules/component-center/demo-record in apps/api).
 *
 * Use it when a list needs its totals and distributions on top (orders with revenue, tickets by status …). The key
 * point: the stats and the table read the SAME filters. The FilterBar sits above both; searching applies the filters to
 * the list (useCrudList) and to GET …/stats, and every write (create / edit / delete) reloads both.
 *
 * What to copy:
 *   - one typed filter state (`Filters`, narrowed from FilterSelect's strings with `pick`) passed to both requests
 *   - StatCard row (loading skeleton only until the first response, then numbers roll to new values)
 *   - a donut chart (ECharts, colors from useChartColors) with a hover-linked legend, and a stacked status bar
 *   - the table below: StatusBadge for status / enabled (tones from the shared ../demo-record-options), FormDialog
 *     for create / edit, ConfirmAction for delete, buttons gated by the cc_patterns_* permissions
 *
 * The standard list (patterns/demo_record_page) shows import / export; this page leaves them out to stay on the pattern.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import type { DefaultLabelFormatterCallbackParams, EChartsOption } from 'echarts'
import type EChartsReactCore from 'echarts-for-react/lib/core'
import { useForm } from 'react-hook-form'
import { motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { CircleCheck, Layers, Package, Plus, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/context/AuthContext'
import { chartBase, useChartColors } from '@/lib/chart-theme'
import { formatDateTime, formatNumber } from '@/lib/format'
import { EASE_OUT } from '@/lib/motion'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import {
  createItem,
  deleteItem,
  getItems,
  getStats,
  updateItem,
  type DemoRecord as Row,
  type DemoRecordQuery,
  type DemoRecordStats,
} from '@/modules/component_center/api/demo_record'
import {
  CATEGORY_OPTIONS,
  categoryLabel,
  enabledOption,
  ENABLED_OPTIONS,
  STATUS_OPTIONS,
  statusLabel,
  statusTone,
  type DemoCategory as Category,
  type DemoStatus as Status,
} from '@/modules/component_center/pages/patterns/demo-record-options'
import ReactECharts from '@/shared/components/Chart'
import ConfirmAction from '@/shared/components/ConfirmAction'
import DataTable, { type DataTableColumn } from '@/shared/components/DataTable'
import { FilterBar, FilterSelect, SearchInput } from '@/shared/components/Filters'
import { FormDialog } from '@/shared/components/FormDialog'
import { FormGrid, FormInput, FormNumber, FormSelect, FormSwitch, FormTextarea } from '@/shared/components/FormFields'
import PageHeader from '@/shared/components/PageHeader'
import Panel from '@/shared/components/Panel'
import StatCard, { CountUp } from '@/shared/components/StatCard'
import StatusBadge from '@/shared/components/StatusBadge'
import { useCrudList } from '@/shared/hooks/useCrudList'

/** Fill of each status in the stacked status bar (the badge tones come from the shared options) */
const STATUS_FILL: Record<Status, string> = { todo: 'bg-warning', in_progress: 'bg-info', done: 'bg-success', archived: 'bg-muted-foreground/40' }

/** A FilterSelect value ('' = all) narrowed to one of the options */
const pick = <V extends string>(options: readonly { value: V }[], raw: string): V | '' => options.find((o) => o.value === raw)?.value ?? ''

/** The filters the list and the stats share (the stats endpoint takes the list's filters, without paging / sorting) */
type Filters = Pick<DemoRecordQuery, 'search' | 'category' | 'status' | 'is_active'>

/** What the form holds and submits (a subset of the create / edit body) */
interface FormValues {
  name: string
  code: string
  category: Category | null
  status: Status | null
  owner: string
  amount: number | string | null
  quantity: number | null
  is_active: boolean
  description: string
}

const EMPTY_VALUES: FormValues = {
  name: '',
  code: '',
  category: null,
  status: 'todo',
  owner: '',
  amount: null,
  quantity: null,
  is_active: true,
  description: '',
}

const toFormValues = (record: Row): FormValues => ({
  name: record.name ?? '',
  code: record.code ?? '',
  category: record.category,
  status: record.status,
  owner: record.owner ?? '',
  amount: record.amount,
  quantity: record.quantity,
  is_active: Boolean(record.is_active),
  description: record.description ?? '',
})

const percent = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 100) : 0)

// ─── Category distribution (donut + legend) ─────────────────────────────────────

interface StatsPanelProps {
  stats: DemoRecordStats | null
}

function CategoryDistribution({ stats }: StatsPanelProps) {
  const { t } = useTranslation()
  const c = useChartColors()
  const chartRef = useRef<EChartsReactCore | null>(null)
  const total = stats?.total ?? 0
  // Every category is listed (0 when empty); the trailing "uncategorized" bucket only when it has records
  const items = useMemo(() => {
    const palette = chartBase(c).color
    return (stats?.by_category ?? [])
      .filter((item) => item.category !== null || item.count > 0)
      .map((item, index) => ({
        key: item.category ?? 'none',
        name: t(categoryLabel(item.category) ?? '未分类'),
        count: item.count,
        color: item.category === null ? c.border : palette[index % palette.length],
      }))
  }, [c, stats, t])

  const option = useMemo((): EChartsOption => {
    const base = chartBase(c)
    return {
      textStyle: base.textStyle,
      tooltip: {
        ...base.tooltip,
        trigger: 'item',
        // trigger 'item' always passes one data item; the array form belongs to trigger 'axis'
        formatter: (params) => {
          if (Array.isArray(params)) return ''
          const p: DefaultLabelFormatterCallbackParams = params
          return `${p.marker}${p.name}<br/><span style="font-variant-numeric:tabular-nums">${t('{{count}} 条 · {{percent}}%', { count: p.value, percent: p.percent })}</span>`
        },
      },
      series: [
        {
          type: 'pie',
          radius: ['64%', '88%'],
          padAngle: 2,
          itemStyle: { borderRadius: 4, borderColor: c.card, borderWidth: 2 },
          label: { show: false },
          emphasis: { scale: true, scaleSize: 4 },
          data: items.map((item) => ({ name: item.name, value: item.count, itemStyle: { color: item.color } })),
        },
      ],
    }
  }, [c, items, t])

  // Text alternative for screen readers: the total and the largest category with its share
  const largest = items.reduce<(typeof items)[number] | undefined>((a, b) => (a === undefined || b.count > a.count ? b : a), undefined)
  const summary = largest
    ? t('分类分布环形图，共 {{total}} 条记录，最多的是{{name}}，{{records}} 条，占 {{percent}}%', {
        total: formatNumber(total),
        name: largest.name,
        records: formatNumber(largest.count),
        percent: percent(largest.count, total),
      })
    : t('没有符合条件的记录')

  const highlight = (index: number, on: boolean) => {
    chartRef.current?.getEchartsInstance().dispatchAction({ type: on ? 'highlight' : 'downplay', seriesIndex: 0, dataIndex: index })
  }

  return (
    <Panel title="分类分布" className="h-full">
      {!stats ? (
        <div className="flex items-center gap-6">
          <Skeleton className="size-40 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2.5">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </div>
        </div>
      ) : total === 0 ? (
        <div className="text-muted-foreground flex h-40 items-center justify-center text-[13px]">{t('没有符合条件的记录')}</div>
      ) : (
        <div className="flex flex-col items-center gap-5 sm:flex-row">
          <div className="relative size-40 shrink-0">
            <ReactECharts ref={chartRef} option={option} summary={summary} patterns style={{ height: 160, width: 160 }} notMerge opts={{ renderer: 'svg' }} />
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <CountUp value={total} className="text-xl leading-none font-semibold" />
              <span className="text-muted-foreground mt-1 text-[11px]">{t('条记录')}</span>
            </div>
          </div>
          <ul className="w-full min-w-0 flex-1 space-y-0.5">
            {items.map((item, index) => (
              <li
                key={item.key}
                onMouseEnter={() => highlight(index, true)}
                onMouseLeave={() => highlight(index, false)}
                className="hover:bg-muted/60 flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-[13px] transition-colors"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="truncate">{item.name}</span>
                </span>
                <span className="tabular-nums">
                  {item.count}
                  <span className="text-muted-foreground ml-1 text-xs">({percent(item.count, total)}%)</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  )
}

// ─── Status distribution (stacked bar) ──────────────────────────────────────────

function StatusDistribution({ stats }: StatsPanelProps) {
  const { t } = useTranslation()
  const total = stats?.total ?? 0
  return (
    <Panel title="状态分布" className="h-full">
      {!stats ? (
        <div className="space-y-3">
          <Skeleton className="h-2.5 w-full rounded-full" />
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-4 w-2/3" />
          ))}
        </div>
      ) : (
        <div className="space-y-5">
          <div className="bg-muted flex h-2.5 overflow-hidden rounded-full">
            {stats.by_status.map((item) => (
              <motion.div
                key={item.status}
                className={cn('h-full', STATUS_FILL[item.status])}
                initial={{ width: 0 }}
                animate={{ width: `${total > 0 ? (item.count / total) * 100 : 0}%` }}
                transition={{ duration: 0.7, ease: EASE_OUT }}
              />
            ))}
          </div>
          <ul className="space-y-2">
            {stats.by_status.map((item) => (
              <li key={item.status} className="flex items-center justify-between text-[13px]">
                <span className="flex items-center gap-2">
                  <span className={cn('size-2 rounded-full', STATUS_FILL[item.status])} />
                  {t(statusLabel(item.status))}
                </span>
                <span className="tabular-nums">
                  {item.count}
                  <span className="text-muted-foreground ml-1 text-xs">({percent(item.count, total)}%)</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  )
}

// ─── Page ───────────────────────────────────────────────────────────────────────

export default function StatsListPage() {
  const { t, i18n } = useTranslation()
  const { hasPermission } = useAuth()
  const canAdd = hasPermission('cc_patterns_add')
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
  const { data, total, loading, page, perPage, fetchData, handlePageChange } = list
  // null until the first response: the stat cards and charts show skeletons only then, later loads keep the old numbers
  const [stats, setStats] = useState<DemoRecordStats | null>(null)

  // Filter inputs, and the filters last applied (what the list and the stats currently show)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<Category | ''>('')
  const [status, setStatus] = useState<Status | ''>('')
  const [isActive, setIsActive] = useState<'true' | 'false' | ''>('')
  const [applied, setApplied] = useState<Filters>({})

  const [editing, setEditing] = useState<Row | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const form = useForm<FormValues>({ defaultValues: EMPTY_VALUES })

  const fetchStats = (filters: Filters) =>
    getStats(filters)
      .then(setStats)
      .catch((err: unknown) => toast.apiError(err, '统计加载失败'))

  useEffect(() => {
    fetchData()
    fetchStats({})
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once on mount
  }, [])

  const applyFilters = (filters: Filters) => {
    setApplied(filters)
    list.handleSearch(filters)
    fetchStats(filters)
  }
  const runSearch = () => applyFilters({ search: search.trim(), category, status, is_active: isActive })
  const reset = () => {
    setSearch('')
    setCategory('')
    setStatus('')
    setIsActive('')
    applyFilters({})
  }
  /** After a write: the current page of the list and the stats, with the applied filters */
  const reload = () => {
    fetchData()
    fetchStats(applied)
  }

  const openCreate = () => {
    setEditing(null)
    form.reset(EMPTY_VALUES)
    setFormOpen(true)
  }

  const openEdit = (record: Row) => {
    setEditing(record)
    form.reset(toFormValues(record))
    setFormOpen(true)
  }

  const submit = async (values: FormValues) => {
    try {
      if (editing) {
        await updateItem(editing.id, values)
        toast.success('更新成功')
      } else {
        await createItem(values)
        toast.success('创建成功')
      }
      setFormOpen(false)
      reload()
    } catch (err) {
      toast.apiError(err, '操作失败')
      throw err
    }
  }

  const remove = async (record: Row) => {
    try {
      await deleteItem(record.id)
      toast.success('删除成功')
      reload()
    } catch (err) {
      toast.apiError(err, '删除失败')
      throw err
    }
  }

  const amountFormat = new Intl.NumberFormat(i18n.language, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const doneCount = stats?.by_status.find((s) => s.status === 'done')?.count ?? 0
  const hasFilters = Object.values(applied).some(Boolean)

  const columns: DataTableColumn<Row>[] = [
    { key: 'id', title: 'ID', dataIndex: 'id', width: 64, className: 'text-muted-foreground tabular-nums' },
    { key: 'name', title: '名称', dataIndex: 'name', minWidth: 140, render: (value) => <span className="font-medium">{value}</span> },
    {
      key: 'code',
      title: '编码',
      dataIndex: 'code',
      width: 140,
      render: (value) => (value ? <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-xs whitespace-nowrap">{value}</code> : null),
    },
    { key: 'category', title: '分类', dataIndex: 'category', width: 90, render: (value) => t(categoryLabel(value) ?? '未分类') },
    {
      key: 'status',
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (value) =>
        value ? (
          <StatusBadge tone={statusTone(value)} dot>
            {statusLabel(value)}
          </StatusBadge>
        ) : null,
    },
    { key: 'owner', title: '负责人', dataIndex: 'owner', width: 100 },
    {
      key: 'amount',
      title: '金额',
      dataIndex: 'amount',
      width: 130,
      align: 'right',
      className: 'tabular-nums',
      render: (value) => (value === null ? '-' : amountFormat.format(Number(value))),
    },
    { key: 'quantity', title: '数量', dataIndex: 'quantity', width: 90, align: 'right', className: 'tabular-nums', render: (value) => formatNumber(value) },
    {
      key: 'is_active',
      title: '是否启用',
      dataIndex: 'is_active',
      width: 96,
      render: (value) => {
        const option = enabledOption(Boolean(value))
        return (
          <StatusBadge tone={option.tone} variant="plain">
            {option.label}
          </StatusBadge>
        )
      },
    },
    {
      key: 'updated_at',
      title: '更新时间',
      dataIndex: 'updated_at',
      width: 170,
      className: 'text-muted-foreground tabular-nums',
      render: (value) => formatDateTime(value),
    },
    {
      key: 'actions',
      title: '',
      align: 'right',
      width: 120,
      render: (_, record) => (
        <div className="flex justify-end gap-0.5">
          {canEdit ? (
            <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => openEdit(record)}>
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

  return (
    <div className="space-y-5">
      <PageHeader
        title="统计列表"
        description="统计卡片、图表与下方列表使用同一组筛选条件"
        actions={
          canAdd ? (
            <Button size="sm" variant="brand" onClick={openCreate}>
              <Plus />
              {t('新增')}
            </Button>
          ) : null
        }
      />

      <FilterBar onSearch={runSearch} onReset={reset}>
        <SearchInput value={search} onChange={setSearch} onSubmit={runSearch} placeholder="名称 / 编码" />
        <FilterSelect value={category} onChange={(v) => setCategory(pick(CATEGORY_OPTIONS, v))} options={CATEGORY_OPTIONS} placeholder="分类" />
        <FilterSelect value={status} onChange={(v) => setStatus(pick(STATUS_OPTIONS, v))} options={STATUS_OPTIONS} placeholder="状态" />
        <FilterSelect value={isActive} onChange={(v) => setIsActive(pick(ENABLED_OPTIONS, v))} options={ENABLED_OPTIONS} placeholder="是否启用" />
      </FilterBar>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard loading={!stats} label="记录数" icon={Layers} value={stats?.total} suffix="条" />
        <StatCard loading={!stats} label="金额合计" icon={Wallet} value={stats?.amount_sum} decimals={2} />
        <StatCard loading={!stats} label="数量合计" icon={Package} value={stats?.quantity_sum} />
        <StatCard
          loading={!stats}
          label="完成率"
          icon={CircleCheck}
          value={percent(doneCount, stats?.total ?? 0)}
          suffix="%"
          hint={t('已完成 {{count}} 条', { count: doneCount })}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <CategoryDistribution stats={stats} />
        </div>
        <div className="lg:col-span-2">
          <StatusDistribution stats={stats} />
        </div>
      </div>

      <DataTable
        columns={columns}
        data={data}
        loading={loading}
        pagination={{ page, perPage, total, onChange: handlePageChange }}
        minWidth={1080}
        emptyTitle="暂无数据"
        emptyDescription={hasFilters ? '换个筛选条件试试' : canAdd ? '点击右上角「新增」添加第一条数据' : undefined}
      />

      <FormDialog open={formOpen} onOpenChange={setFormOpen} title={editing ? '编辑' : '新增'} form={form} onSubmit={submit}>
        <FormGrid>
          <FormInput control={form.control} name="name" label="名称" rules={{ required: '请输入名称' }} />
          <FormInput control={form.control} name="code" label="编码" rules={{ required: '请输入编码' }} />
          <FormSelect control={form.control} name="category" label="分类" options={CATEGORY_OPTIONS} clearable />
          <FormSelect control={form.control} name="status" label="状态" options={STATUS_OPTIONS} />
          <FormNumber control={form.control} name="amount" label="金额" min={0} step={0.01} />
          <FormNumber control={form.control} name="quantity" label="数量" min={0} step={1} />
          <FormInput control={form.control} name="owner" label="负责人" />
          <FormSwitch control={form.control} name="is_active" label="是否启用" className="self-end" />
        </FormGrid>
        <FormTextarea control={form.control} name="description" label="描述" rows={3} />
      </FormDialog>
    </div>
  )
}
