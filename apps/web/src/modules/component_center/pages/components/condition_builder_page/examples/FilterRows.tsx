import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatNumber } from '@/lib/format'
import ConditionBuilder, {
  type ConditionField,
  type ConditionItem,
  type ConditionItemValue,
  type ConditionLogic,
  type ConditionTree,
} from '@/shared/components/ConditionBuilder'
import DataTable, { type DataTableColumn } from '@/shared/components/DataTable'
import StatusBadge, { type StatusTone } from '@/shared/components/StatusBadge'

type OrderStatus = 'pending' | 'paid' | 'shipped' | 'canceled'

interface Order {
  id: number
  code: string
  customer: string
  status: OrderStatus
  amount: number
  /** 'YYYY-MM-DD' */
  ordered_on: string
  urgent: boolean
  note: string | null
}

type OrderField = 'code' | 'customer' | 'status' | 'amount' | 'ordered_on' | 'urgent' | 'note'

const STATUS: Record<OrderStatus, { label: string; tone: StatusTone }> = {
  pending: { label: '待付款', tone: 'warning' },
  paid: { label: '已付款', tone: 'info' },
  shipped: { label: '已发货', tone: 'success' },
  canceled: { label: '已取消', tone: 'neutral' },
}

const FIELDS: ConditionField<OrderField>[] = [
  { key: 'code', label: '订单号', type: 'text' },
  { key: 'customer', label: '客户', type: 'text' },
  {
    key: 'status',
    label: '状态',
    type: 'select',
    options: Object.entries(STATUS).map(([value, { label }]) => ({ label, value })),
  },
  { key: 'amount', label: '金额', type: 'number' },
  { key: 'ordered_on', label: '下单日期', type: 'date' },
  { key: 'urgent', label: '加急', type: 'boolean' },
  { key: 'note', label: '备注', type: 'text' },
]

const ORDERS: Order[] = [
  { id: 1, code: 'SO-1001', customer: 'Northwind Traders', status: 'paid', amount: 12800, ordered_on: '2026-09-02', urgent: true, note: 'Gift wrap' },
  { id: 2, code: 'SO-1002', customer: 'Contoso Ltd.', status: 'pending', amount: 560, ordered_on: '2026-09-05', urgent: false, note: null },
  { id: 3, code: 'SO-1003', customer: 'Fabrikam Inc.', status: 'shipped', amount: 3420, ordered_on: '2026-09-11', urgent: false, note: 'Leave at the front desk' },
  { id: 4, code: 'SO-1004', customer: 'Tailspin Toys', status: 'canceled', amount: 89, ordered_on: '2026-09-12', urgent: false, note: null },
  { id: 5, code: 'SO-1005', customer: 'Northwind Traders', status: 'shipped', amount: 940, ordered_on: '2026-09-18', urgent: true, note: null },
  { id: 6, code: 'SO-1006', customer: 'Adventure Works', status: 'paid', amount: 2150, ordered_on: '2026-09-21', urgent: false, note: 'Invoice by email' },
  { id: 7, code: 'SO-1007', customer: 'Contoso Ltd.', status: 'shipped', amount: 7300, ordered_on: '2026-09-24', urgent: false, note: null },
]

// Start with a condition and a group, so the table is already filtered
const INITIAL: ConditionTree<OrderField> = {
  logic: 'AND',
  items: [{ field: 'status', operator: 'in', value: ['paid', 'shipped'] }],
  groups: [
    {
      logic: 'OR',
      items: [
        { field: 'amount', operator: 'gte', value: 3000 },
        { field: 'urgent', operator: 'eq', value: true },
      ],
    },
  ],
}

const isFilled = (value: ConditionItemValue) => value !== null && value !== ''

/** Half-filled conditions (no value yet, an open range on both ends) are skipped instead of matching nothing */
function isComplete({ operator, value }: ConditionItem<OrderField>): boolean {
  if (operator === 'empty' || operator === 'not_empty') return true
  return Array.isArray(value) ? value.some(isFilled) : isFilled(value)
}

/** Numbers compare as numbers, 'YYYY-MM-DD' dates as strings; null when the two can't be compared */
function compare(a: unknown, b: unknown): number | null {
  if (typeof a === 'number' && typeof b === 'number') return a - b
  if (typeof a === 'string' && typeof b === 'string') return a.localeCompare(b)
  return null
}

function test(row: Order, { field, operator, value }: ConditionItem<OrderField>): boolean {
  const actual = row[field]
  const text = String(actual ?? '').toLowerCase()
  const order = compare(actual, value)
  switch (operator) {
    case 'eq':
      return actual === value
    case 'ne':
      return actual !== value
    case 'contains':
      return text.includes(String(value).toLowerCase())
    case 'not_contains':
      return !text.includes(String(value).toLowerCase())
    case 'gt':
      return order !== null && order > 0
    case 'gte':
      return order !== null && order >= 0
    case 'lt':
      return order !== null && order < 0
    case 'lte':
      return order !== null && order <= 0
    case 'between': {
      const [min = null, max = null] = Array.isArray(value) ? value : []
      const fromMin = isFilled(min) ? compare(actual, min) : 0
      const toMax = isFilled(max) ? compare(actual, max) : 0
      return fromMin !== null && fromMin >= 0 && toMax !== null && toMax <= 0
    }
    case 'in':
      return Array.isArray(value) && value.some((v) => v === actual)
    case 'not_in':
      return Array.isArray(value) && !value.some((v) => v === actual)
    case 'empty':
      return actual === null || actual === ''
    case 'not_empty':
      return actual !== null && actual !== ''
  }
}

const combine = (logic: ConditionLogic, results: boolean[]) =>
  results.length === 0 || (logic === 'AND' ? results.every(Boolean) : results.some(Boolean))

/** The tree as a row predicate: each level combines its complete conditions (and groups) with its logic */
function matches(row: Order, tree: ConditionTree<OrderField>): boolean {
  const items = tree.items.filter(isComplete).map((item) => test(row, item))
  const groups = tree.groups.flatMap((group) => {
    const complete = group.items.filter(isComplete)
    // An empty group doesn't count either way
    return complete.length ? [combine(group.logic, complete.map((item) => test(row, item)))] : []
  })
  return combine(tree.logic, [...items, ...groups])
}

const columns: DataTableColumn<Order>[] = [
  { key: 'code', title: '订单号', dataIndex: 'code', width: 96, className: 'font-mono text-xs' },
  { key: 'customer', title: '客户', dataIndex: 'customer', ellipsis: true },
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
  { key: 'amount', title: '金额', dataIndex: 'amount', width: 100, align: 'right', className: 'tabular-nums', render: (value) => formatNumber(value) },
  { key: 'ordered_on', title: '下单日期', dataIndex: 'ordered_on', width: 110, className: 'tabular-nums' },
  { key: 'urgent', title: '加急', dataIndex: 'urgent', width: 64, render: (value) => (value ? '✓' : '') },
]

export default function FilterRows() {
  const { t } = useTranslation()
  const [conditions, setConditions] = useState(INITIAL)
  // Client-side filtering for data already loaded; for server data, send `conditions` with the list request instead
  const rows = useMemo(() => ORDERS.filter((row) => matches(row, conditions)), [conditions])

  return (
    <div className="space-y-4">
      <ConditionBuilder fields={FIELDS} value={conditions} onChange={setConditions} />
      <div className="space-y-2">
        <div className="text-muted-foreground text-xs tabular-nums">
          {t('匹配 {{count}} / {{total}} 条', { count: rows.length, total: ORDERS.length })}
        </div>
        <DataTable columns={columns} data={rows} dense minWidth={620} emptyTitle="没有符合条件的订单" />
      </div>
    </div>
  )
}
