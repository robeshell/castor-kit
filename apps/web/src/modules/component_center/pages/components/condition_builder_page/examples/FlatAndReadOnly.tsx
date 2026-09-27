import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import ConditionBuilder, { type ConditionField, type ConditionTree } from '@/shared/components/ConditionBuilder'

type AlertField = 'metric' | 'value' | 'region'

const FIELDS: ConditionField<AlertField>[] = [
  {
    key: 'metric',
    label: '指标',
    type: 'select',
    options: [
      { label: 'CPU', value: 'cpu' },
      { label: '内存', value: 'memory' },
      { label: '错误率', value: 'error_rate' },
    ],
    // operators narrows the type's list: only exact matches for this field
    operators: ['eq', 'in'],
  },
  // Thresholds only compare upwards or downwards
  { key: 'value', label: '阈值', type: 'number', operators: ['gt', 'gte', 'lt', 'lte'] },
  { key: 'region', label: '区域', type: 'text', operators: ['eq', 'ne'] },
]

export default function FlatAndReadOnly() {
  const { t } = useTranslation()
  const [locked, setLocked] = useState(false)
  const [conditions, setConditions] = useState<ConditionTree<AlertField>>({
    logic: 'OR',
    items: [
      { field: 'metric', operator: 'eq', value: 'cpu' },
      { field: 'value', operator: 'gt', value: 90 },
    ],
    groups: [],
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Switch id="alert-rule-locked" checked={locked} onCheckedChange={setLocked} />
        <Label htmlFor="alert-rule-locked">{t('只读')}</Label>
      </div>
      {/* allowGroups={false}: one flat list; disabled: shown but not editable (e.g. without the edit permission) */}
      <ConditionBuilder fields={FIELDS} value={conditions} onChange={setConditions} allowGroups={false} disabled={locked} />
    </div>
  )
}
