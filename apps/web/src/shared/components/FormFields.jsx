import { Checkbox } from '@/components/ui/checkbox'
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { useTx } from '@/i18n'
import { cn } from '@/lib/utils'
import { DatePicker, DateTimePicker } from '@/shared/components/DatePicker'
import MultiSelect from '@/shared/components/MultiSelect'
import TagInput from '@/shared/components/TagInput'
import TreeSelect from '@/shared/components/TreeSelect'

/**
 * react-hook-form form fields (input / select …).
 * Usage: const form = useForm({ defaultValues }), placed inside <FormDialog form={form} …> or <Form {...form}>:
 *   <FormInput control={form.control} name="username" label="用户名" rules={{ required: '请输入用户名' }} />
 * rules match react-hook-form register rules (required / minLength / pattern / validate …).
 */

function Field({ control, name, label, description, rules, className, required, children, layout = 'vertical' }) {
  const tx = useTx()
  const isRequired = required ?? Boolean(rules?.required)
  return (
    <FormField
      control={control}
      name={name}
      rules={rules}
      render={({ field, fieldState }) => (
        <FormItem
          className={cn(
            layout === 'inline' ? 'flex flex-row items-center justify-between gap-4 rounded-lg border px-3 py-2.5' : 'gap-1.5',
            className,
          )}
        >
          {label ? (
            <div className={cn(layout === 'inline' && 'space-y-0.5')}>
              <FormLabel className="text-[13px] font-medium">
                {tx(label)}
                {isRequired ? <span className="text-destructive -ml-1">*</span> : null}
              </FormLabel>
              {layout === 'inline' && description ? <FormDescription className="text-xs">{tx(description)}</FormDescription> : null}
            </div>
          ) : null}
          {children(field, fieldState)}
          {layout !== 'inline' && description ? <FormDescription className="text-xs">{tx(description)}</FormDescription> : null}
          <FormMessage className="text-xs" />
        </FormItem>
      )}
    />
  )
}

export function FormInput({ placeholder, type = 'text', disabled, autoComplete, inputClassName, ...rest }) {
  const tx = useTx()
  return (
    <Field {...rest}>
      {(field) => (
        <FormControl>
          <Input
            {...field}
            value={field.value ?? ''}
            type={type}
            placeholder={tx(placeholder)}
            disabled={disabled}
            autoComplete={autoComplete}
            className={cn('h-9', inputClassName)}
          />
        </FormControl>
      )}
    </Field>
  )
}

export function FormTextarea({ placeholder, rows = 3, disabled, inputClassName, ...rest }) {
  const tx = useTx()
  return (
    <Field {...rest}>
      {(field) => (
        <FormControl>
          <Textarea
            {...field}
            value={field.value ?? ''}
            rows={rows}
            placeholder={tx(placeholder)}
            disabled={disabled}
            // The base Textarea uses field-sizing-content (grows with content, rows has no effect); in forms it's fixed to rows lines and can be resized manually
            className={cn('field-sizing-fixed min-h-0 resize-y', inputClassName)}
          />
        </FormControl>
      )}
    </Field>
  )
}

/** Number input: empty value is null; anything else is converted to Number */
export function FormNumber({ placeholder, min, max, step, disabled, ...rest }) {
  const tx = useTx()
  return (
    <Field {...rest}>
      {(field) => (
        <FormControl>
          <Input
            name={field.name}
            ref={field.ref}
            onBlur={field.onBlur}
            type="number"
            inputMode="decimal"
            value={field.value === null || field.value === undefined ? '' : field.value}
            onChange={(e) => field.onChange(e.target.value === '' ? null : Number(e.target.value))}
            min={min}
            max={max}
            step={step}
            placeholder={tx(placeholder)}
            disabled={disabled}
            className="h-9 tabular-nums"
          />
        </FormControl>
      )}
    </Field>
  )
}

/** Single select: options = [{ label, value }], keeps value's original type; when clearable, "none" can be selected */
export function FormSelect({ options = [], placeholder = '请选择', disabled, clearable = false, ...rest }) {
  const tx = useTx()
  const NONE = '__none__'
  return (
    <Field {...rest}>
      {(field) => (
        <Select
          value={field.value === null || field.value === undefined || field.value === '' ? (clearable ? NONE : undefined) : String(field.value)}
          onValueChange={(v) => {
            if (v === NONE) return field.onChange(null)
            const opt = options.find((o) => String(o.value) === v)
            field.onChange(opt ? opt.value : v)
          }}
          disabled={disabled}
        >
          <FormControl>
            <SelectTrigger className="h-9 w-full">
              <SelectValue placeholder={tx(placeholder)} />
            </SelectTrigger>
          </FormControl>
          <SelectContent>
            {clearable ? <SelectItem value={NONE}>{tx(placeholder)}</SelectItem> : null}
            {options.map((opt) => (
              <SelectItem key={String(opt.value)} value={String(opt.value)} disabled={opt.disabled}>
                {tx(opt.label)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </Field>
  )
}

export function FormMultiSelect({ options = [], placeholder, disabled, ...rest }) {
  return (
    <Field {...rest}>
      {(field) => (
        <FormControl>
          <MultiSelect value={field.value || []} onChange={field.onChange} options={options} placeholder={placeholder} disabled={disabled} />
        </FormControl>
      )}
    </Field>
  )
}

/** Tree select (single pick): tree = [{ id, name, code?, children? }]; see TreeSelect for the other props */
export function FormTreeSelect({ tree = [], placeholder, disabled, excludeId, noneLabel, searchPlaceholder, emptyText, ...rest }) {
  return (
    <Field {...rest}>
      {(field) => (
        <FormControl>
          <TreeSelect
            value={field.value ?? null}
            onChange={field.onChange}
            tree={tree}
            placeholder={placeholder}
            disabled={disabled}
            excludeId={excludeId}
            noneLabel={noneLabel}
            searchPlaceholder={searchPlaceholder}
            emptyText={emptyText}
          />
        </FormControl>
      )}
    </Field>
  )
}

/** Switch: inline card layout by default (label left, switch right) */
export function FormSwitch({ disabled, layout = 'inline', ...rest }) {
  return (
    <Field layout={layout} {...rest}>
      {(field) => (
        <FormControl>
          <Switch checked={Boolean(field.value)} onCheckedChange={field.onChange} disabled={disabled} />
        </FormControl>
      )}
    </Field>
  )
}

export function FormRadioGroup({ options = [], disabled, direction = 'horizontal', ...rest }) {
  const tx = useTx()
  return (
    <Field {...rest}>
      {(field) => (
        <FormControl>
          <RadioGroup
            value={field.value === null || field.value === undefined ? '' : String(field.value)}
            onValueChange={(v) => {
              const opt = options.find((o) => String(o.value) === v)
              field.onChange(opt ? opt.value : v)
            }}
            disabled={disabled}
            className={cn(direction === 'horizontal' ? 'flex flex-wrap gap-4' : 'grid gap-2')}
          >
            {options.map((opt) => (
              <label key={String(opt.value)} className="flex cursor-pointer items-center gap-2 text-[13px]">
                <RadioGroupItem value={String(opt.value)} />
                {tx(opt.label)}
              </label>
            ))}
          </RadioGroup>
        </FormControl>
      )}
    </Field>
  )
}

export function FormCheckboxGroup({ options = [], disabled, columns = 2, ...rest }) {
  const tx = useTx()
  return (
    <Field {...rest}>
      {(field) => {
        const value = Array.isArray(field.value) ? field.value : []
        return (
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
            {options.map((opt) => {
              const checked = value.some((v) => String(v) === String(opt.value))
              return (
                <label key={String(opt.value)} className="flex cursor-pointer items-center gap-2 text-[13px]">
                  <Checkbox
                    checked={checked}
                    disabled={disabled}
                    onCheckedChange={(c) =>
                      field.onChange(c ? [...value, opt.value] : value.filter((v) => String(v) !== String(opt.value)))
                    }
                  />
                  {tx(opt.label)}
                </label>
              )
            })}
          </div>
        )
      }}
    </Field>
  )
}

export function FormDate({ placeholder, disabled, ...rest }) {
  return (
    <Field {...rest}>
      {(field) => (
        <FormControl>
          <DatePicker value={field.value || ''} onChange={field.onChange} placeholder={placeholder} disabled={disabled} />
        </FormControl>
      )}
    </Field>
  )
}

export function FormDateTime({ disabled, ...rest }) {
  return (
    <Field {...rest}>
      {(field) => (
        <FormControl>
          <DateTimePicker value={field.value || ''} onChange={field.onChange} disabled={disabled} />
        </FormControl>
      )}
    </Field>
  )
}

export function FormTags({ placeholder, disabled, ...rest }) {
  return (
    <Field {...rest}>
      {(field) => (
        <FormControl>
          <TagInput value={field.value || []} onChange={field.onChange} placeholder={placeholder} disabled={disabled} />
        </FormControl>
      )}
    </Field>
  )
}

/** Custom control: render({ value, onChange, field, fieldState }) */
export function FormCustom({ render, ...rest }) {
  return <Field {...rest}>{(field, fieldState) => render({ value: field.value, onChange: field.onChange, field, fieldState })}</Field>
}

/** Two-column layout container (automatically single column on mobile) */
export function FormGrid({ columns = 2, className, children }) {
  return (
    <div className={cn('grid gap-4', columns === 2 && 'sm:grid-cols-2', columns === 3 && 'sm:grid-cols-3', className)}>
      {children}
    </div>
  )
}
