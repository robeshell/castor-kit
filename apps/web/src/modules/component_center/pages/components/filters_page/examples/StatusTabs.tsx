import { useState } from 'react'
import SegmentedTabs, { type SegmentedTabItem } from '@/shared/components/SegmentedTabs'

type TicketStatus = 'open' | 'in_progress' | 'resolved'
type Tab = 'all' | TicketStatus
type Range = '24h' | '7d' | '30d'

interface Ticket {
  id: number
  title: string
  status: TicketStatus
  /** Hours since it was opened */
  age_hours: number
}

const TICKETS: Ticket[] = [
  { id: 1, title: 'Login page times out', status: 'open', age_hours: 3 },
  { id: 2, title: 'Invoice PDF missing logo', status: 'in_progress', age_hours: 30 },
  { id: 3, title: 'Wrong currency in export', status: 'resolved', age_hours: 100 },
  { id: 4, title: 'Webhook retries twice', status: 'open', age_hours: 200 },
  { id: 5, title: 'Dark mode chart colors', status: 'in_progress', age_hours: 12 },
]

const RANGE_HOURS: Record<Range, number> = { '24h': 24, '7d': 24 * 7, '30d': 24 * 30 }

const RANGE_ITEMS: SegmentedTabItem<Range>[] = [
  { value: '24h', label: '24 小时' },
  { value: '7d', label: '7 天' },
  { value: '30d', label: '30 天' },
]

export default function StatusTabs() {
  const [tab, setTab] = useState<Tab>('all')
  const [range, setRange] = useState<Range>('7d')

  const inRange = TICKETS.filter((ticket) => ticket.age_hours <= RANGE_HOURS[range])
  const countOf = (status: TicketStatus) => inRange.filter((ticket) => ticket.status === status).length
  // Counts follow the other filters (the range), not the tab itself
  const tabs: SegmentedTabItem<Tab>[] = [
    { value: 'all', label: '全部', count: inRange.length },
    { value: 'open', label: '待处理', count: countOf('open') },
    { value: 'in_progress', label: '处理中', count: countOf('in_progress') },
    { value: 'resolved', label: '已解决', count: countOf('resolved') },
  ]
  const rows = tab === 'all' ? inRange : inRange.filter((ticket) => ticket.status === tab)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        {/* The value type comes from the items, so onChange gets a Tab; the wrapper scrolls the tabs on narrow screens */}
        <div className="min-w-0 flex-1 overflow-x-auto">
          <SegmentedTabs value={tab} onChange={setTab} items={tabs} />
        </div>
        {/* variant="pill" for small toggles next to a chart or list */}
        <SegmentedTabs variant="pill" value={range} onChange={setRange} items={RANGE_ITEMS} />
      </div>
      <ul className="space-y-1 text-sm">
        {rows.map((ticket) => (
          <li key={ticket.id}>{ticket.title}</li>
        ))}
      </ul>
    </div>
  )
}
