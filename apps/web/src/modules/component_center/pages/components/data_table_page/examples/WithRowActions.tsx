import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Archive, Copy, RotateCcw, Truck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from '@/lib/toast'
import ConfirmAction from '@/shared/components/ConfirmAction'
import DataTable, { type DataTableColumn } from '@/shared/components/DataTable'
import RowActions from '@/shared/components/RowActions'
import StatusBadge from '@/shared/components/StatusBadge'

interface Order {
  id: number
  code: string
  customer: string
  paid: boolean
}

const ORDERS: Order[] = [
  { id: 1, code: 'SO-1001', customer: 'Northwind Traders', paid: true },
  { id: 2, code: 'SO-1002', customer: 'Contoso Ltd.', paid: false },
  { id: 3, code: 'SO-1003', customer: 'Fabrikam Inc.', paid: true },
]

export default function WithRowActions() {
  const { t } = useTranslation()
  const [rows, setRows] = useState(ORDERS)

  const remove = (row: Order) => {
    setRows((prev) => prev.filter((r) => r.id !== row.id))
    toast.success('已删除')
  }

  // Columns that call page handlers live inside the component
  const columns: DataTableColumn<Order>[] = [
    { key: 'code', title: '订单号', dataIndex: 'code', width: 110, className: 'font-mono text-xs' },
    { key: 'customer', title: '客户', dataIndex: 'customer', ellipsis: true },
    {
      key: 'paid',
      title: '付款',
      dataIndex: 'paid',
      width: 90,
      render: (paid) => <StatusBadge tone={paid ? 'success' : 'warning'}>{paid ? '已付款' : '待付款'}</StatusBadge>,
    },
    {
      key: 'actions',
      title: '',
      align: 'right',
      width: 150,
      // The first `inline` visible actions are buttons, the rest go into the "…" menu.
      // RowActions has no confirmation of its own: a dangerous action renders ConfirmAction around its button.
      render: (_, row) => (
        <RowActions
          inline={2}
          actions={[
            { label: '编辑', onClick: () => toast.info(t('编辑 {{code}}', { code: row.code })) },
            {
              label: '删除',
              render: () => (
                <ConfirmAction title="删除该订单？" description="删除后不可恢复。" confirmText="删除" onConfirm={() => remove(row)}>
                  <Button variant="ghost" size="sm" className="text-danger hover:text-danger h-7 px-2">
                    {t('删除')}
                  </Button>
                </ConfirmAction>
              ),
            },
            // hidden drops an action for this row; disabled keeps it visible but inert
            { label: '发货', icon: Truck, hidden: !row.paid, onClick: () => toast.success('已发货') },
            {
              label: '复制订单号',
              icon: Copy,
              onClick: () => {
                navigator.clipboard
                  .writeText(row.code)
                  .then(() => toast.success('已复制'))
                  .catch(() => toast.error('复制失败'))
              },
            },
            { label: '归档', icon: Archive, disabled: !row.paid, onClick: () => toast.success('已归档') },
          ]}
        />
      ),
    },
  ]

  return (
    <div className="space-y-3">
      <DataTable columns={columns} data={rows} minWidth={520} />
      <Button variant="ghost" size="sm" onClick={() => setRows(ORDERS)}>
        <RotateCcw />
        {t('重置')}
      </Button>
    </div>
  )
}
