import { useFieldArray, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ArrowDown, ArrowUp, GripVertical, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { EMPTY_FIELD_ROW, FIELD_TYPE_OPTIONS, MAX_FIELDS } from '@/modules/component_center/pages/admin/dynamic_form_page/constants'
import { DatePicker } from '@/shared/components/DatePicker'

const GRID = 'sm:grid-cols-[20px_minmax(0,3fr)_minmax(0,4fr)_minmax(0,2fr)_minmax(0,3fr)_56px]'
// i18n-ignore-next-line: accepted truthy input tokens, not UI copy
const TRUE_VALUES = new Set(['true', '1', 'yes', 'y', 'on', '是'])

/** Field value input: the control switches by type; values are always stored as strings (matches the backend field_value text column) */
function ValueInput({ type, field, invalid }) {
  const { t } = useTranslation()
  if (type === 'boolean') {
    const checked = TRUE_VALUES.has(String(field.value ?? '').trim().toLowerCase())
    return (
      <div className="flex h-9 items-center gap-2 px-1">
        <Switch checked={checked} onCheckedChange={(v) => field.onChange(v ? 'true' : 'false')} aria-label={t('字段值')} />
        <span className="text-muted-foreground font-mono text-xs">{checked ? 'true' : 'false'}</span>
      </div>
    )
  }
  if (type === 'date') {
    return <DatePicker value={field.value || ''} onChange={(v) => field.onChange(v || '')} placeholder="选择日期" />
  }
  return (
    <Input
      {...field}
      value={field.value ?? ''}
      inputMode={type === 'number' ? 'decimal' : undefined}
      placeholder={t(type === 'number' ? '数字' : '字段值')}
      aria-invalid={invalid || undefined}
      className={cn('h-9', type === 'number' && 'font-mono tabular-nums')}
    />
  )
}

function SortableRow({ id, index, count, control, onRemove, onMove }) {
  const { t } = useTranslation()
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id })
  const type = useWatch({ control, name: `fields.${index}.field_type` })

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'bg-card animate-in fade-in-0 slide-in-from-top-1 grid grid-cols-[20px_minmax(0,1fr)] gap-x-2 gap-y-2 rounded-lg border p-2.5 duration-200 sm:items-start sm:rounded-md sm:border-0 sm:p-1.5',
        GRID,
        isDragging ? 'ring-primary/30 relative z-10 shadow-lg ring-2' : 'sm:hover:bg-muted/40',
      )}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={t('拖动排序第 {{n}} 行', { n: index + 1 })}
        className="text-muted-foreground hover:text-foreground row-span-4 flex h-9 cursor-grab touch-none items-center justify-center rounded active:cursor-grabbing sm:row-span-1"
      >
        <GripVertical className="size-4" />
      </button>

      <FormField
        control={control}
        name={`fields.${index}.field_key`}
        rules={{ required: '必填' }}
        render={({ field, fieldState }) => (
          <FormItem className="gap-1">
            <FormControl>
              <Input {...field} value={field.value ?? ''} placeholder={t('字段键')} aria-invalid={fieldState.invalid || undefined} className="h-9 font-mono" />
            </FormControl>
            <FormMessage className="text-xs" />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name={`fields.${index}.field_value`}
        rules={{
          validate: (v) => (type === 'number' && String(v ?? '').trim() !== '' && !Number.isFinite(Number(v)) ? '请输入有效数字' : true),
        }}
        render={({ field, fieldState }) => (
          <FormItem className="gap-1">
            <FormControl>
              <div>
                <ValueInput type={type} field={field} invalid={fieldState.invalid} />
              </div>
            </FormControl>
            <FormMessage className="text-xs" />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name={`fields.${index}.field_type`}
        render={({ field }) => (
          <FormItem className="gap-1">
            <Select value={field.value || 'text'} onValueChange={field.onChange}>
              <FormControl>
                <SelectTrigger className="h-9 w-full" aria-label={t('字段类型')}>
                  <SelectValue />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {FIELD_TYPE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {t(o.label)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name={`fields.${index}.remark`}
        render={({ field }) => (
          <FormItem className="gap-1">
            <FormControl>
              <Input {...field} value={field.value ?? ''} placeholder={t('备注')} className="h-9" />
            </FormControl>
          </FormItem>
        )}
      />

      <div className="col-start-2 flex items-center justify-end gap-0.5 sm:col-start-auto sm:h-9">
        <Button type="button" variant="ghost" size="icon" className="size-7 sm:hidden" disabled={index === 0} onClick={() => onMove(index, index - 1)} aria-label={t('上移')}>
          <ArrowUp className="size-3.5" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className="size-7 sm:hidden" disabled={index === count - 1} onClick={() => onMove(index, index + 1)} aria-label={t('下移')}>
          <ArrowDown className="size-3.5" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className="text-muted-foreground hover:text-danger size-7" onClick={() => onRemove(index)} aria-label={t('移除')} title={t('移除')}>
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    </li>
  )
}

/**
 * Dynamic-field sub-table editor (react-hook-form useFieldArray): add / remove, drag or keyboard reordering
 * (focus the handle, then Space + arrow keys), and a value control that switches by type.
 * On submit the page writes sort_order from the current order.
 */
export default function FieldRowsEditor({ control }) {
  const { t } = useTranslation()
  const { fields, append, remove, move } = useFieldArray({ control, name: 'fields' })
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const full = fields.length >= MAX_FIELDS

  const handleDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return
    const from = fields.findIndex((f) => f.id === active.id)
    const to = fields.findIndex((f) => f.id === over.id)
    if (from >= 0 && to >= 0) move(from, to)
  }

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
          <div className={cn('text-muted-foreground bg-muted/40 hidden gap-x-2 border-b px-1.5 py-2 text-xs sm:grid', GRID)}>
            <span />
            <span>
              {t('字段键')} <span className="text-destructive">*</span>
            </span>
            <span>{t('字段值')}</span>
            <span>{t('类型')}</span>
            <span>{t('备注')}</span>
            <span />
          </div>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
              <ul className="space-y-2 sm:space-y-0.5 sm:p-1">
                {fields.map((f, index) => (
                  <SortableRow key={f.id} id={f.id} index={index} count={fields.length} control={control} onRemove={remove} onMove={move} />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
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
