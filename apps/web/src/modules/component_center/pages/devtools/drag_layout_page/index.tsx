import { useId, useMemo, useState, type ComponentType, type KeyboardEvent, type ReactNode } from 'react'
import type { EChartsOption } from 'echarts'
import { AnimatePresence, motion } from 'motion/react'
import GridLayout, { cloneLayout, getLayoutItem, moveElement, useContainerWidth, verticalCompactor, type GridLayoutProps, type Layout } from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import ReactECharts from '@/shared/components/Chart'
import { GripVertical, Info, Lock, RotateCcw, Unlock } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { brandArea, brandLine, chartBase, useChartColors } from '@/lib/chart-theme'
import { EASE_OUT } from '@/lib/motion'
import { cn } from '@/lib/utils'
import DataTable, { type DataTableColumn } from '@/shared/components/DataTable'
import PageHeader from '@/shared/components/PageHeader'
import StatusBadge, { type StatusTone } from '@/shared/components/StatusBadge'
import { LOG_DATA, PROGRESS_DATA, SHARE, type LogLevel } from '@/modules/component_center/pages/devtools/drag_layout_page/demo-content'
import './drag-layout.css'

// Layout is saved in localStorage; the version suffix separates storage formats
const STORAGE_KEY = 'castor_kit_drag_layout_v1'

// ── Default layout ──────────────────────────────────────────────────────────
const DEFAULT_LAYOUT: Layout = [
  { i: 'line-chart', x: 0, y: 0, w: 6, h: 4 },
  { i: 'pie-chart', x: 6, y: 0, w: 6, h: 4 },
  { i: 'stat-cards', x: 0, y: 4, w: 3, h: 2 },
  { i: 'data-table', x: 3, y: 4, w: 6, h: 4 },
  { i: 'progress', x: 9, y: 4, w: 3, h: 2 },
  { i: 'sys-log', x: 0, y: 6, w: 3, h: 4 },
]

const COLS = 12
const GRID_CONFIG: GridLayoutProps['gridConfig'] = { cols: COLS, rowHeight: 80, margin: [12, 12], containerPadding: [0, 0] }
const MIN_W = 2

const ARROWS: Partial<Record<string, [number, number]>> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }

/**
 * Keyboard counterpart of dragging / resizing one card: an arrow moves it one cell, Shift + arrow resizes it.
 * Vertical moves go as far as needed for the card to actually change place (the compactor pulls cards back up),
 * the same as dragging it past its neighbour. Returns null when nothing can change.
 */
function nudgeLayout(layout: Layout, id: string, dx: number, dy: number, resize: boolean): Layout | null {
  const item = getLayoutItem(layout, id)
  if (!item) return null
  if (resize) {
    const w = Math.min(Math.max(item.w + dx, MIN_W), COLS - item.x)
    const h = Math.max(item.h + dy, 1)
    if (w === item.w && h === item.h) return null
    const next = cloneLayout(layout).map((l) => (l.i === id ? { ...l, w, h } : l))
    return verticalCompactor.compact(next, COLS)
  }
  if (dx !== 0) {
    const x = Math.min(Math.max(item.x + dx, 0), COLS - item.w)
    if (x === item.x) return null
    const next = cloneLayout(layout)
    const target = getLayoutItem(next, id)
    return target ? verticalCompactor.compact(moveElement(next, target, x, target.y, true, false, 'vertical', COLS), COLS) : null
  }
  const limit = Math.max(...layout.map((l) => l.y + l.h))
  for (let step = 1; step <= limit; step += 1) {
    const y = item.y + dy * step
    if (y < 0) return null
    const next = cloneLayout(layout)
    const target = getLayoutItem(next, id)
    if (!target) return null
    const moved = verticalCompactor.compact(moveElement(next, target, target.x, y, true, false, 'vertical', COLS), COLS)
    const after = getLayoutItem(moved, id)
    if (after && after.y !== item.y) return moved
  }
  return null
}

// ── Static data ──────────────────────────────────────────────────────────
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const SALES = [420, 532, 601, 734, 690, 810, 876, 950, 888, 1020, 1100, 1280]

const STAT_DATA = [
  { label: '总用户数', value: '182,430' },
  { label: '今日活跃', value: '34,821' },
  { label: '转化率', value: '19.1%' },
]

const STATUS_TONE: Record<string, StatusTone> = { 已完成: 'success', 处理中: 'warning', 已取消: 'danger' }

interface OrderRow {
  id: string
  customer: string
  /** Already formatted with thousands separators */
  amount: string
  /** Chinese source text, translated by StatusBadge */
  status: string
  date: string
}

const TABLE_COLUMNS: DataTableColumn<OrderRow>[] = [
  { key: 'id', title: '订单号', dataIndex: 'id', width: 100, render: (v) => <span className="font-mono text-xs">{v}</span> },
  { key: 'customer', title: '客户', dataIndex: 'customer', width: 90 },
  { key: 'amount', title: '金额(元)', dataIndex: 'amount', width: 100, align: 'right', render: (v) => <span className="tabular-nums">{v}</span> },
  {
    key: 'status',
    title: '状态',
    dataIndex: 'status',
    width: 90,
    render: (v) => (
      <StatusBadge tone={STATUS_TONE[v] || 'neutral'} dot>
        {v}
      </StatusBadge>
    ),
  },
  { key: 'date', title: '日期', dataIndex: 'date', width: 100, render: (v) => <span className="text-muted-foreground tabular-nums">{v}</span> },
]

const TABLE_DATA: OrderRow[] = Array.from({ length: 10 }, (_, i) => ({
  id: `ORD-${1000 + i}`,
  // i18n-ignore-next-line: sample customer names are demo content
  customer: `客户${String(i + 1).padStart(3, '0')}`,
  amount: (3000 + i * 1234).toLocaleString(),
  // i % 3 is always a valid index; ?? only satisfies the index type
  status: ['已完成', '处理中', '已取消'][i % 3] ?? '',
  date: `2025-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`,
}))

const LOG_LEVEL: Record<LogLevel, { tone: StatusTone; label: string }> = {
  success: { tone: 'success', label: 'OK' },
  warning: { tone: 'warning', label: 'WARN' },
  danger: { tone: 'danger', label: 'ERR' },
  info: { tone: 'info', label: 'INFO' },
}

/** A grid item as saved: the id and position / size (the optional fields aren't checked) */
function isLayoutItem(item: unknown): item is Layout[number] {
  return (
    typeof item === 'object' &&
    item !== null &&
    'i' in item &&
    typeof item.i === 'string' &&
    'x' in item &&
    typeof item.x === 'number' &&
    'y' in item &&
    typeof item.y === 'number' &&
    'w' in item &&
    typeof item.w === 'number' &&
    'h' in item &&
    typeof item.h === 'number'
  )
}
const isLayout = (value: unknown): value is Layout => Array.isArray(value) && value.every(isLayoutItem)

/** The saved layout (written by handleLayoutChange); anything else in storage falls back to the default */
function readSavedLayout(): Layout {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    const parsed: unknown = saved ? JSON.parse(saved) : null
    return isLayout(parsed) ? parsed : DEFAULT_LAYOUT
  } catch {
    return DEFAULT_LAYOUT
  }
}

// ── GridItem container ──────────────────────────────────────────────────────
interface GridItemProps {
  /** Chinese source text, translated here */
  title: string
  isEditing: boolean
  /** Arrow keys on the grip: move (resize with Shift) by one cell */
  onNudge: (dx: number, dy: number, resize: boolean) => void
  /** id of the keyboard instructions */
  hintId: string
  children: ReactNode
}

function GridItem({ title, isEditing, onNudge, hintId, children }: GridItemProps) {
  const { t } = useTranslation()
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    const delta = ARROWS[e.key]
    if (!delta) return
    e.preventDefault()
    onNudge(delta[0], delta[1], e.shiftKey)
  }
  return (
    <div
      className={cn(
        'surface-card flex h-full flex-col overflow-hidden transition-shadow duration-200',
        isEditing && 'ring-primary/40 ring-1 ring-offset-0',
      )}
    >
      <div
        className={cn(
          'flex h-9 shrink-0 items-center justify-between border-b px-3 select-none',
          isEditing ? 'drag-handle bg-muted/50 cursor-move' : 'cursor-default',
        )}
      >
        <span className="truncate text-[13px] font-medium">{t(title)}</span>
        {isEditing ? (
          <button
            type="button"
            aria-label={t('移动或调整：{{title}}', { title: t(title) })}
            aria-describedby={hintId}
            onKeyDown={onKeyDown}
            className="text-muted-foreground hover:text-foreground -mr-1.5 flex size-6 items-center justify-center rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <GripVertical className="size-4" />
          </button>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 overflow-hidden p-2">{children}</div>
    </div>
  )
}

// ── Widget contents ──────────────────────────────────────────────────────────
function LineChartWidget() {
  const { t } = useTranslation()
  const c = useChartColors()
  const option = useMemo((): EChartsOption => {
    const base = chartBase(c)
    return {
      ...base,
      grid: { ...base.grid, top: 12 },
      xAxis: { ...base.xAxis, type: 'category', data: MONTHS, boundaryGap: false },
      yAxis: { ...base.yAxis, type: 'value' },
      series: [
        {
          name: t('销售额'),
          type: 'line',
          smooth: true,
          data: SALES,
          showSymbol: false,
          color: c['brand-from'],
          lineStyle: { width: 2.2, color: brandLine(c) },
          itemStyle: { color: c['brand-from'], borderColor: c.card, borderWidth: 2 },
          areaStyle: brandArea(c),
        },
      ],
    }
  }, [c, t])
  // Text alternative for screen readers: the yearly total and the best month
  const peak = Math.max(...SALES)
  const summary = t('月度销售额折线图，全年共 {{total}}，最高是 {{month}}，{{max}}', {
    total: SALES.reduce((a, b) => a + b, 0),
    month: MONTHS[SALES.indexOf(peak)] ?? '',
    max: peak,
  })
  return <ReactECharts option={option} summary={summary} style={{ height: '100%', width: '100%' }} notMerge />
}

function PieChartWidget() {
  const { t } = useTranslation()
  const c = useChartColors()
  const option = useMemo((): EChartsOption => {
    const base = chartBase(c)
    return {
      color: base.color,
      textStyle: base.textStyle,
      tooltip: { ...base.tooltip, trigger: 'item', formatter: '{b}: {d}%' },
      legend: {
        orient: 'vertical',
        right: 8,
        top: 'center',
        icon: 'circle',
        itemWidth: 8,
        itemHeight: 8,
        textStyle: { color: c['muted-foreground'], fontSize: 12 },
      },
      series: [
        {
          name: t('市场份额'),
          type: 'pie',
          radius: ['46%', '72%'],
          center: ['38%', '50%'],
          padAngle: 2,
          itemStyle: { borderRadius: 5, borderColor: c.card, borderWidth: 2 },
          data: SHARE,
          label: { show: false },
        },
      ],
    }
  }, [c, t])
  // Text alternative for screen readers: the largest region and its share (the data is already in percent)
  const largest = SHARE.reduce((a, b) => (b.value > a.value ? b : a))
  const summary = t('市场份额环形图，{{count}} 个区域，最大的是{{name}}，占 {{share}}%', { count: SHARE.length, name: largest.name, share: largest.value })
  return <ReactECharts option={option} summary={summary} patterns style={{ height: '100%', width: '100%' }} notMerge />
}

function StatCardsWidget() {
  const { t } = useTranslation()
  return (
    <div className="flex h-full flex-col justify-center gap-1.5">
      {STAT_DATA.map((s) => (
        <div key={s.label} className="bg-muted/50 flex items-center justify-between rounded-lg px-3 py-1.5">
          <span className="text-muted-foreground text-xs">{t(s.label)}</span>
          <span className="text-sm font-semibold tabular-nums">{s.value}</span>
        </div>
      ))}
    </div>
  )
}

function DataTableWidget() {
  return (
    <div className="-m-2 h-[calc(100%+1rem)] overflow-auto">
      <DataTable data={TABLE_DATA} columns={TABLE_COLUMNS} bordered={false} dense minWidth={480} />
    </div>
  )
}

function ProgressWidget() {
  return (
    <div className="flex h-full flex-col justify-center gap-2.5 px-1">
      {PROGRESS_DATA.map((p) => (
        <div key={p.label} className="grid grid-cols-[44px_minmax(0,1fr)_32px] items-center gap-2 text-[11px]">
          <span className="text-muted-foreground">{p.label}</span>
          <div className="bg-muted h-1 overflow-hidden rounded-full">
            <div className="bg-brand-gradient h-full rounded-full" style={{ width: `${p.value}%` }} />
          </div>
          <span className="text-right font-mono tabular-nums">{p.value}%</span>
        </div>
      ))}
    </div>
  )
}

function SysLogWidget() {
  const { t } = useTranslation()
  return (
    // Scrolls: focusable so the keyboard can scroll it
    <div tabIndex={0} role="region" aria-label={t('系统日志')} className="h-full overflow-y-auto focus-visible:outline-ring focus-visible:outline-2 focus-visible:-outline-offset-2">
      {LOG_DATA.map((log) => {
        const meta = LOG_LEVEL[log.level]
        return (
          <div key={`${log.time}-${log.msg}`} className="flex items-start gap-2 border-b px-0.5 py-1.5 last:border-b-0">
            <span className="text-muted-foreground shrink-0 font-mono text-[10px] leading-5 tabular-nums">{log.time}</span>
            <StatusBadge tone={meta.tone} className="h-[18px] shrink-0 px-1 text-[10px]">
              {meta.label}
            </StatusBadge>
            <span className="text-[11px] leading-5 break-all">{log.msg}</span>
          </div>
        )
      })}
    </div>
  )
}

const WIDGET_MAP: Record<string, { title: string; Component: ComponentType }> = {
  'line-chart': { title: '折线图 · 月度销售', Component: LineChartWidget },
  'pie-chart': { title: '饼图 · 市场份额', Component: PieChartWidget },
  'stat-cards': { title: '数字卡 · 核心指标', Component: StatCardsWidget },
  'data-table': { title: '数据表格 · 订单列表', Component: DataTableWidget },
  progress: { title: '进度条 · 部门完成率', Component: ProgressWidget },
  'sys-log': { title: '系统日志', Component: SysLogWidget },
}

// ── Page ──────────────────────────────────────────────────────────
export default function DragLayoutPage() {
  const { t } = useTranslation()
  const { width, containerRef, mounted } = useContainerWidth({ measureBeforeMount: true })
  const [isEditing, setIsEditing] = useState(false)
  const [layout, setLayout] = useState(readSavedLayout)
  const hintId = useId()
  /** Where the last keyboard move / resize put the card (read out by the live region) */
  const [announcement, setAnnouncement] = useState('')

  const handleLayoutChange = (newLayout: Layout) => {
    setLayout(newLayout)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newLayout))
    } catch {
      /* ignore */
    }
  }

  const nudge = (id: string, title: string, dx: number, dy: number, resize: boolean) => {
    const next = nudgeLayout(layout, id, dx, dy, resize)
    const item = next && getLayoutItem(next, id)
    if (!next || !item) return
    handleLayoutChange(next)
    setAnnouncement(
      t('{{title}}：第 {{col}} 列，第 {{row}} 行，宽 {{w}} 格，高 {{h}} 格', { title: t(title), col: item.x + 1, row: item.y + 1, w: item.w, h: item.h }),
    )
  }

  const handleReset = () => {
    setLayout(DEFAULT_LAYOUT)
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="拖拽布局"
        actions={
          <>
            <Button size="sm" variant={isEditing ? 'brand' : 'outline'} onClick={() => setIsEditing((v) => !v)}>
              {isEditing ? <Lock /> : <Unlock />}
              {isEditing ? t('锁定布局') : t('编辑布局')}
            </Button>
            <Button size="sm" variant="ghost" onClick={handleReset}>
              <RotateCcw />
              {t('重置布局')}
            </Button>
          </>
        }
      />

      <AnimatePresence initial={false}>
        {isEditing ? (
          <motion.div
            key="tip"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: EASE_OUT }}
            className="overflow-hidden"
          >
            <div className="bg-brand-soft text-primary flex items-center gap-2 rounded-lg px-3 py-2 text-xs">
              <Info className="size-3.5 shrink-0" />
              <span id={hintId}>
                {t('编辑模式已开启 · 拖拽卡片标题栏移动位置，拖拽卡片右下角调整大小；键盘：聚焦标题栏的拖动按钮，方向键移动，Shift + 方向键调整大小。布局会自动保存至本地')}
              </span>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <p role="status" className="sr-only">
        {announcement}
      </p>

      {/* On narrow screens the grid keeps a minimum width and the wrapper scrolls horizontally */}
      <div className="-mx-1 overflow-x-auto px-1 pb-1">
        <div ref={containerRef} className="drag-layout min-w-[880px]">
          {mounted ? (
            <GridLayout
              className="layout"
              layout={layout}
              width={width}
              gridConfig={GRID_CONFIG}
              dragConfig={{ enabled: isEditing, handle: '.drag-handle' }}
              resizeConfig={{ enabled: isEditing }}
              onLayoutChange={handleLayoutChange}
            >
              {layout.map(({ i }) => {
                const meta = WIDGET_MAP[i]
                if (!meta) return null
                const { title, Component } = meta
                return (
                  <div key={i}>
                    <GridItem title={title} isEditing={isEditing} hintId={hintId} onNudge={(dx, dy, resize) => nudge(i, title, dx, dy, resize)}>
                      <Component />
                    </GridItem>
                  </div>
                )
              })}
            </GridLayout>
          ) : null}
        </div>
      </div>
    </div>
  )
}
