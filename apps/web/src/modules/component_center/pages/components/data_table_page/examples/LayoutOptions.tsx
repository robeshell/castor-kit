import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import DataTable, { type DataTableColumn } from '@/shared/components/DataTable'
import Panel from '@/shared/components/Panel'

interface Shipment {
  code: string
  carrier: string
  destination: string
  weight_kg: number
  delayed: boolean
}

const SHIPMENTS: Shipment[] = [
  { code: 'SHP-7301', carrier: 'DHL', destination: 'Rotterdam, NL', weight_kg: 12.4, delayed: false },
  { code: 'SHP-7302', carrier: 'FedEx', destination: 'Austin, US', weight_kg: 3.1, delayed: true },
  { code: 'SHP-7303', carrier: 'UPS', destination: 'Lyon, FR', weight_kg: 48, delayed: false },
  { code: 'SHP-7304', carrier: 'Yamato', destination: 'Sapporo, JP', weight_kg: 7.75, delayed: false },
]

const columns: DataTableColumn<Shipment>[] = [
  { key: 'code', title: '运单号', dataIndex: 'code', width: 110, className: 'font-mono text-xs' },
  { key: 'carrier', title: '承运商', dataIndex: 'carrier', width: 100 },
  // minWidth on a column keeps it readable when the table scrolls
  { key: 'destination', title: '目的地', dataIndex: 'destination', minWidth: 160 },
  { key: 'weight_kg', title: '重量 (kg)', dataIndex: 'weight_kg', width: 110, align: 'right', className: 'tabular-nums' },
]

export default function LayoutOptions() {
  const { t } = useTranslation()
  const [active, setActive] = useState<string | null>(null)
  return (
    // Inside a card: bordered={false} drops the table's own border, Panel padded={false} lets it run edge to edge
    <Panel title="运单" description={active ? t('当前：{{code}}', { code: active }) : '点击一行查看'} padded={false}>
      <DataTable
        columns={columns}
        data={SHIPMENTS}
        // rowKey: any unique field (or a function) when the rows have no id
        rowKey="code"
        bordered={false}
        dense
        // Narrower containers scroll the table horizontally instead of squeezing the columns
        minWidth={560}
        onRowClick={(row) => setActive(row.code)}
        rowClassName={(row) => cn(row.code === active && 'bg-muted', row.delayed && 'text-warning')}
      />
    </Panel>
  )
}
