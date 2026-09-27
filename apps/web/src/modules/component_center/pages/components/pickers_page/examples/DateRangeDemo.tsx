import { useState } from 'react'
import { DatePicker } from '@/shared/components/DatePicker'

interface DateRange {
  /** 'YYYY-MM-DD', '' when open-ended */
  from: string
  to: string
}

export default function DateRangeDemo() {
  const [range, setRange] = useState<DateRange>({ from: '2026-09-01', to: '2026-09-30' })

  // There is no range picker: two DatePickers, kept in order (same-format date strings compare correctly as text)
  const setFrom = (from: string) => setRange((prev) => ({ from, to: prev.to && from > prev.to ? from : prev.to }))
  const setTo = (to: string) => setRange((prev) => ({ from: prev.from && to && to < prev.from ? to : prev.from, to }))

  return (
    <div className="max-w-md space-y-2">
      {/* Side by side from the sm breakpoint up, stacked on phones */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <DatePicker value={range.from} onChange={setFrom} placeholder="开始日期" className="min-w-0 sm:flex-1" />
        <span className="text-muted-foreground hidden text-sm sm:inline">–</span>
        <DatePicker value={range.to} onChange={setTo} placeholder="结束日期" className="min-w-0 sm:flex-1" />
      </div>
      {/* As list filters: send both ends, '' meaning no bound */}
      <code className="text-muted-foreground block font-mono text-xs">{JSON.stringify(range)}</code>
    </div>
  )
}
