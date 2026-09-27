import DataTable, { type DataTableColumn } from '@/shared/components/DataTable'
import StatusBadge, { type StatusTone } from '@/shared/components/StatusBadge'

/** The status values the API returns */
type OrderStatus = 'pending' | 'paid' | 'shipped' | 'refunded' | 'canceled'

// One map from API value to label and tone: a Record over the union fails to compile when a status is missing
const STATUS: Record<OrderStatus, { label: string; tone: StatusTone }> = {
  pending: { label: '待付款', tone: 'warning' },
  paid: { label: '已付款', tone: 'info' },
  shipped: { label: '已发货', tone: 'success' },
  refunded: { label: '已退款', tone: 'danger' },
  canceled: { label: '已取消', tone: 'neutral' },
}

interface Order {
  id: number
  code: string
  status: OrderStatus
  invoiced: boolean
}

const ORDERS: Order[] = [
  { id: 1, code: 'SO-24031', status: 'pending', invoiced: false },
  { id: 2, code: 'SO-24032', status: 'paid', invoiced: true },
  { id: 3, code: 'SO-24033', status: 'shipped', invoiced: true },
  { id: 4, code: 'SO-24034', status: 'refunded', invoiced: true },
  { id: 5, code: 'SO-24035', status: 'canceled', invoiced: false },
]

const columns: DataTableColumn<Order>[] = [
  { key: 'code', title: '订单号', dataIndex: 'code', className: 'font-mono text-xs' },
  // render's value is an OrderStatus, so STATUS[status] needs no fallback
  {
    key: 'status',
    title: '状态',
    dataIndex: 'status',
    render: (status) => (
      <StatusBadge tone={STATUS[status].tone} dot>
        {STATUS[status].label}
      </StatusBadge>
    ),
  },
  // A secondary yes / no state reads better as plain
  {
    key: 'invoiced',
    title: '发票',
    dataIndex: 'invoiced',
    render: (invoiced) => (
      <StatusBadge tone={invoiced ? 'success' : 'neutral'} variant="plain">
        {invoiced ? '已开票' : '未开票'}
      </StatusBadge>
    ),
  },
]

export default function StatusMapping() {
  return <DataTable columns={columns} data={ORDERS} dense />
}
