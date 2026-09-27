import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import DataTable, { type DataTableColumn } from '@/shared/components/DataTable'
import { FilterBar, FilterSelect, SearchInput } from '@/shared/components/Filters'
import type { SelectOption } from '@/shared/components/FormFields'

type Plan = 'free' | 'team' | 'enterprise'

interface Account {
  id: number
  name: string
  plan: Plan
  seats: number
}

const PLAN_OPTIONS: SelectOption<Plan>[] = [
  { label: 'Free', value: 'free' },
  { label: 'Team', value: 'team' },
  { label: 'Enterprise', value: 'enterprise' },
]

const ACCOUNTS: Account[] = [
  { id: 1, name: 'Northwind Traders', plan: 'enterprise', seats: 240 },
  { id: 2, name: 'Contoso Ltd.', plan: 'team', seats: 35 },
  { id: 3, name: 'Fabrikam Inc.', plan: 'team', seats: 18 },
  { id: 4, name: 'Tailspin Toys', plan: 'free', seats: 3 },
  { id: 5, name: 'Wingtip Labs', plan: 'free', seats: 1 },
]

const columns: DataTableColumn<Account>[] = [
  { key: 'name', title: '名称', dataIndex: 'name' },
  { key: 'plan', title: '套餐', dataIndex: 'plan', width: 110, render: (plan) => PLAN_OPTIONS.find((o) => o.value === plan)?.label },
  { key: 'seats', title: '席位', dataIndex: 'seats', width: 80, align: 'right', className: 'tabular-nums' },
]

export default function InstantFilters() {
  const { t } = useTranslation()
  const [keyword, setKeyword] = useState('')
  const [plan, setPlan] = useState('')
  // Local data filters as you type, so there's no search button: FilterBar gets only onReset
  const rows = ACCOUNTS.filter(
    (account) => account.name.toLowerCase().includes(keyword.trim().toLowerCase()) && (!plan || account.plan === plan),
  )

  return (
    <div>
      <FilterBar
        onReset={
          keyword || plan
            ? () => {
                setKeyword('')
                setPlan('')
              }
            : undefined
        }
        extra={<span className="text-muted-foreground text-xs tabular-nums">{t('共 {{count}} 条', { count: rows.length })}</span>}
      >
        <SearchInput value={keyword} onChange={setKeyword} placeholder="搜索名称" />
        <FilterSelect value={plan} onChange={setPlan} options={PLAN_OPTIONS} placeholder="套餐" />
      </FilterBar>
      <DataTable columns={columns} data={rows} dense />
    </div>
  )
}
