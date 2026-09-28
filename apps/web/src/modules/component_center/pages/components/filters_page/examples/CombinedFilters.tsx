import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from '@/lib/toast'
import DataTable, { type DataTableColumn } from '@/shared/components/DataTable'
import { FilterBar, FilterSelect, SearchInput } from '@/shared/components/Filters'
import type { SelectOption } from '@/shared/components/FormFields'
import SegmentedTabs, { type SegmentedTabItem } from '@/shared/components/SegmentedTabs'
import StatusBadge, { type StatusTone } from '@/shared/components/StatusBadge'

type TicketStatus = 'open' | 'in_progress' | 'resolved'
type Priority = 1 | 2 | 3

interface Ticket {
  id: number
  code: string
  title: string
  status: TicketStatus
  priority: Priority
  owner: string
}

/** What the filter bar applies; in a real page this becomes the list request's query (useCrudList's handleSearch) */
interface Filters {
  keyword: string
  /** FilterSelect values are strings, '' for "all" */
  priority: string
  owner: string
}

const EMPTY_FILTERS: Filters = { keyword: '', priority: '', owner: '' }

const STATUS: Record<TicketStatus, { label: string; tone: StatusTone }> = {
  open: { label: '待处理', tone: 'warning' },
  in_progress: { label: '处理中', tone: 'info' },
  resolved: { label: '已解决', tone: 'success' },
}

const PRIORITY_OPTIONS: SelectOption<Priority>[] = [
  { label: '低', value: 1 },
  { label: '中', value: 2 },
  { label: '高', value: 3 },
]

const OWNER_OPTIONS: SelectOption<string>[] = [
  { label: 'Mia', value: 'Mia' },
  { label: 'Leo', value: 'Leo' },
  { label: 'Ava', value: 'Ava' },
]

const TICKETS: Ticket[] = [
  { id: 1, code: 'T-101', title: 'Login page times out', status: 'open', priority: 3, owner: 'Mia' },
  { id: 2, code: 'T-102', title: 'Invoice PDF missing logo', status: 'in_progress', priority: 2, owner: 'Leo' },
  { id: 3, code: 'T-103', title: 'Wrong currency in export', status: 'resolved', priority: 2, owner: 'Ava' },
  { id: 4, code: 'T-104', title: 'Webhook retries twice', status: 'open', priority: 1, owner: 'Leo' },
  { id: 5, code: 'T-105', title: 'Dark mode chart colors', status: 'in_progress', priority: 1, owner: 'Mia' },
  { id: 6, code: 'T-106', title: 'Search ignores accents', status: 'open', priority: 2, owner: 'Ava' },
  { id: 7, code: 'T-107', title: 'Export drops empty rows', status: 'resolved', priority: 3, owner: 'Mia' },
]

const columns: DataTableColumn<Ticket>[] = [
  { key: 'code', title: '编号', dataIndex: 'code', width: 80, className: 'font-mono text-xs' },
  { key: 'title', title: '标题', dataIndex: 'title', ellipsis: true },
  {
    key: 'status',
    title: '状态',
    dataIndex: 'status',
    width: 100,
    render: (status) => <StatusBadge tone={STATUS[status].tone}>{STATUS[status].label}</StatusBadge>,
  },
  { key: 'owner', title: '负责人', dataIndex: 'owner', width: 90 },
]

export default function CombinedFilters() {
  const { t } = useTranslation()
  // The bar edits a draft; '查询' (or Enter in the search box) applies it. The tabs apply at once.
  const [draft, setDraft] = useState<Filters>(EMPTY_FILTERS)
  const [applied, setApplied] = useState<Filters>(EMPTY_FILTERS)
  const [tab, setTab] = useState<'all' | TicketStatus>('all')

  const matched = useMemo(() => {
    const keyword = applied.keyword.trim().toLowerCase()
    return TICKETS.filter(
      (ticket) =>
        (!keyword || ticket.title.toLowerCase().includes(keyword) || ticket.code.toLowerCase().includes(keyword)) &&
        (!applied.priority || String(ticket.priority) === applied.priority) &&
        (!applied.owner || ticket.owner === applied.owner),
    )
  }, [applied])
  const countOf = (status: TicketStatus) => matched.filter((ticket) => ticket.status === status).length
  const tabs: SegmentedTabItem<'all' | TicketStatus>[] = [
    { value: 'all', label: '全部', count: matched.length },
    { value: 'open', label: '待处理', count: countOf('open') },
    { value: 'in_progress', label: '处理中', count: countOf('in_progress') },
    { value: 'resolved', label: '已解决', count: countOf('resolved') },
  ]
  const rows = tab === 'all' ? matched : matched.filter((ticket) => ticket.status === tab)

  const search = () => setApplied(draft)
  const reset = () => {
    setDraft(EMPTY_FILTERS)
    setApplied(EMPTY_FILTERS)
    setTab('all')
  }

  return (
    <div>
      <FilterBar
        onSearch={search}
        onReset={reset}
        extra={
          <Button variant="outline" size="sm" onClick={() => toast.info(t('将导出 {{count}} 条', { count: rows.length }))}>
            <Download />
            {t('导出')}
          </Button>
        }
      >
        <SearchInput
          value={draft.keyword}
          onChange={(keyword) => setDraft((prev) => ({ ...prev, keyword }))}
          onSubmit={search}
          placeholder="搜索编号或标题"
        />
        <FilterSelect
          value={draft.priority}
          onChange={(priority) => setDraft((prev) => ({ ...prev, priority }))}
          options={PRIORITY_OPTIONS}
          placeholder="优先级" allLabel="全部优先级"
        />
        <FilterSelect value={draft.owner} onChange={(owner) => setDraft((prev) => ({ ...prev, owner }))} options={OWNER_OPTIONS} placeholder="负责人" allLabel="全部负责人" />
      </FilterBar>
      <div className="mb-3 overflow-x-auto">
        <SegmentedTabs value={tab} onChange={setTab} items={tabs} />
      </div>
      <DataTable
        columns={columns}
        data={rows}
        emptyTitle="没有匹配的记录"
        emptyDescription="换个关键词，或点「重置」清除筛选条件。"
        emptyAction={
          <Button variant="outline" size="sm" onClick={reset}>
            {t('重置')}
          </Button>
        }
      />
    </div>
  )
}
