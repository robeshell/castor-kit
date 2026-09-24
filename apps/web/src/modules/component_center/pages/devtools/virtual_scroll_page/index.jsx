import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { List, useListRef } from 'react-window'
import { ArrowRight, Database, Layers, Timer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import EmptyState from '@/shared/components/EmptyState'
import { SearchInput } from '@/shared/components/Filters'
import PageHeader from '@/shared/components/PageHeader'
import StatusBadge from '@/shared/components/StatusBadge'
import { useIsMobile } from '@/shared/hooks/useIsMobile'

// 列宽配置
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

// ── 数据生成（带计时）────────────────────────────────────────────────
function generateData() {
  const t0 = performance.now()
  const depts = ['研发部', '产品部', '市场部', '运营部', '财务部', '人事部']
  const levels = ['P4', 'P5', 'P6', 'P7', 'P8']
  const statuses = ['在职', '试用期', '离职', '休假']
  const data = []
  for (let i = 0; i < 100000; i++) {
    data.push({
      id: i + 1,
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

// ── 表头（固定）──────────────────────────────────────────────────────
function TableHeader() {
  return (
    <div className="bg-muted/40 text-muted-foreground flex h-10 shrink-0 items-center border-y px-4 text-xs font-medium">
      {COLUMNS.map((col) => (
        <div key={col.title} className={cn('shrink-0', col.width)}>
          {col.title}
        </div>
      ))}
    </div>
  )
}

// ── 行渲染（react-window v2：rowProps 会展开到 rowComponent 的 props）────────
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

// ── 性能指标卡片 ──────────────────────────────────────────────────────
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
  // 卸载时清除待触发的定时器，避免对已卸载组件 setState
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])
  return [debounced, update]
}

// ── 主页面 ────────────────────────────────────────────────────────────
export default function VirtualScrollPage() {
  const isMobile = useIsMobile()
  // 生成数据（只执行一次）
  const [{ data: ALL_DATA, elapsed }] = useState(generateData)

  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useDebounce('', 300)
  const [jumpIndex, setJumpIndex] = useState(1)
  const listRef = useListRef()

  const handleSearchChange = (val) => {
    setSearchInput(val)
    setDebouncedSearch(val)
  }

  // 过滤数据
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
        <MetricCard icon={Database} label="总数据量" value="100,000 条" desc="完整员工数据集，一次性生成" />
        <MetricCard icon={Layers} label="实际 DOM 节点" value="~15 个" desc="react-window 仅渲染可视区行" />
        <MetricCard icon={Timer} label="数据生成耗时" value={`${elapsed} ms`} desc="首次渲染时生成一次" />
      </div>

      <section className="surface-card overflow-hidden">
        {/* 工具栏 */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto">
            <SearchInput value={searchInput} onChange={handleSearchChange} placeholder="搜索姓名或部门..." />
            <span className="text-muted-foreground text-[13px] whitespace-nowrap tabular-nums">
              {debouncedSearch
                ? `匹配 ${filteredData.length.toLocaleString()} / ${ALL_DATA.length.toLocaleString()} 条`
                : `共 ${ALL_DATA.length.toLocaleString()} 条数据`}
            </span>
          </div>

          <div className="flex items-center gap-2 text-[13px]">
            <span className="text-muted-foreground whitespace-nowrap">跳转到第</span>
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
            <span className="text-muted-foreground">行</span>
            <Button size="sm" variant="brand" onClick={handleJump}>
              跳转
              <ArrowRight />
            </Button>
          </div>
        </div>

        {/* 表头 + 虚拟滚动（窄屏横向可滚动）*/}
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

        {/* 底部信息栏 */}
        <div className="bg-muted/30 text-muted-foreground flex flex-wrap items-center gap-x-6 gap-y-1 border-t px-4 py-2.5 text-xs">
          <span>
            虚拟滚动窗口高度 {listHeight}px，每行高度 {ROW_HEIGHT}px，可视区约 {Math.floor(listHeight / ROW_HEIGHT)}~
            {Math.ceil(listHeight / ROW_HEIGHT)} 行
          </span>
          <span>实际挂载 DOM 节点数量远少于总数据量，内存占用极低</span>
        </div>
      </section>
    </div>
  )
}
