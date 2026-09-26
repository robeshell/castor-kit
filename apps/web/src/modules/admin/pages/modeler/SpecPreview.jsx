import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Form } from '@/components/ui/form'
import DataTable from '@/shared/components/DataTable'
import {
  FormDate,
  FormDateTime,
  FormFileUpload,
  FormImageUpload,
  FormInput,
  FormNumber,
  FormSelect,
  FormSwitch,
  FormTextarea,
} from '@/shared/components/FormFields'
import SegmentedTabs from '@/shared/components/SegmentedTabs'
import StatusBadge from '@/shared/components/StatusBadge'
import { dictLabel, useDictOptions } from '@/shared/hooks/useDictOptions'
import { titleCase } from '@/modules/admin/pages/modeler/spec'

const labelOf = (field) => field.label.trim() || titleCase(field.name) || '—'

/** One form control, as the generated page renders it */
function PreviewField({ field, control, dicts }) {
  const { t } = useTranslation()
  const common = {
    control,
    name: field.key,
    label: labelOf(field),
    rules: field.required ? { required: '此项必填' } : undefined,
  }
  switch (field.type) {
    case 'text':
      return <FormTextarea {...common} />
    case 'int':
      return <FormNumber {...common} step={1} />
    case 'float':
      return <FormNumber {...common} step={0.01} />
    case 'bool':
      return <FormSwitch {...common} />
    case 'date':
      return <FormDate {...common} />
    case 'datetime':
      return <FormDateTime {...common} />
    case 'enum':
      return <FormSelect {...common} options={field.options.filter((o) => o.value).map((o) => ({ value: o.value, label: o.label || o.value }))} clearable={!field.required} />
    case 'dict':
      return <FormSelect {...common} options={dicts[field.dict] ?? []} clearable={!field.required} placeholder={field.dict ? '请选择' : t('选择字典')} />
    case 'image':
      return <FormImageUpload {...common} disabled />
    case 'file':
      return <FormFileUpload {...common} disabled />
    default:
      return <FormInput {...common} />
  }
}

/** Sample value for the list preview */
function sampleOf(field, index) {
  if (field.default !== '') {
    if (field.type === 'bool') return field.default === 'true'
    return field.default
  }
  switch (field.type) {
    case 'int':
      return 12 + index
    case 'float':
      return '1999.00'
    case 'bool':
      return true
    case 'date':
      return '2026-01-15'
    case 'datetime':
      return '2026-01-15 08:30'
    case 'enum':
      return field.options[0]?.value ?? ''
    case 'image':
    case 'file':
      return null
    default:
      return field.label ? `${field.label} 1` : 'A-001'
  }
}

/**
 * What the generated page will look like: the create form (real form components, try the required checks) and the
 * list with one sample row.
 */
export default function SpecPreview({ spec }) {
  const { t } = useTranslation()
  const [tab, setTab] = useState('form')
  const form = useForm({ mode: 'onTouched' })
  const codes = useMemo(() => [...new Set(spec.fields.filter((f) => f.type === 'dict' && f.dict).map((f) => f.dict))], [spec.fields])
  const dicts = useDictOptions(codes)

  const columns = [
    { key: 'id', title: 'ID', dataIndex: 'id', width: 56, className: 'text-muted-foreground tabular-nums' },
    ...spec.fields.map((field) => ({
      key: field.key,
      title: labelOf(field),
      dataIndex: field.key,
      render: (value) => {
        if (field.type === 'bool') {
          return (
            <StatusBadge tone={value ? 'success' : 'neutral'} dot>
              {value ? '是' : '否'}
            </StatusBadge>
          )
        }
        if (field.type === 'enum') return field.options.find((o) => o.value === value)?.label || value
        if (field.type === 'dict') return dictLabel(dicts, field.dict, value)
        if (field.type === 'image' || field.type === 'file') return <span className="text-muted-foreground">—</span>
        return value
      },
    })),
  ]
  const row = Object.fromEntries([['id', 1], ...spec.fields.map((f, i) => [f.key, sampleOf(f, i)])])

  return (
    <div className="space-y-3">
      <SegmentedTabs
        value={tab}
        onChange={setTab}
        items={[
          { value: 'form', label: '新增表单' },
          { value: 'list', label: '列表' },
        ]}
      />
      {tab === 'form' ? (
        <div className="bg-card rounded-lg border p-4">
          <div className="mb-3 text-[15px] font-semibold">{t('新增')}</div>
          <Form {...form}>
            <form className="space-y-4" onSubmit={form.handleSubmit(() => {})} noValidate>
              {spec.fields.map((field) => (
                <PreviewField key={`${field.key}-${field.type}`} field={field} control={form.control} dicts={dicts} />
              ))}
            </form>
          </Form>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="text-[15px] font-semibold">{spec.title || t('（未填写标题）')}</div>
          <DataTable columns={columns} data={[row]} minWidth={Math.max(480, columns.length * 120)} />
        </div>
      )}
    </div>
  )
}
