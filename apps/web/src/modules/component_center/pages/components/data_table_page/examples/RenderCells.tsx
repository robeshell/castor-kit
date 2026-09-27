import { formatDateTime, formatNumber } from '@/lib/format'
import DataTable, { type DataTableColumn } from '@/shared/components/DataTable'
import StatusBadge, { type StatusTone } from '@/shared/components/StatusBadge'

type OrderStatus = 'pending' | 'paid' | 'shipped' | 'canceled'

interface Order {
  id: number
  code: string
  customer: string
  email: string
  status: OrderStatus
  /** Decimals come back from the API as strings */
  amount: string
  /** ISO 8601 in UTC, as the API writes times */
  created_at: string
}

// One place for each status' label and badge tone; the labels are Chinese source text, translated by StatusBadge
const STATUS: Record<OrderStatus, { label: string; tone: StatusTone }> = {
  pending: { label: '待付款', tone: 'warning' },
  paid: { label: '已付款', tone: 'info' },
  shipped: { label: '已发货', tone: 'success' },
  canceled: { label: '已取消', tone: 'neutral' },
}

const ORDERS: Order[] = [
  { id: 1, code: 'SO-1001', customer: 'Northwind Traders', email: 'orders@northwind.test', status: 'paid', amount: '12800.00', created_at: '2026-09-21T02:15:00Z' },
  { id: 2, code: 'SO-1002', customer: 'Contoso Ltd.', email: 'buyer@contoso.test', status: 'pending', amount: '560.00', created_at: '2026-09-22T09:40:00Z' },
  { id: 3, code: 'SO-1003', customer: 'Fabrikam Inc.', email: 'hello@fabrikam.test', status: 'shipped', amount: '3420.00', created_at: '2026-09-23T14:05:00Z' },
  { id: 4, code: 'SO-1004', customer: 'Tailspin Toys', email: 'shop@tailspin.test', status: 'canceled', amount: '89.00', created_at: '2026-09-24T21:30:00Z' },
]

const columns: DataTableColumn<Order>[] = [
  { key: 'code', title: '订单号', dataIndex: 'code', width: 110, className: 'font-mono text-xs' },
  // No dataIndex: render gets undefined as the value and builds the cell from the row
  {
    key: 'customer',
    title: '客户',
    render: (_, row) => (
      <div className="min-w-0">
        <div className="truncate font-medium">{row.customer}</div>
        <div className="text-muted-foreground truncate text-xs">{row.email}</div>
      </div>
    ),
  },
  // value is typed OrderStatus here, so STATUS[value] can't miss
  {
    key: 'status',
    title: '状态',
    dataIndex: 'status',
    width: 100,
    render: (value) => (
      <StatusBadge tone={STATUS[value].tone} dot>
        {STATUS[value].label}
      </StatusBadge>
    ),
  },
  // Numbers: right-aligned, tabular figures, formatted in the UI language
  { key: 'amount', title: '金额', dataIndex: 'amount', width: 120, align: 'right', className: 'tabular-nums', render: (value) => formatNumber(value) },
  // API times are UTC; formatDateTime shows them in the browser's time zone
  {
    key: 'created_at',
    title: '下单时间',
    dataIndex: 'created_at',
    width: 170,
    className: 'text-muted-foreground tabular-nums',
    render: (value) => formatDateTime(value),
  },
]

export default function RenderCells() {
  return <DataTable columns={columns} data={ORDERS} minWidth={640} />
}
