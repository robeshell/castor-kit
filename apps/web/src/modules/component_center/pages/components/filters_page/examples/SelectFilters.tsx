import { useState } from 'react'
import { FilterSelect } from '@/shared/components/Filters'
import type { SelectOption } from '@/shared/components/FormFields'

type Status = 'active' | 'disabled'

const STATUS_OPTIONS: SelectOption<Status>[] = [
  { label: '启用', value: 'active' },
  { label: '停用', value: 'disabled' },
]

const PRIORITY_OPTIONS: SelectOption<number>[] = [
  { label: '低', value: 1 },
  { label: '中', value: 2 },
  { label: '高', value: 3 },
]

const REGION_OPTIONS: SelectOption<string>[] = [
  { label: 'EMEA', value: 'emea' },
  { label: 'APAC', value: 'apac' },
  { label: 'Americas', value: 'amer' },
]

export default function SelectFilters() {
  // onChange always sends a string ('' for "all"), numeric options included: keep the filter state a string
  const [status, setStatus] = useState('')
  const [priority, setPriority] = useState('')
  const [region, setRegion] = useState('')

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {/* placeholder names the "all" item: '状态' → 「全部状态」 */}
        <FilterSelect value={status} onChange={setStatus} options={STATUS_OPTIONS} placeholder="状态" />
        <FilterSelect value={priority} onChange={setPriority} options={PRIORITY_OPTIONS} placeholder="优先级" />
        {/* allLabel replaces that text; className sets the width */}
        <FilterSelect value={region} onChange={setRegion} options={REGION_OPTIONS} placeholder="地区" allLabel="所有地区" className="w-40" />
      </div>
      <pre className="bg-muted overflow-x-auto rounded-md p-3 font-mono text-xs">{JSON.stringify({ status, priority, region })}</pre>
    </div>
  )
}
