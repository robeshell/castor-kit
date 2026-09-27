import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from '@/lib/toast'
import DataTable, { type DataTableColumn } from '@/shared/components/DataTable'
import SegmentedTabs, { type SegmentedTabItem } from '@/shared/components/SegmentedTabs'

type DemoState = 'initial' | 'refreshing' | 'empty'

interface Invoice {
  id: number
  number: string
  total: number
}

const INVOICES: Invoice[] = [
  { id: 1, number: 'INV-2026-0081', total: 1280 },
  { id: 2, number: 'INV-2026-0082', total: 460 },
  { id: 3, number: 'INV-2026-0083', total: 3915 },
]

const STATES: SegmentedTabItem<DemoState>[] = [
  { value: 'initial', label: '首次加载' },
  { value: 'refreshing', label: '刷新中' },
  { value: 'empty', label: '无数据' },
]

const columns: DataTableColumn<Invoice>[] = [
  { key: 'number', title: '发票号', dataIndex: 'number', className: 'font-mono text-xs' },
  { key: 'total', title: '金额', dataIndex: 'total', width: 120, align: 'right', className: 'tabular-nums' },
]

export default function LoadingAndEmpty() {
  const { t } = useTranslation()
  const [state, setState] = useState<DemoState>('initial')
  // loading with no rows yet → skeleton rows; loading with rows (a refetch) → the rows stay, dimmed;
  // not loading and no rows → the empty state, with an optional next step
  const data = state === 'refreshing' ? INVOICES : []
  return (
    <div className="space-y-3">
      <SegmentedTabs variant="pill" value={state} onChange={setState} items={STATES} />
      <DataTable
        columns={columns}
        data={data}
        loading={state !== 'empty'}
        pagination={{ page: 1, perPage: 5, total: data.length }}
        emptyTitle="还没有发票"
        emptyDescription="订单付款后会自动生成发票。"
        emptyAction={
          <Button variant="outline" size="sm" onClick={() => toast.info('这里打开新建表单')}>
            <Plus />
            {t('手动开票')}
          </Button>
        }
      />
    </div>
  )
}
