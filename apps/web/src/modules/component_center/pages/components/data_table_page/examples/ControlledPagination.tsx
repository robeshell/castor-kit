import { useState } from 'react'
import DataTable, { type DataTableColumn } from '@/shared/components/DataTable'

interface LogEntry {
  id: number
  path: string
  duration_ms: number
}

const PER_PAGE = 5
const ENTRIES: LogEntry[] = Array.from({ length: 42 }, (_, i) => ({
  id: i + 1,
  path: `/api/admin/orders/${1001 + i}`,
  duration_ms: 20 + ((i * 37) % 180),
}))

const columns: DataTableColumn<LogEntry>[] = [
  { key: 'id', title: 'ID', dataIndex: 'id', width: 64, className: 'text-muted-foreground tabular-nums' },
  { key: 'path', title: '路径', dataIndex: 'path', ellipsis: true, className: 'font-mono text-xs' },
  { key: 'duration_ms', title: '耗时 (ms)', dataIndex: 'duration_ms', width: 110, align: 'right', className: 'tabular-nums' },
]

export default function ControlledPagination() {
  // The page owns the page number. With an API, fetch `?page=&per_page=` and pass res.items / res.total
  // (useCrudList does exactly that); here one page is sliced from local data.
  const [page, setPage] = useState(1)
  const rows = ENTRIES.slice((page - 1) * PER_PAGE, page * PER_PAGE)
  return <DataTable columns={columns} data={rows} pagination={{ page, perPage: PER_PAGE, total: ENTRIES.length, onChange: setPage }} />
}
