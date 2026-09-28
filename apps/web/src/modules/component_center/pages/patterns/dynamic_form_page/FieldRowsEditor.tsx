import type { ComponentProps } from 'react'
import { useFieldArray, useWatch, type ControllerRenderProps, type UseFormReturn } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import {
  EMPTY_FIELD_ROW,
  FIELD_TYPE_OPTIONS,
  FIELD_TYPES,
  MAX_FIELDS,
  type FieldType,
  type FormValues,
} from '@/modules/component_center/pages/patterns/dynamic_form_page/form'
import { DatePicker } from '@/shared/components/DatePicker'

const GRID = 'sm:grid-cols-[minmax(0,3fr)_minmax(0,2fr)_minmax(0,4fr)_32px]'

const isFieldType = (value: string): value is FieldType => FIELD_TYPES.some((type) => type === value)

/** What FormControl passes on (the control's id, its description / error and invalid state) */
type ControlProps = Pick<ComponentProps<'button'>, 'id' | 'aria-describedby' | 'aria-invalid'>

interface ValueInputProps extends ControlProps {
  type: FieldType
  field: ControllerRenderProps<FormValues, `fields.${number}.value`>
}

/** The value control follows the row's type; every control reads and writes the row's text value */
function ValueInput({ type, field: { ref, ...field }, ...control }: ValueInputProps) {
  const { t } = useTranslation()
  if (type === 'boolean') {
    return (
      <div className="flex h-9 items-center px-1">
        <Switch
          {...control}
          ref={ref}
          checked={field.value === 'true'}
          onCheckedChange={(checked) => field.onChange(checked ? 'true' : 'false')}
          aria-label={t('字段值')}
        />
      </div>
    )
  }
  if (type === 'date') {
    return <DatePicker {...control} ref={ref} value={field.value} onChange={(value) => field.onChange(value || '')} aria-label={t('字段值')} />
  }
  return (
    <Input
      {...field}
      {...control}
      ref={ref}
      inputMode={type === 'number' ? 'decimal' : undefined}
      placeholder={t(type === 'number' ? '数字' : '字段值')}
      aria-label={t('字段值')}
      className={cn('h-9', type === 'number' && 'font-mono tabular-nums')}
    />
  )
}

interface FieldRowProps {
  index: number
  /** Number of rows (the other rows' keys are revalidated when this one changes) */
  count: number
  form: UseFormReturn<FormValues>
  onRemove: (index: number) => void
}

function FieldRow({ index, count, form, onRemove }: FieldRowProps) {
  const { t } = useTranslation()
  const type = useWatch({ control: form.control, name: `fields.${index}.type` })

  return (
    <li className={cn('bg-card grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2 rounded-lg border p-2.5 sm:items-start sm:rounded-md sm:border-0 sm:p-1.5 sm:hover:bg-muted/40', GRID)}>
      <FormField
        control={form.control}
        name={`fields.${index}.key`}
        rules={{
          required: '请输入字段名',
          validate: (value, values) => values.fields.filter((row) => row.key.trim() === value.trim()).length === 1 || '字段名重复',
          // Renaming this row can fix (or cause) a duplicate in another row; react-hook-form runs deps after the first submit
          deps: Array.from({ length: count }, (_, i) => `fields.${i}.key` as const).filter((_, i) => i !== index),
        }}
        render={({ field }) => (
          <FormItem className="gap-1">
            <FormControl>
              <Input {...field} placeholder={t('字段名')} aria-label={t('字段名')} className="h-9" />
            </FormControl>
            <FormMessage className="text-xs" />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name={`fields.${index}.type`}
        render={({ field }) => (
          <FormItem className="gap-1">
            <Select
              value={field.value}
              onValueChange={(next) => {
                if (!isFieldType(next)) return
                field.onChange(next)
                // A value typed for the old control (e.g. text in a number row) doesn't carry over
                form.setValue(`fields.${index}.value`, next === 'boolean' ? 'false' : '')
              }}
            >
              <FormControl>
                <SelectTrigger className="h-9 w-full" aria-label={t('字段类型')}>
                  <SelectValue />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {FIELD_TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {t(option.label)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name={`fields.${index}.value`}
        rules={{
          validate: (value) => (type === 'number' && value.trim() !== '' && !Number.isFinite(Number(value)) ? '请输入有效数字' : true),
        }}
        render={({ field }) => (
          <FormItem className="gap-1">
            <FormControl>
              <ValueInput type={type} field={field} />
            </FormControl>
            <FormMessage className="text-xs" />
          </FormItem>
        )}
      />

      <div className="flex items-center justify-end sm:h-9">
        <Button type="button" variant="ghost" size="icon" className="text-muted-foreground hover:text-danger size-7" onClick={() => onRemove(index)} aria-label={t('移除')} title={t('移除')}>
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    </li>
  )
}

export interface FieldRowsEditorProps {
  form: UseFormReturn<FormValues>
}

/**
 * The dynamic field rows of the record form (react-hook-form useFieldArray on `fields`): add / remove rows, a required
 * and unique name per row, a value control that follows the row's type (with number validation).
 */
export default function FieldRowsEditor({ form }: FieldRowsEditorProps) {
  const { t } = useTranslation()
  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'fields' })
  const full = fields.length >= MAX_FIELDS

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{t('动态字段')}</span>
          <span className={cn('rounded-md px-1.5 text-xs leading-5 tabular-nums', full ? 'bg-warning-soft text-warning' : 'bg-muted text-muted-foreground')}>
            {fields.length} / {MAX_FIELDS}
          </span>
        </div>
        <Button type="button" variant="outline" size="sm" className="h-8" disabled={full} onClick={() => append({ ...EMPTY_FIELD_ROW })}>
          <Plus />
          {t('添加字段')}
        </Button>
      </div>

      {fields.length > 0 ? (
        <div className="sm:rounded-lg sm:border">
          <div className={cn('text-muted-foreground bg-muted/40 hidden gap-x-2 border-b px-2.5 py-2 text-xs sm:grid', GRID)}>
            <span>
              {t('字段名')} <span className="text-destructive">*</span>
            </span>
            <span>{t('类型')}</span>
            <span>{t('字段值')}</span>
            <span />
          </div>
          <ul className="space-y-2 sm:space-y-0.5 sm:p-1">
            {fields.map((row, index) => (
              <FieldRow key={row.id} index={index} count={fields.length} form={form} onRemove={remove} />
            ))}
          </ul>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => append({ ...EMPTY_FIELD_ROW })}
          className="text-muted-foreground hover:border-primary/60 hover:bg-muted/40 hover:text-foreground flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed py-6 text-[13px] transition-colors"
        >
          <Plus className="size-4" />
          {t('点击添加第一个字段')}
        </button>
      )}
    </div>
  )
}
