import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DatePicker } from '@/shared/components/DatePicker'

export default function DatePickerDemo() {
  const { t } = useTranslation()
  // The value is a 'YYYY-MM-DD' string, '' when empty: send it to the API as is
  const [dueDate, setDueDate] = useState('')
  const [reportDate, setReportDate] = useState('2026-09-28')

  return (
    <div className="grid max-w-2xl gap-4 sm:grid-cols-3">
      <div className="space-y-1.5">
        <p className="text-[13px] font-medium">{t('截止日期')}</p>
        <DatePicker value={dueDate} onChange={setDueDate} />
        <code className="text-muted-foreground block font-mono text-xs">{JSON.stringify(dueDate)}</code>
      </div>
      <div className="space-y-1.5">
        <p className="text-[13px] font-medium">{t('报表日期')}</p>
        {/* clearable={false} for a value that must always be set */}
        <DatePicker value={reportDate} onChange={setReportDate} clearable={false} placeholder="选择报表日期" />
        <code className="text-muted-foreground block font-mono text-xs">{JSON.stringify(reportDate)}</code>
      </div>
      <div className="space-y-1.5">
        <p className="text-[13px] font-medium">{t('禁用')}</p>
        <DatePicker value="2026-01-15" disabled />
      </div>
    </div>
  )
}
