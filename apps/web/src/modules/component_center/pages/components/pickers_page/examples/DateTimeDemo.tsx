import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatDateTime } from '@/lib/format'
import { DateTimePicker } from '@/shared/components/DatePicker'

export default function DateTimeDemo() {
  const { t } = useTranslation()
  // Start from the API's value (ISO 8601 in UTC); the picker shows it in the browser's time zone
  const [publishAt, setPublishAt] = useState('2026-10-01T01:30:00Z')

  return (
    <div className="max-w-md space-y-1.5">
      <p className="text-[13px] font-medium">{t('发布时间')}</p>
      {/* onChange gives ISO 8601 with the browser's offset (the API converts it to UTC), or '' when cleared; the time input unlocks once a date is set */}
      <DateTimePicker value={publishAt} onChange={setPublishAt} />
      <dl className="text-muted-foreground grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 font-mono text-xs">
        <dt>value</dt>
        <dd className="break-all">{JSON.stringify(publishAt)}</dd>
        <dt>formatDateTime</dt>
        <dd>{formatDateTime(publishAt)}</dd>
      </dl>
    </div>
  )
}
