import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import ConditionBuilder, { type ConditionField, type ConditionTree } from '@/shared/components/ConditionBuilder'

/** The fields a condition can test; the key union types every condition's `field` */
type CustomerField = 'name' | 'city' | 'orders' | 'level' | 'signed_up' | 'verified'

// Labels are Chinese source text, translated by the builder; the type picks the operators and the value editor
const FIELDS: ConditionField<CustomerField>[] = [
  { key: 'name', label: '名称', type: 'text' },
  { key: 'city', label: '城市', type: 'text' },
  { key: 'orders', label: '订单数', type: 'number' },
  {
    key: 'level',
    label: '会员等级',
    type: 'select',
    options: [
      { label: '普通', value: 'basic' },
      { label: '白银', value: 'silver' },
      { label: '黄金', value: 'gold' },
    ],
  },
  { key: 'signed_up', label: '注册日期', type: 'date' },
  { key: 'verified', label: '已认证', type: 'boolean' },
]

export default function BasicUsage() {
  const { t } = useTranslation()
  // Controlled: the page owns the value, which is plain JSON (no ids), ready to save or send
  const [conditions, setConditions] = useState<ConditionTree<CustomerField>>({ logic: 'AND', items: [], groups: [] })

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <ConditionBuilder fields={FIELDS} value={conditions} onChange={setConditions} />
      <div className="min-w-0 space-y-1.5">
        <div className="text-muted-foreground text-xs">{t('当前值')}</div>
        <pre className="bg-muted/40 max-h-80 overflow-auto rounded-lg border p-3 font-mono text-xs leading-relaxed">
          {JSON.stringify(conditions, null, 2)}
        </pre>
      </div>
    </div>
  )
}
