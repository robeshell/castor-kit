import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { formatDateTime, formatNumber } from '@/lib/format'
import { DescriptionList, DetailSheet } from '@/shared/components/FormDialog'
import StatusBadge, { type StatusTone } from '@/shared/components/StatusBadge'

type InvoiceStatus = 'paid' | 'overdue'

interface Invoice {
  id: number
  code: string
  customer: string
  status: InvoiceStatus
  /** Decimals come back from the API as strings */
  amount: string
  issued_at: string
  paid_at: string | null
  note: string | null
}

const STATUS: Record<InvoiceStatus, { label: string; tone: StatusTone }> = {
  paid: { label: '已付款', tone: 'success' },
  overdue: { label: '已逾期', tone: 'danger' },
}

const INVOICES: Invoice[] = [
  {
    id: 1,
    code: 'INV-2041',
    customer: 'Northwind Traders',
    status: 'paid',
    amount: '12800.00',
    issued_at: '2026-09-01T02:00:00Z',
    paid_at: '2026-09-12T08:30:00Z',
    note: 'Paid by bank transfer, reference NW-7781',
  },
  { id: 2, code: 'INV-2042', customer: 'Contoso Ltd.', status: 'overdue', amount: '560.00', issued_at: '2026-08-15T02:00:00Z', paid_at: null, note: null },
]

export default function DetailView() {
  const { t } = useTranslation()
  const [current, setCurrent] = useState<Invoice | null>(null)
  // Keep the last invoice while the sheet animates closed
  const [shown, setShown] = useState<Invoice | null>(null)

  const open = (invoice: Invoice) => {
    setShown(invoice)
    setCurrent(invoice)
  }

  return (
    <div className="space-y-4">
      <ul className="divide-y rounded-lg border">
        {INVOICES.map((invoice) => (
          <li key={invoice.id} className="flex items-center gap-3 px-3 py-2 text-sm">
            <code className="font-mono text-xs">{invoice.code}</code>
            <span className="min-w-0 flex-1 truncate">{invoice.customer}</span>
            <Button variant="outline" size="sm" onClick={() => open(invoice)}>
              {t('查看')}
            </Button>
          </li>
        ))}
      </ul>

      {/* DescriptionList also works on its own, e.g. in a Panel; labels are Chinese source text, translated */}
      <DescriptionList
        items={[
          { label: '发票数', value: INVOICES.length },
          { label: '逾期', value: INVOICES.filter((i) => i.status === 'overdue').length },
        ]}
      />

      <DetailSheet
        open={current !== null}
        onOpenChange={(next) => !next && setCurrent(null)}
        title={shown ? t('发票 {{code}}', { code: shown.code }) : ''}
        description={shown?.customer}
        footer={
          <Button variant="outline" onClick={() => setCurrent(null)}>
            {t('关闭')}
          </Button>
        }
      >
        {shown ? (
          <DescriptionList
            columns={2}
            items={[
              { label: '客户', value: shown.customer },
              { label: '状态', value: <StatusBadge tone={STATUS[shown.status].tone}>{STATUS[shown.status].label}</StatusBadge> },
              { label: '金额', value: formatNumber(shown.amount) },
              { label: '开票时间', value: formatDateTime(shown.issued_at) },
              // Empty values show '-'; falsy entries are skipped, so an item can depend on the record
              { label: '付款时间', value: shown.paid_at ? formatDateTime(shown.paid_at) : null },
              shown.note !== null && { label: '备注', value: shown.note, full: true },
            ]}
          />
        ) : null}
      </DetailSheet>
    </div>
  )
}
