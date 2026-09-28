/**
 * Page patterns → Gantt: the reference implementation of the gantt / schedule pattern, on the shared demo API
 * (/api/admin/component-center/demo-records, see modules/component-center/demo-record in apps/api).
 *
 * Use it when records have a date range and progress and people plan them on a timeline (projects, releases,
 * campaigns). What to copy:
 * - Loading: one list request (up to 200 records, the list's page cap — the pattern fits a bounded plan; a larger one
 *   would filter by date first with start_from / start_to). The rows are ordered as a work breakdown: the parent_id
 *   hierarchy, siblings by (sort_order, id), flattened depth-first; a parent row can be collapsed.
 * - Timeline: dates are counted as UTC day numbers (no time zone / DST drift); the range spans every record's dates
 *   (plus today when it is near), drawn at a day or week scale with month headers, weekend shading and a today line.
 * - Bars: a parent is a thin summary bar over its own dates, a leaf a bar filled to its progress, colored by status.
 *   A record with only a start date is a one-day bar; one without a start date stays in its row, marked as having no dates,
 *   and the panel counts them.
 * - Editing: clicking a bar or a row's edit button opens the FormDialog for name / parent / owner / status / dates /
 *   progress (the start ≤ end rule mirrors the API's); create and delete as on any list page. Buttons follow the
 *   cc_patterns_add / _edit / _delete permissions.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import { useForm } from 'react-hook-form'
import { MotionConfig, motion } from 'motion/react'
import { CalendarRange, ChevronRight, Pencil, Plus, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useAuth } from '@/context/AuthContext'
import { formatDate } from '@/lib/format'
import { EASE_OUT } from '@/lib/motion'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { createItem, deleteItem, getItems, updateItem, type DemoRecord as Row } from '@/modules/component_center/api/demo_record'
import {
  STATUS_OPTIONS,
  STATUSES,
  statusLabel,
  statusTone,
  type DemoStatus as Status,
} from '@/modules/component_center/pages/patterns/demo-record-options'
import ConfirmAction from '@/shared/components/ConfirmAction'
import EmptyState from '@/shared/components/EmptyState'
import { FormDialog } from '@/shared/components/FormDialog'
import { FormDate, FormGrid, FormInput, FormNumber, FormSelect, FormTreeSelect } from '@/shared/components/FormFields'
import PageHeader from '@/shared/components/PageHeader'
import Panel from '@/shared/components/Panel'
import SegmentedTabs from '@/shared/components/SegmentedTabs'
import StatusBadge from '@/shared/components/StatusBadge'
import type { TreeSelectNode } from '@/shared/components/TreeSelect'

/**
 * Status → bar track and progress fill, in the same colors as the status badge tones in the shared options
 * (solid: the percentage sits on the fill in the status's foreground color, e.g. text-info-foreground on bg-info).
 */
const STATUS_BAR: Record<Status, { track: string; fill: string; solid: string | null }> = {
  todo: { track: 'bg-warning-soft', fill: 'bg-warning/60', solid: null },
  in_progress: { track: 'bg-info-soft', fill: 'bg-info', solid: 'text-info-foreground' },
  done: { track: 'bg-success-soft', fill: 'bg-success', solid: 'text-success-foreground' },
  archived: { track: 'bg-muted', fill: 'bg-muted-foreground/30', solid: null },
}
/** status is NOT NULL in the database (default todo); the API type is nullable because every field is */
const statusOf = (record: Row): Status => record.status ?? 'todo'

type Scale = 'day' | 'week'
const SCALES: { value: Scale; label: string }[] = [
  { value: 'day', label: '日' },
  { value: 'week', label: '周' },
]
/** Pixels per day at each scale */
const SCALE_PX: Record<Scale, number> = { day: 32, week: 14 }
const ROW_H = 44
/** Most records the page loads (the list endpoint's page cap) */
const MAX_RECORDS = 200

// ── Hierarchy ─────────────────────────────────────────────────────
/** Sibling order: sort_order, then id (the API's tree order) */
const bySiblingOrder = (a: Row, b: Row) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.id - b.id

/** Children of each parent id (null = top level), in sibling order; a record whose parent isn't loaded is top level */
function childrenByParent(records: Row[]): Map<number | null, Row[]> {
  const ids = new Set(records.map((r) => r.id))
  const map = new Map<number | null, Row[]>()
  for (const record of records) {
    const key = record.parent_id !== null && ids.has(record.parent_id) ? record.parent_id : null
    map.set(key, [...(map.get(key) ?? []), record])
  }
  for (const list of map.values()) list.sort(bySiblingOrder)
  return map
}

/** A visible row: the record, its depth in the hierarchy and whether it has children */
interface GanttRow {
  record: Row
  depth: number
  hasChildren: boolean
}

/** The rows depth-first; the children of a collapsed record are left out */
function flattenRows(children: Map<number | null, Row[]>, collapsed: Set<number>, parent: number | null = null, depth = 0): GanttRow[] {
  return (children.get(parent) ?? []).flatMap((record) => {
    const hasChildren = (children.get(record.id)?.length ?? 0) > 0
    const row: GanttRow = { record, depth, hasChildren }
    return hasChildren && !collapsed.has(record.id) ? [row, ...flattenRows(children, collapsed, record.id, depth + 1)] : [row]
  })
}

/** The hierarchy as TreeSelect nodes (the parent picker) */
function toTree(children: Map<number | null, Row[]>, parent: number | null = null): TreeSelectNode<number>[] {
  return (children.get(parent) ?? []).map((r) => ({ id: r.id, name: r.name ?? '', code: r.code, children: toTree(children, r.id) }))
}

/** sort_order that puts a record after its last sibling */
function nextSortOrder(children: Map<number | null, Row[]>, parent: number | null) {
  return Math.max(-1, ...(children.get(parent) ?? []).map((r) => r.sort_order ?? 0)) + 1
}

// ── Dates (UTC day numbers: no time zone / DST errors) ────────────
const DAY_MS = 86400000
function toDay(value: string | null) {
  if (!value) return null
  const [y, m, d] = value.slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return null
  return Math.floor(Date.UTC(y, m - 1, d) / DAY_MS)
}
const dayDate = (n: number) => new Date(n * DAY_MS)
const fmtDay = (n: number) => dayDate(n).toISOString().slice(0, 10)
function todayDay() {
  const d = new Date()
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY_MS)
}

/** Visible timeline in UTC day numbers */
interface TimelineRange {
  start: number
  end: number
  days: number
  today: number
  todayVisible: boolean
}

/** Earliest start ~ latest end with a few days of padding; includes today when it is within 60 days */
function buildRange(records: Row[]): TimelineRange | null {
  let min = Infinity
  let max = -Infinity
  for (const r of records) {
    const s = toDay(r.start_date)
    if (s === null) continue
    min = Math.min(min, s)
    max = Math.max(max, toDay(r.end_date) ?? s)
  }
  if (!Number.isFinite(min)) return null
  const today = todayDay()
  if (today >= min - 60 && today <= max + 60) {
    min = Math.min(min, today)
    max = Math.max(max, today)
  }
  const start = min - 3
  const end = max + 4
  return { start, end, days: end - start + 1, today, todayVisible: today >= start && today <= end }
}

/** Month header spans */
function buildMonths(range: TimelineRange, lang: string) {
  const monthFormat = new Intl.DateTimeFormat(lang, { year: 'numeric', month: 'short', timeZone: 'UTC' })
  const months: { key: string; offset: number; days: number; label: string }[] = []
  for (let d = range.start; d <= range.end; d += 1) {
    const date = dayDate(d)
    const key = `${date.getUTCFullYear()}-${date.getUTCMonth()}`
    const last = months[months.length - 1]
    if (last && last.key === key) last.days += 1
    else months.push({ key, offset: d - range.start, days: 1, label: monthFormat.format(date) })
  }
  return months
}

/** Second header row: every day (day scale) or every Monday (week scale) */
function buildTicks(range: TimelineRange, scale: Scale) {
  const ticks: { offset: number; label: string; width: number }[] = []
  for (let d = range.start; d <= range.end; d += 1) {
    const date = dayDate(d)
    if (scale === 'day') ticks.push({ offset: d - range.start, label: String(date.getUTCDate()), width: 1 })
    else if (date.getUTCDay() === 1) ticks.push({ offset: d - range.start, label: `${date.getUTCMonth() + 1}/${date.getUTCDate()}`, width: 7 })
  }
  return ticks
}

function weekendOffsets(range: TimelineRange) {
  const offsets: number[] = []
  for (let d = range.start; d <= range.end; d += 1) {
    const weekday = dayDate(d).getUTCDay()
    if (weekday === 0 || weekday === 6) offsets.push(d - range.start)
  }
  return offsets
}

/** What the dialog holds and submits (a subset of the create / edit body) */
interface FormValues {
  name: string
  code: string
  parent_id: number | null
  owner: string
  status: Status
  start_date: string
  end_date: string
  progress: number | null
}

const EMPTY_VALUES: FormValues = {
  name: '',
  code: '',
  parent_id: null,
  owner: '',
  status: 'todo',
  start_date: '',
  end_date: '',
  progress: 0,
}

const toFormValues = (record: Row): FormValues => ({
  name: record.name ?? '',
  code: record.code ?? '',
  parent_id: record.parent_id,
  owner: record.owner ?? '',
  status: statusOf(record),
  start_date: formatDate(record.start_date, ''),
  end_date: formatDate(record.end_date, ''),
  progress: record.progress,
})

// ── Small components ──────────────────────────────────────────────
function ProgressCell({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="bg-muted h-1.5 flex-1 overflow-hidden rounded-full">
        <div className={cn('h-full rounded-full', value >= 100 ? 'bg-success' : 'bg-brand-gradient')} style={{ width: `${value}%` }} />
      </div>
      <span className="text-muted-foreground w-8 text-right text-xs tabular-nums">{value}%</span>
    </div>
  )
}

function BarTooltip({ record, children }: { record: Row; children: ReactElement }) {
  const { t } = useTranslation()
  const s = toDay(record.start_date)
  const e = toDay(record.end_date) ?? s
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="top" className="px-3 py-2">
        <div className="space-y-1">
          <p className="font-medium">{record.name}</p>
          <p className="tabular-nums opacity-75">
            {formatDate(record.start_date)} → {formatDate(record.end_date)}
            {s !== null && e !== null ? ` · ${t('{{count}} 天', { count: e - s + 1 })}` : ''}
          </p>
          <p className="opacity-75">
            {t(statusLabel(statusOf(record)))} · {t('进度 {{value}}%', { value: record.progress ?? 0 })}
            {record.owner ? ` · ${record.owner}` : ''}
          </p>
        </div>
      </TooltipContent>
    </Tooltip>
  )
}

interface TaskBarProps {
  row: GanttRow
  range: TimelineRange
  /** Pixels per day */
  px: number
  /** Row index (staggers the entrance) */
  index: number
  /** Absent without the edit permission */
  onEdit?: (record: Row) => void
}

function TaskBar({ row: { record, hasChildren }, range, px, index, onEdit }: TaskBarProps) {
  const { t } = useTranslation()
  const s = toDay(record.start_date)
  if (s === null) return <span className="text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2 text-xs">{t('未设置日期')}</span>
  const e = toDay(record.end_date) ?? s
  const meta = STATUS_BAR[statusOf(record)]
  const left = (s - range.start) * px
  const width = Math.max((e - s + 1) * px, 6)
  const progress = record.progress ?? 0
  const delay = Math.min(index, 16) * 0.03
  // Shared by the clickable bar (edit permission) and the read-only one
  const bar = {
    initial: { scaleX: 0, opacity: 0 },
    animate: { scaleX: 1, opacity: 1 },
    transition: { duration: 0.5, ease: EASE_OUT, delay },
    className: cn('absolute top-1/2 origin-left -translate-y-1/2 overflow-hidden', hasChildren ? 'h-2.5 rounded-full' : 'h-6 rounded-md', meta.track),
    style: { left, width },
  }
  const fill = (
    <>
      <motion.span
        initial={{ width: 0 }}
        animate={{ width: `${progress}%` }}
        transition={{ duration: 0.7, ease: EASE_OUT, delay: delay + 0.2 }}
        className={cn('block h-full', meta.fill)}
      />
      {!hasChildren && width >= 48 && progress > 0 ? (
        <span
          className={cn(
            'absolute inset-y-0 left-2 flex items-center text-[11px] font-medium tabular-nums',
            meta.solid && (progress / 100) * width >= 40 ? meta.solid : 'text-foreground/70',
          )}
        >
          {progress}%
        </span>
      ) : null}
    </>
  )
  return (
    <>
      <BarTooltip record={record}>
        {onEdit ? (
          <motion.button
            type="button"
            {...bar}
            onClick={() => onEdit(record)}
            aria-label={t('编辑「{{name}}」', { name: record.name })}
            className={cn(bar.className, 'hover:ring-primary/35 cursor-pointer hover:ring-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring')}
          >
            {fill}
          </motion.button>
        ) : (
          <motion.div {...bar}>{fill}</motion.div>
        )}
      </BarTooltip>
      <span className="text-muted-foreground pointer-events-none absolute top-1/2 -translate-y-1/2 text-xs whitespace-nowrap" style={{ left: left + width + 8 }}>
        {record.name}
      </span>
    </>
  )
}

function GanttSkeleton() {
  return (
    <div className="space-y-3 p-5">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-5 rounded-md" style={{ width: `${30 + ((i * 17) % 45)}%`, marginLeft: `${(i * 9) % 30}%` }} />
        </div>
      ))}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────
export default function GanttPage() {
  const { t, i18n } = useTranslation()
  const { hasPermission } = useAuth()
  const canAdd = hasPermission('cc_patterns_add')
  const canEdit = hasPermission('cc_patterns_edit')
  const canDelete = hasPermission('cc_patterns_delete')

  const [records, setRecords] = useState<Row[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [scale, setScale] = useState<Scale>('week')
  const [collapsed, setCollapsed] = useState<Set<number>>(() => new Set())
  const [hoverId, setHoverId] = useState<number | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Row | null>(null)
  const form = useForm<FormValues>({ defaultValues: EMPTY_VALUES })

  // The skeleton shows on the first load only; refreshes after a save run silently
  const fetchRecords = useCallback(
    () =>
      getItems({ per_page: MAX_RECORDS, sort_field: 'sort_order', sort_dir: 'asc' })
        .then((res) => {
          setRecords(res.items)
          setTotal(res.total)
        })
        .catch((err: unknown) => toast.apiError(err, '加载失败'))
        .finally(() => setLoading(false)),
    [],
  )

  useEffect(() => {
    fetchRecords()
  }, [fetchRecords])

  const children = useMemo(() => childrenByParent(records), [records])
  const rows = useMemo(() => flattenRows(children, collapsed), [children, collapsed])
  const tree = useMemo(() => toTree(children), [children])
  const range = useMemo(() => buildRange(records), [records])
  const months = useMemo(() => (range ? buildMonths(range, i18n.language) : []), [range, i18n.language])
  const ticks = useMemo(() => (range ? buildTicks(range, scale) : []), [range, scale])
  const weekends = useMemo(() => (range ? weekendOffsets(range) : []), [range])
  const counts = useMemo(() => {
    const c: Record<Status, number> = { todo: 0, in_progress: 0, done: 0, archived: 0 }
    for (const r of records) c[statusOf(r)] += 1
    return c
  }, [records])
  const unscheduled = records.filter((r) => toDay(r.start_date) === null).length
  const px = SCALE_PX[scale]

  // Scroll today into view (a few days in from the left) once the chart is shown and when the scale changes
  const scrollRef = useRef<HTMLDivElement>(null)
  const todayX = range?.todayVisible ? (range.today - range.start) * px : null
  useEffect(() => {
    if (scrollRef.current && todayX !== null) scrollRef.current.scrollLeft = Math.max(0, todayX - 96)
  }, [todayX, loading])

  const toggle = (id: number) =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (!next.delete(id)) next.add(id)
      return next
    })

  // ── CRUD ───────────────────────────────────────────────
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
    // A new record, or one moved to another parent, goes after its last sibling
    const append = { ...values, sort_order: nextSortOrder(children, values.parent_id) }
    try {
      if (editing) {
        await updateItem(editing.id, editing.parent_id === values.parent_id ? values : append)
        toast.success('更新成功')
      } else {
        await createItem(append)
        toast.success('创建成功')
      }
      setFormOpen(false)
      fetchRecords()
    } catch (err) {
      toast.apiError(err, '操作失败')
      throw err
    }
  }

  const remove = async (record: Row) => {
    try {
      await deleteItem(record.id)
      toast.success('删除成功')
      fetchRecords()
    } catch (err) {
      toast.apiError(err, '删除失败')
      throw err
    }
  }

  const onEdit = canEdit ? openEdit : undefined
  const leftCell = 'w-[200px] md:w-[400px] xl:w-[540px]'

  return (
    <MotionConfig reducedMotion="user">
      <PageHeader
        title="甘特图"
        description={
          !loading && total > records.length ? t('显示前 {{shown}} 条，共 {{count}} 条', { shown: records.length, count: total }) : undefined
        }
        actions={
          canAdd ? (
            <Button size="sm" variant="brand" onClick={openCreate}>
              <Plus />
              {t('新建')}
            </Button>
          ) : null
        }
      />

      <Panel
        padded={false}
        title="排期"
        description={
          range
            ? [
                `${fmtDay(range.start + 3)} ~ ${fmtDay(range.end - 4)}`,
                t('共 {{count}} 项', { count: records.length }),
                unscheduled ? t('{{count}} 项未设置日期', { count: unscheduled }) : null,
                range.todayVisible ? null : t('今天（{{date}}）不在排期范围内', { date: fmtDay(range.today) }),
              ]
                .filter(Boolean)
                .join(' · ')
            : undefined
        }
        actions={<SegmentedTabs variant="pill" value={scale} onChange={setScale} items={SCALES} />}
      >
        {!loading && records.length ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-5 pb-3 text-xs">
            {STATUSES.map((status) => (
              <span key={status} className="text-muted-foreground inline-flex items-center gap-1.5">
                <span className={cn('h-2 w-3.5 rounded-sm', STATUS_BAR[status].fill)} />
                {t(statusLabel(status))}
                <span className="text-foreground font-medium tabular-nums">{counts[status]}</span>
              </span>
            ))}
            <span className="text-muted-foreground inline-flex items-center gap-1.5">
              <span className="bg-muted-foreground/45 h-1.5 w-3.5 rounded-full" />
              {t('上级记录（汇总）')}
            </span>
          </div>
        ) : null}

        {loading ? (
          <GanttSkeleton />
        ) : records.length === 0 ? (
          <EmptyState
            icon={CalendarRange}
            title="暂无数据"
            description={canAdd ? '点击右上角「新建」添加第一条数据' : undefined}
          />
        ) : (
          <div ref={scrollRef} className="overflow-x-auto border-t">
            <div className="flex min-w-max">
              {/* ── Left: the record list (pinned while the timeline scrolls) ── */}
              <div className={cn('bg-card sticky left-0 z-20 shrink-0 border-r', leftCell)}>
                <div className="bg-muted/40 text-muted-foreground flex h-14 items-end gap-3 border-b px-4 pb-2 text-xs font-medium">
                  <span className="flex-1">{t('名称')}</span>
                  <span className="hidden w-14 xl:block">{t('负责人')}</span>
                  <span className="hidden w-24 md:block">{t('进度')}</span>
                  <span className="hidden w-16 xl:block">{t('状态')}</span>
                  <span className="w-14" />
                </div>
                {rows.map((row) => {
                  const { record, depth, hasChildren } = row
                  const status = statusOf(record)
                  return (
                    <div
                      key={record.id}
                      onMouseEnter={() => setHoverId(record.id)}
                      onMouseLeave={() => setHoverId(null)}
                      className={cn('group/row flex items-center gap-3 border-b px-4 transition-colors last:border-b-0', hoverId === record.id && 'bg-muted/50')}
                      style={{ height: ROW_H }}
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-1" style={{ paddingLeft: depth * 16 }}>
                        {hasChildren ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground size-5 shrink-0"
                            aria-label={collapsed.has(record.id) ? t('展开') : t('收起')}
                            aria-expanded={!collapsed.has(record.id)}
                            onClick={() => toggle(record.id)}
                          >
                            <ChevronRight className={cn('transition-transform duration-200', !collapsed.has(record.id) && 'rotate-90')} />
                          </Button>
                        ) : (
                          <span className="size-5 shrink-0" />
                        )}
                        <span className={cn('truncate text-[13px]', hasChildren ? 'font-semibold' : 'font-medium')} title={record.name ?? undefined}>
                          {record.name}
                        </span>
                      </div>
                      <span className="text-muted-foreground hidden w-14 truncate text-xs xl:block">{record.owner || '-'}</span>
                      <div className="hidden w-24 md:block">
                        <ProgressCell value={record.progress ?? 0} />
                      </div>
                      <span className="hidden w-16 xl:block">
                        <StatusBadge tone={statusTone(status)} variant="plain" dot>
                          {statusLabel(status)}
                        </StatusBadge>
                      </span>
                      <div className="flex w-14 justify-end gap-0.5 transition-opacity md:opacity-0 md:group-hover/row:opacity-100 md:focus-within:opacity-100">
                        {onEdit ? (
                          <Button variant="ghost" size="icon" className="size-7" aria-label={t('编辑')} onClick={() => onEdit(record)}>
                            <Pencil />
                          </Button>
                        ) : null}
                        {canDelete ? (
                          <ConfirmAction
                            title={t('确定删除「{{name}}」？', { name: record.name })}
                            description="删除后不可恢复。"
                            confirmText="删除"
                            onConfirm={() => remove(record)}
                          >
                            <Button variant="ghost" size="icon" className="text-danger hover:text-danger size-7" aria-label={t('删除')}>
                              <Trash2 />
                            </Button>
                          </ConfirmAction>
                        ) : null}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* ── Right: the timeline ── */}
              {range ? (
                <div className="relative shrink-0" style={{ width: range.days * px + 160 }}>
                  {/* Header: months, then days or weeks */}
                  <div className="bg-muted/40 relative h-14 border-b">
                    {months.map((m) => (
                      <div
                        key={m.key}
                        className="text-muted-foreground absolute top-0 flex h-7 items-center border-l px-2 text-xs font-medium whitespace-nowrap first:border-l-0"
                        style={{ left: m.offset * px, width: m.days * px }}
                      >
                        <span className="truncate">{m.days * px >= 56 ? m.label : ''}</span>
                      </div>
                    ))}
                    {ticks.map((tick) => (
                      <div
                        key={tick.offset}
                        className="text-muted-foreground/80 absolute top-7 flex h-7 items-center justify-center text-[11px] tabular-nums"
                        style={{ left: tick.offset * px, width: tick.width * px }}
                      >
                        {tick.label}
                      </div>
                    ))}
                    {range.todayVisible ? (
                      <span
                        className="bg-brand-gradient-strong absolute bottom-1 z-10 -translate-x-1/2 rounded-full px-1.5 py-px text-[10px] font-medium text-white"
                        style={{ left: (range.today - range.start) * px + px / 2 }}
                      >
                        {t('今天')}
                      </span>
                    ) : null}
                  </div>

                  {/* Background: weekends, month dividers, today line */}
                  <div className="pointer-events-none absolute inset-x-0 top-14 bottom-0" aria-hidden>
                    {weekends.map((offset) => (
                      <div key={offset} className="bg-muted/45 absolute inset-y-0" style={{ left: offset * px, width: px }} />
                    ))}
                    {months.slice(1).map((m) => (
                      <div key={m.key} className="bg-border absolute inset-y-0 w-px" style={{ left: m.offset * px }} />
                    ))}
                    {range.todayVisible ? (
                      <div
                        className="bg-primary absolute inset-y-0 w-0.5 -translate-x-1/2 opacity-70"
                        style={{ left: (range.today - range.start) * px + px / 2 }}
                      />
                    ) : null}
                  </div>

                  {rows.map((row, i) => (
                    <div
                      key={row.record.id}
                      onMouseEnter={() => setHoverId(row.record.id)}
                      onMouseLeave={() => setHoverId(null)}
                      className={cn('relative border-b transition-colors last:border-b-0', hoverId === row.record.id && 'bg-muted/50')}
                      style={{ height: ROW_H }}
                    >
                      <TaskBar row={row} range={range} px={px} index={i} onEdit={onEdit} />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-muted-foreground flex flex-1 items-center justify-center px-10 text-[13px]">{t('没有设置开始日期的记录，无法绘制时间轴')}</div>
              )}
            </div>
          </div>
        )}
      </Panel>

      <FormDialog open={formOpen} onOpenChange={setFormOpen} title={editing ? '编辑' : '新建'} form={form} onSubmit={submit}>
        <FormInput control={form.control} name="name" label="名称" rules={{ required: '此项必填' }} />
        <FormTreeSelect
          control={form.control}
          name="parent_id"
          label="上级记录"
          tree={tree}
          excludeId={editing?.id}
          noneLabel="（无）顶级记录"
          placeholder="顶级记录"
        />
        <FormGrid>
          <FormInput control={form.control} name="code" label="编码" rules={{ required: '此项必填' }} />
          <FormInput control={form.control} name="owner" label="负责人" />
          <FormSelect control={form.control} name="status" label="状态" options={STATUS_OPTIONS} rules={{ required: '此项必填' }} />
          <FormNumber
            control={form.control}
            name="progress"
            label="进度 (%)"
            min={0}
            max={100}
            step={1}
            rules={{
              min: { value: 0, message: '进度范围 0–100' },
              max: { value: 100, message: '进度范围 0–100' },
            }}
          />
          <FormDate control={form.control} name="start_date" label="开始日期" />
          <FormDate
            control={form.control}
            name="end_date"
            label="结束日期"
            rules={{
              // Same rule as the API: the end can't be before the start (YYYY-MM-DD compares as text)
              validate: (value, values) => !value || !values.start_date || values.start_date <= value || '结束日期不能早于开始日期',
            }}
          />
        </FormGrid>
      </FormDialog>
    </MotionConfig>
  )
}
