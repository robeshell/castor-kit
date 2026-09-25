import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { List, useListRef } from 'react-window'
import { ArrowRight, Database, Layers, Timer } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import EmptyState from '@/shared/components/EmptyState'
import { SearchInput } from '@/shared/components/Filters'
import PageHeader from '@/shared/components/PageHeader'
import StatusBadge from '@/shared/components/StatusBadge'
import { useIsMobile } from '@/shared/hooks/useIsMobile'

// Column widths
const COLUMNS = [
  { title: 'ID', width: 'w-20' },
  { title: '姓名', width: 'w-40' },
  { title: '部门', width: 'w-[100px]' },
  { title: '级别', width: 'w-20' },
  { title: '薪资', width: 'w-[120px]' },
  { title: '状态', width: 'w-[90px]' },
  { title: '入职日期', width: 'w-[120px]' },
]

const STATUS_TONE = { 在职: 'success', 试用期: 'warning', 离职: 'danger', 休假: 'info' }
const ROW_HEIGHT = 48

// ── Data generation (timed) ────────────────────────────────────────────────
function generateData() {
  const t0 = performance.now()
  // i18n-ignore-next-line: sample department names are demo content
  const depts = ['研发部', '产品部', '市场部', '运营部', '财务部', '人事部']
  const levels = ['P4', 'P5', 'P6', 'P7', 'P8']
  const statuses = ['在职', '试用期', '离职', '休假']
  const data = []
  for (let i = 0; i < 100000; i++) {
    data.push({
      id: i + 1,
      // i18n-ignore-next-line: sample employee names are demo content
      name: `员工_${String(i + 1).padStart(6, '0')}`,
      dept: depts[i % depts.length],
      level: levels[i % levels.length],
      salary: Math.floor(10000 + (i % 50) * 1000 + Math.sin(i) * 5000),
      status: statuses[i % statuses.length],
      joinDate: `202${i % 4}-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`,
    })
  }
  const elapsed = (performance.now() - t0).toFixed(1)
  return { data, elapsed }
}

// ── Table header (sticky) ──────────────────────────────────────────────────────
function TableHeader() {
  const { t } = useTranslation()
  return (
    <div className="bg-muted/40 text-muted-foreground flex h-10 shrink-0 items-center border-y px-4 text-xs font-medium">
      {COLUMNS.map((col) => (
        <div key={col.title} className={cn('shrink-0', col.width)}>
          {t(col.title)}
        </div>
      ))}
    </div>
  )
}

// ── Row renderer (react-window v2: rowProps are spread into rowComponent props) ────────
function RowComponent({ index, style, ariaAttributes, itemData }) {
  const row = itemData?.[index]
  if (!row) return null
  return (
    <div
      {...ariaAttributes}
      style={style}
      className="hover:bg-muted/50 flex items-center border-b px-4 text-[13px] transition-colors duration-150"
    >
      <div className={cn('text-muted-foreground shrink-0 font-mono text-xs tabular-nums', COLUMNS[0].width)}>{row.id}</div>
      <div className={cn('shrink-0 font-medium', COLUMNS[1].width)}>{row.name}</div>
      <div className={cn('text-muted-foreground shrink-0', COLUMNS[2].width)}>{row.dept}</div>
      <div className={cn('shrink-0', COLUMNS[3].width)}>
        <StatusBadge tone="brand" className="font-mono">
          {row.level}
        </StatusBadge>
      </div>
      <div className={cn('shrink-0 font-medium tabular-nums', COLUMNS[4].width)}>¥{row.salary.toLocaleString()}</div>
      <div className={cn('shrink-0', COLUMNS[5].width)}>
        <StatusBadge tone={STATUS_TONE[row.status] || 'neutral'} dot>
          {row.status}
        </StatusBadge>
      </div>
      <div className={cn('text-muted-foreground shrink-0 text-xs tabular-nums', COLUMNS[6].width)}>{row.joinDate}</div>
    </div>
  )
}

// ── Metric card ──────────────────────────────────────────────────────
function MetricCard({ icon: Icon, label, value, desc }) {
  return (
    <div className="surface-card flex items-start gap-3 p-4">
      <span className="bg-brand-soft text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 space-y-0.5">
        <div className="text-muted-foreground text-[13px]">{label}</div>
        <div className="text-xl font-semibold tracking-tight tabular-nums">{value}</div>
        {desc ? <div className="text-muted-foreground text-xs">{desc}</div> : null}
      </div>
    </div>
  )
}

// ── debounce hook ─────────────────────────────────────────────────────
function useDebounce(initialValue, delay) {
  const [debounced, setDebounced] = useState(initialValue)
  const timerRef = useRef(null)
  const update = useCallback(
    (v) => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setDebounced(v), delay)
    },
    [delay],
  )
  // Clear the pending timer on unmount so we never setState on an unmounted component
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])
  return [debounced, update]
}

// ── Page ────────────────────────────────────────────────────────────
export default function VirtualScrollPage() {
  const { t } = useTranslation()
  const isMobile = useIsMobile()
  // Generate the data (once)
  const [{ data: ALL_DATA, elapsed }] = useState(generateData)

  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useDebounce('', 300)
  const [jumpIndex, setJumpIndex] = useState(1)
  const listRef = useListRef()

  const handleSearchChange = (val) => {
    setSearchInput(val)
    setDebouncedSearch(val)
  }

  // Filter the data
  const filteredData = useMemo(() => {
    if (!debouncedSearch.trim()) return ALL_DATA
    const kw = debouncedSearch.toLowerCase()
    return ALL_DATA.filter((r) => r.name.toLowerCase().includes(kw) || r.dept.toLowerCase().includes(kw))
  }, [ALL_DATA, debouncedSearch])

  const handleJump = () => {
    const idx = Math.max(0, Math.min(jumpIndex - 1, filteredData.length - 1))
    listRef.current?.scrollToRow({ index: idx, align: 'start' })
  }

  const listHeight = isMobile ? 360 : 500

  return (
    <div className="space-y-5">
      <PageHeader title="虚拟滚动列表" />

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard icon={Database} label={t('总数据量')} value={t('{{total}} 条', { total: '100,000' })} desc={t('完整员工数据集，一次性生成')} />
        <MetricCard icon={Layers} label={t('实际 DOM 节点')} value={t('~{{n}} 个', { n: 15 })} desc={t('react-window 仅渲染可视区行')} />
        <MetricCard icon={Timer} label={t('数据生成耗时')} value={`${elapsed} ms`} desc={t('首次渲染时生成一次')} />
      </div>

      <section className="surface-card overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto">
            <SearchInput value={searchInput} onChange={handleSearchChange} placeholder="搜索姓名或部门..." />
            <span className="text-muted-foreground text-[13px] whitespace-nowrap tabular-nums">
              {debouncedSearch
                ? t('匹配 {{matched}} / {{total}} 条', { matched: filteredData.length.toLocaleString(), total: ALL_DATA.length.toLocaleString() })
                : t('共 {{total}} 条数据', { total: ALL_DATA.length.toLocaleString() })}
            </span>
          </div>

          <div className="flex items-center gap-2 text-[13px]">
            <span className="text-muted-foreground whitespace-nowrap">{t('跳转到第')}</span>
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              max={filteredData.length}
              value={jumpIndex}
              onChange={(e) => setJumpIndex(Number(e.target.value) || 1)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleJump()
              }}
              className="h-8 w-24 text-[13px] tabular-nums"
            />
            <span className="text-muted-foreground">{t('行')}</span>
            <Button size="sm" variant="brand" onClick={handleJump}>
              {t('跳转')}
              <ArrowRight />
            </Button>
          </div>
        </div>

        {/* Header + virtual list (scrolls horizontally on narrow screens) */}
        <div className="overflow-x-auto">
          <div className="min-w-[760px]">
            <TableHeader />
            {filteredData.length === 0 ? (
              <EmptyState title="未找到匹配数据" description="换个关键词试试" className="py-20" />
            ) : (
              <List
                listRef={listRef}
                rowComponent={RowComponent}
                rowCount={filteredData.length}
                rowHeight={ROW_HEIGHT}
                rowProps={{ itemData: filteredData }}
                style={{ height: listHeight }}
              />
            )}
          </div>
        </div>

        {/* Footer info bar */}
        <div className="bg-muted/30 text-muted-foreground flex flex-wrap items-center gap-x-6 gap-y-1 border-t px-4 py-2.5 text-xs">
          <span>
            {t('虚拟滚动窗口高度 {{height}}px，每行高度 {{rowHeight}}px，可视区约 {{min}}~{{max}} 行', {
              height: listHeight,
              rowHeight: ROW_HEIGHT,
              min: Math.floor(listHeight / ROW_HEIGHT),
              max: Math.ceil(listHeight / ROW_HEIGHT),
            })}
          </span>
          <span>{t('实际挂载 DOM 节点数量远少于总数据量，内存占用极低')}</span>
        </div>
      </section>
    </div>
  )
}
