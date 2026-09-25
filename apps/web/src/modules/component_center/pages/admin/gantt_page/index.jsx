import { useCallback, useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { MotionConfig, motion } from 'motion/react'
import { CalendarRange, Flag, Pencil, Plus, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { EASE_OUT } from '@/lib/motion'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { createGanttTask, deleteGanttTask, getGanttTasks, updateGanttTask } from '@/modules/component_center/api/gantt_page'
import ConfirmAction from '@/shared/components/ConfirmAction'
import EmptyState from '@/shared/components/EmptyState'
import { FormDialog } from '@/shared/components/FormDialog'
import { FormCustom, FormDate, FormGrid, FormInput, FormNumber, FormSelect } from '@/shared/components/FormFields'
import PageHeader from '@/shared/components/PageHeader'
import Panel from '@/shared/components/Panel'
import SegmentedTabs from '@/shared/components/SegmentedTabs'
import StatusBadge from '@/shared/components/StatusBadge'

// Task colors are business data persisted to the database (backend default #4080FF), not page styling
const COLOR_PALETTE = ['#4080FF', '#00B96B', '#FA8C16', '#06B6D4', '#FF4D4F', '#8C8C8C']
const DEFAULT_COLOR = COLOR_PALETTE[0]

/** Status → badge tone / bar track / progress fill */
const STATUS_META = {
  not_started: { label: '未开始', tone: 'neutral', track: 'bg-muted-foreground/12', fill: 'bg-muted-foreground/45', dot: 'bg-muted-foreground/50' },
  in_progress: { label: '进行中', tone: 'brand', track: 'bg-brand-soft', fill: 'bg-brand-gradient', dot: 'bg-primary' },
  completed: { label: '已完成', tone: 'success', track: 'bg-success-soft', fill: 'bg-success', dot: 'bg-success' },
  delayed: { label: '已延期', tone: 'danger', track: 'bg-danger-soft', fill: 'bg-danger', dot: 'bg-danger' },
}
const TYPE_META = {
  phase: { label: '阶段', tone: 'info' },
  task: { label: '任务', tone: 'neutral' },
  milestone: { label: '里程碑', tone: 'warning' },
}
const PRIORITY_OPTIONS = [
  { value: 'low', label: '低' },
  { value: 'medium', label: '中' },
  { value: 'high', label: '高' },
  { value: 'critical', label: '紧急' },
]
const STATUS_OPTIONS = Object.entries(STATUS_META).map(([value, m]) => ({ value, label: m.label }))
const TYPE_OPTIONS = Object.entries(TYPE_META).map(([value, m]) => ({ value, label: m.label }))

const SCALES = [
  { value: 'day', label: '日', px: 32 },
  { value: 'week', label: '周', px: 14 },
  { value: 'month', label: '月', px: 5 },
]
const ROW_H = 44
const EMPTY_FORM = {
  title: '',
  task_type: 'task',
  start_date: '',
  end_date: '',
  progress: 0,
  assignee: '',
  priority: 'medium',
  status: 'not_started',
  color: DEFAULT_COLOR,
}

// ── Dates (computed as UTC day numbers to avoid time zone / DST errors) ──
const DAY_MS = 86400000
function toDay(value) {
  if (!value || typeof value !== 'string') return null
  const [y, m, d] = value.slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return null
  return Math.floor(Date.UTC(y, m - 1, d) / DAY_MS)
}
const dayDate = (n) => new Date(n * DAY_MS)
const fmtDay = (n) => dayDate(n).toISOString().slice(0, 10)
function todayDay() {
  const d = new Date()
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY_MS)
}

/** Timeline range: earliest start ~ latest end with padding on both sides; includes today when it is not too far away */
function buildRange(tasks) {
  let min = Infinity
  let max = -Infinity
  tasks.forEach((t) => {
    const s = toDay(t.start_date)
    const e = toDay(t.end_date)
    if (s !== null) min = Math.min(min, s)
    if (e !== null) max = Math.max(max, e)
    if (s !== null && e === null) max = Math.max(max, s)
  })
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null
  const today = todayDay()
  const nearToday = today >= min - 60 && today <= max + 60
  if (nearToday) {
    min = Math.min(min, today)
    max = Math.max(max, today)
  }
  const start = min - 3
  const end = max + 4
  return { start, end, days: end - start + 1, today, todayVisible: today >= start && today <= end }
}

function buildMonths(range, lang) {
  const monthFormat = new Intl.DateTimeFormat(lang, { year: 'numeric', month: 'short', timeZone: 'UTC' })
  const months = []
  for (let d = range.start; d <= range.end; d += 1) {
    const date = dayDate(d)
    const key = `${date.getUTCFullYear()}-${date.getUTCMonth()}`
    const last = months[months.length - 1]
    if (last && last.key === key) last.days += 1
    else months.push({ key, offset: d - range.start, days: 1, label: monthFormat.format(date) })
  }
  return months
}

// ── Small components ──────────────────────────────────────────────
function ColorPicker({ value, onChange }) {
  const { t } = useTranslation()
  const sel = (value || DEFAULT_COLOR).toUpperCase()
  return (
    <div className="flex items-center gap-2.5">
      {COLOR_PALETTE.map((c) => {
        const selected = sel === c.toUpperCase()
        return (
          <button
            key={c}
            type="button"
            aria-label={t('颜色 {{color}}', { color: c })}
            aria-pressed={selected}
            onClick={() => onChange(c)}
            className={cn(
              'ring-offset-background size-6 rounded-full transition-[box-shadow,transform] duration-150 hover:scale-110',
              selected && 'ring-foreground/70 ring-2 ring-offset-2',
            )}
            style={{ background: c }}
          />
        )
      })}
    </div>
  )
}

function ProgressCell({ value }) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0))
  return (
    <div className="flex items-center gap-2">
      <div className="bg-muted h-1.5 flex-1 overflow-hidden rounded-full">
        <div className={cn('h-full rounded-full', pct >= 100 ? 'bg-success' : 'bg-brand-gradient')} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-muted-foreground w-8 text-right text-xs tabular-nums">{pct}%</span>
    </div>
  )
}

function BarTooltip({ task, children }) {
  const { t } = useTranslation()
  const s = toDay(task.start_date)
  const e = toDay(task.end_date)
  const st = STATUS_META[task.status] || STATUS_META.not_started
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="top" className="px-3 py-2">
        <div className="space-y-1">
          <p className="font-medium">{task.title}</p>
          <p className="opacity-75 tabular-nums">
            {task.start_date?.slice(0, 10)} → {task.end_date?.slice(0, 10)}
            {s !== null && e !== null ? ` · ${t('{{count}} 天', { count: e - s + 1 })}` : ''}
          </p>
          <p className="opacity-75">
            {t(st.label)} · {t('进度 {{value}}%', { value: task.progress || 0 })}
            {task.assignee ? ` · ${task.assignee}` : ''}
          </p>
        </div>
      </TooltipContent>
    </Tooltip>
  )
}

function TaskBar({ task, range, px, index }) {
  const { t } = useTranslation()
  const s = toDay(task.start_date)
  const e = toDay(task.end_date) ?? s
  if (s === null) return <span className="text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2 text-xs">{t('未设置日期')}</span>
  const st = STATUS_META[task.status] || STATUS_META.not_started
  const left = (s - range.start) * px
  const width = Math.max((e - s + 1) * px, 6)
  const progress = Math.max(0, Math.min(100, Number(task.progress) || 0))
  const delay = Math.min(index, 16) * 0.03

  if (task.task_type === 'milestone') {
    const x = (e - range.start) * px + px / 2
    return (
      <>
        <BarTooltip task={task}>
          <motion.span
            initial={{ scale: 0, rotate: 45 }}
            animate={{ scale: 1, rotate: 45 }}
            transition={{ type: 'spring', stiffness: 420, damping: 24, delay }}
            className={cn('absolute top-1/2 -mt-[7px] -ml-[7px] size-3.5 rounded-[3px] shadow-sm ring-2 ring-[var(--card)]', st.fill)}
            style={{ left: x }}
          />
        </BarTooltip>
        <span className="text-muted-foreground pointer-events-none absolute top-1/2 -translate-y-1/2 text-xs whitespace-nowrap" style={{ left: x + 14 }}>
          {task.title}
        </span>
      </>
    )
  }

  const isPhase = task.task_type === 'phase'
  return (
    <>
      <BarTooltip task={task}>
        <motion.div
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 1 }}
          transition={{ duration: 0.5, ease: EASE_OUT, delay }}
          className={cn(
            'absolute top-1/2 origin-left -translate-y-1/2 overflow-hidden transition-shadow hover:shadow-[0_0_0_2px_color-mix(in_srgb,var(--primary)_35%,transparent)]',
            isPhase ? 'h-2.5 rounded-full' : 'h-6 rounded-md',
            st.track,
          )}
          style={{ left, width }}
        >
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.7, ease: EASE_OUT, delay: delay + 0.2 }}
            className={cn('h-full', st.fill)}
          />
          {!isPhase && width >= 48 && progress > 0 ? (
            <span
              className={cn(
                'absolute inset-y-0 left-2 flex items-center text-[11px] font-medium tabular-nums',
                (progress / 100) * width >= 40 && task.status !== 'not_started' ? 'text-white' : 'text-foreground/70',
              )}
            >
              {progress}%
            </span>
          ) : null}
        </motion.div>
      </BarTooltip>
      <span
        className="text-muted-foreground pointer-events-none absolute top-1/2 -translate-y-1/2 text-xs whitespace-nowrap"
        style={{ left: left + width + 8 }}
      >
        {task.title}
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

// ── Main Page ──────────────────────────────────────────────────────
export default function GanttPage() {
  const { t, i18n } = useTranslation()
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [scale, setScale] = useState('week')
  const [hoverId, setHoverId] = useState(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)

  const form = useForm({ defaultValues: EMPTY_FORM })

  const fetchTasks = useCallback(
    () =>
      getGanttTasks()
        .then((res) => setTasks(res?.items || res || []))
        .catch(() => toast.error('加载任务失败'))
        .finally(() => setLoading(false)),
    [],
  )

  useEffect(() => {
    fetchTasks()
  }, [fetchTasks])

  const range = useMemo(() => buildRange(tasks), [tasks])
  const months = useMemo(() => (range ? buildMonths(range, i18n.language) : []), [range, i18n.language])
  const px = SCALES.find((s) => s.value === scale)?.px || 14
  const counts = useMemo(() => {
    const c = { not_started: 0, in_progress: 0, completed: 0, delayed: 0 }
    tasks.forEach((t) => {
      if (c[t.status] !== undefined) c[t.status] += 1
    })
    return c
  }, [tasks])

  // ── CRUD ───────────────────────────────────────────────
  const openCreate = () => {
    setEditing(null)
    form.reset(EMPTY_FORM)
    setFormOpen(true)
  }
  const openEdit = (record) => {
    setEditing(record)
    form.reset({
      title: record.title,
      task_type: record.task_type || 'task',
      start_date: record.start_date ? record.start_date.slice(0, 10) : '',
      end_date: record.end_date ? record.end_date.slice(0, 10) : '',
      progress: record.progress ?? 0,
      assignee: record.assignee || '',
      priority: record.priority || 'medium',
      status: record.status || 'not_started',
      color: record.color || DEFAULT_COLOR,
    })
    setFormOpen(true)
  }

  const submit = async (values) => {
    const payload = {
      title: values.title,
      task_type: values.task_type || 'task',
      start_date: values.start_date || null,
      end_date: values.end_date || null,
      progress: values.progress ?? 0,
      assignee: values.assignee || '',
      priority: values.priority || 'medium',
      status: values.status || 'not_started',
      color: values.color || DEFAULT_COLOR,
    }
    try {
      if (editing) await updateGanttTask(editing.id, payload)
      else await createGanttTask(payload)
      toast.success(editing ? '任务已更新' : '任务已创建')
      setFormOpen(false)
      fetchTasks()
    } catch (err) {
      toast.apiError(err, '操作失败')
      throw err
    }
  }

  const remove = async (record) => {
    try {
      await deleteGanttTask(record.id)
      toast.success('任务已删除')
      fetchTasks()
    } catch (err) {
      toast.apiError(err, '删除失败')
      throw err
    }
  }

  // ── Timeline ───────────────────────────────────────────
  const timelineWidth = range ? range.days * px : 0
  const weekends = useMemo(() => {
    if (!range || scale === 'month') return []
    const list = []
    for (let d = range.start; d <= range.end; d += 1) {
      const wd = dayDate(d).getUTCDay()
      if (wd === 0 || wd === 6) list.push(d - range.start)
    }
    return list
  }, [range, scale])
  const ticks = useMemo(() => {
    if (!range || scale === 'month') return []
    const list = []
    for (let d = range.start; d <= range.end; d += 1) {
      const date = dayDate(d)
      if (scale === 'day') list.push({ offset: d - range.start, label: String(date.getUTCDate()), width: 1 })
      else if (date.getUTCDay() === 1) list.push({ offset: d - range.start, label: `${date.getUTCMonth() + 1}/${date.getUTCDate()}`, width: 7 })
    }
    return list
  }, [range, scale])

  const leftCell = 'w-[176px] md:w-[360px] xl:w-[520px]'

  return (
    <MotionConfig reducedMotion="user">
      <PageHeader
        title="甘特图页"
        actions={
          <Button size="sm" variant="brand" onClick={openCreate}>
            <Plus />
            {t('新建任务')}
          </Button>
        }
      />

      <Panel
        padded={false}
        title="项目排期"
        description={
          range
            ? [
                `${fmtDay(range.start + 3)} ~ ${fmtDay(range.end - 4)}`,
                t('共 {{count}} 项', { count: tasks.length }),
                range.todayVisible ? null : t('今天（{{date}}）不在排期范围内', { date: fmtDay(range.today) }),
              ]
                .filter(Boolean)
                .join(' · ')
            : undefined
        }
        actions={<SegmentedTabs variant="pill" value={scale} onChange={setScale} items={SCALES} />}
      >
        {!loading && tasks.length ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-5 pb-3 text-xs">
            {Object.entries(STATUS_META).map(([key, m]) => (
              <span key={key} className="text-muted-foreground inline-flex items-center gap-1.5">
                <span className={cn('h-2 w-3.5 rounded-sm', m.fill)} />
                {t(m.label)}
                <span className="text-foreground font-medium tabular-nums">{counts[key]}</span>
              </span>
            ))}
            <span className="text-muted-foreground inline-flex items-center gap-1.5">
              <span className="bg-muted-foreground/60 size-2 rotate-45 rounded-[1px]" />
              {t('里程碑')}
            </span>
          </div>
        ) : null}

        {loading ? (
          <GanttSkeleton />
        ) : tasks.length === 0 ? (
          <EmptyState
            icon={CalendarRange}
            title="暂无任务"
            description="点击「新建任务」开始"
            action={
              <Button size="sm" variant="outline" onClick={openCreate}>
                <Plus />
                {t('新建任务')}
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto border-t">
            <div className="flex min-w-max">
              {/* ── Left task list (pinned while scrolling horizontally) ── */}
              <div className={cn('bg-card sticky left-0 z-20 shrink-0 border-r', leftCell)}>
                <div className="bg-muted/40 text-muted-foreground flex h-14 items-end gap-3 border-b px-4 pb-2 text-xs font-medium">
                  <span className="flex-1">{t('任务名')}</span>
                  <span className="hidden w-14 xl:block">{t('负责人')}</span>
                  <span className="hidden w-24 md:block">{t('进度')}</span>
                  <span className="hidden w-14 xl:block">{t('状态')}</span>
                  <span className="w-14" />
                </div>
                {tasks.map((task) => {
                  const tm = TYPE_META[task.task_type] || TYPE_META.task
                  const st = STATUS_META[task.status] || { label: task.status, tone: 'neutral' }
                  return (
                    <div
                      key={task.id}
                      onMouseEnter={() => setHoverId(task.id)}
                      onMouseLeave={() => setHoverId(null)}
                      className={cn(
                        'group/row flex items-center gap-3 border-b px-4 transition-colors last:border-b-0',
                        hoverId === task.id && 'bg-muted/50',
                      )}
                      style={{ height: ROW_H }}
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <span className="size-2 shrink-0 rounded-full" style={{ background: task.color || DEFAULT_COLOR }} />
                        <StatusBadge tone={tm.tone} className="hidden shrink-0 xl:inline-flex">
                          {task.task_type === 'milestone' ? <Flag className="size-3" /> : null}
                          {t(tm.label)}
                        </StatusBadge>
                        <span className={cn('truncate text-[13px]', task.task_type === 'phase' ? 'font-semibold' : 'font-medium')} title={task.title}>
                          {task.title}
                        </span>
                      </div>
                      <span className="text-muted-foreground hidden w-14 truncate text-xs xl:block">{task.assignee || '-'}</span>
                      <div className="hidden w-24 md:block">
                        <ProgressCell value={task.progress} />
                      </div>
                      <span className="hidden w-14 xl:block">
                        <StatusBadge tone={st.tone} variant="plain" dot>
                          {st.label}
                        </StatusBadge>
                      </span>
                      <div className="flex w-14 justify-end gap-0.5 transition-opacity md:opacity-0 md:group-hover/row:opacity-100 md:focus-within:opacity-100">
                        <Button variant="ghost" size="icon" className="size-7" aria-label={t('编辑')} onClick={() => openEdit(task)}>
                          <Pencil />
                        </Button>
                        <ConfirmAction title={t('确定删除任务「{{title}}」？', { title: task.title })} confirmText="删除" onConfirm={() => remove(task)}>
                          <Button variant="ghost" size="icon" className="text-danger hover:text-danger size-7" aria-label={t('删除')}>
                            <Trash2 />
                          </Button>
                        </ConfirmAction>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* ── Right timeline ── */}
              {range ? (
                <div className="relative shrink-0" style={{ width: timelineWidth + 160 }}>
                  {/* Header: month / day or week */}
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
                    {ticks.map((t) => (
                      <div
                        key={t.offset}
                        className="text-muted-foreground/80 absolute top-7 flex h-7 items-center justify-center text-[11px] tabular-nums"
                        style={{ left: t.offset * px, width: t.width * px }}
                      >
                        {t.label}
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

                  {/* Background grid: weekends, month dividers, today line */}
                  <div className="pointer-events-none absolute inset-x-0 top-14 bottom-0" aria-hidden>
                    {weekends.map((o) => (
                      <div key={o} className="bg-muted/45 absolute inset-y-0" style={{ left: o * px, width: px }} />
                    ))}
                    {months.slice(1).map((m) => (
                      <div key={m.key} className="bg-border absolute inset-y-0 w-px" style={{ left: m.offset * px }} />
                    ))}
                    {range.todayVisible ? (
                      <div
                        className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-[linear-gradient(to_bottom,var(--brand-from),var(--brand-to))] opacity-80"
                        style={{ left: (range.today - range.start) * px + px / 2 }}
                      />
                    ) : null}
                  </div>

                  {tasks.map((task, i) => (
                    <div
                      key={task.id}
                      onMouseEnter={() => setHoverId(task.id)}
                      onMouseLeave={() => setHoverId(null)}
                      className={cn('relative border-b transition-colors last:border-b-0', hoverId === task.id && 'bg-muted/50')}
                      style={{ height: ROW_H }}
                    >
                      <TaskBar task={task} range={range} px={px} index={i} />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-muted-foreground flex flex-1 items-center justify-center px-10 text-[13px]">{t('任务日期不完整，无法渲染甘特图')}</div>
              )}
            </div>
          </div>
        )}
      </Panel>

      <FormDialog open={formOpen} onOpenChange={setFormOpen} title={editing ? '编辑任务' : '新建任务'} form={form} onSubmit={submit}>
        <FormInput control={form.control} name="title" label="任务名称" placeholder="请输入任务名称" rules={{ required: '请输入任务名称' }} />
        <FormGrid>
          <FormSelect control={form.control} name="task_type" label="任务类型" options={TYPE_OPTIONS} />
          <FormInput control={form.control} name="assignee" label="负责人" placeholder="请输入负责人" />
          <FormDate
            control={form.control}
            name="start_date"
            label="开始日期"
            placeholder="请选择开始日期"
            rules={{ required: '开始日期不能为空' }}
          />
          <FormDate
            control={form.control}
            name="end_date"
            label="结束日期"
            placeholder="请选择结束日期"
            rules={{ required: '结束日期不能为空' }}
          />
          <FormNumber
            control={form.control}
            name="progress"
            label="进度 (%)"
            min={0}
            max={100}
            rules={{
              min: { value: 0, message: '进度范围 0–100' },
              max: { value: 100, message: '进度范围 0–100' },
            }}
          />
          <FormSelect control={form.control} name="priority" label="优先级" options={PRIORITY_OPTIONS} />
          <FormSelect control={form.control} name="status" label="状态" options={STATUS_OPTIONS} />
        </FormGrid>
        <FormCustom
          control={form.control}
          name="color"
          label="任务颜色"
          render={({ value, onChange }) => <ColorPicker value={value} onChange={onChange} />}
        />
      </FormDialog>
    </MotionConfig>
  )
}
