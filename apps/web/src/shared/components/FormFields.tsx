import type { ComponentProps, HTMLInputTypeAttribute, ReactNode } from 'react'
import type {
  Control,
  ControllerFieldState,
  ControllerRenderProps,
  FieldPath,
  FieldPathValue,
  FieldValues,
  RefCallBack,
  UseControllerProps,
} from 'react-hook-form'
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
import MultiSelect, { type MultiSelectOption } from '@/shared/components/MultiSelect'
import TagInput from '@/shared/components/TagInput'
import TreeSelect, { type TreeSelectProps } from '@/shared/components/TreeSelect'
import AvatarUpload, { type AvatarUploadProps } from '@/shared/components/upload/AvatarUpload'
import FileIdUpload, { type FileIdUploadProps } from '@/shared/components/upload/FileIdUpload'

/**
 * react-hook-form form fields (input / select …).
 * Usage: const form = useForm({ defaultValues }), placed inside <FormDialog form={form} …> or <Form {...form}>:
 *   <FormInput control={form.control} name="username" label="用户名" rules={{ required: '请输入用户名' }} />
 * rules match react-hook-form register rules (required / minLength / pattern / validate …).
 * control types the form: name is checked against the form's fields.
 */

/** Value of an option in FormSelect / FormRadioGroup / FormCheckboxGroup / FilterSelect (the original type is kept) */
export type OptionValue = string | number | boolean

export interface SelectOption<V extends OptionValue = OptionValue> {
  /** Chinese source text (translated here) or a node */
  label: ReactNode
  value: V
  disabled?: boolean
}

/** Props every field component takes */
export interface FormFieldProps<TFieldValues extends FieldValues = FieldValues, TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>> {
  /** form.control from useForm() */
  control: Control<TFieldValues>
  name: TName
  /** Chinese source text (translated here) or a node */
  label?: ReactNode
  description?: ReactNode
  /** react-hook-form rules; message strings are translated */
  rules?: UseControllerProps<TFieldValues, TName>['rules']
  className?: string
  /** Shows the required mark (default: whether rules.required is set) */
  required?: boolean
}

type FieldLayout = 'vertical' | 'inline'

/** What the controls below read from the field: the value is whatever the form holds (unknown here) */
interface FieldControl {
  name: string
  value: unknown
  onChange: (value: unknown) => void
  onBlur: () => void
  ref: RefCallBack
  disabled?: boolean
}

/**
 * A form value as a native input shows it: '' for null / undefined, numbers kept (a number input compares them loosely,
 * so "1.0" survives while typing), anything else as React would stringify it
 */
function inputValue(value: unknown): string | number {
  if (value === null || value === undefined) return ''
  return typeof value === 'number' ? value : String(value)
}

const isString = (value: unknown): value is string => typeof value === 'string'

const isStringList = (value: unknown): value is string[] => Array.isArray(value) && value.every(isString)

const isKeyList = (value: unknown): value is (string | number)[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string' || typeof item === 'number')

interface FieldProps<TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>> extends FormFieldProps<TFieldValues, TName> {
  layout?: FieldLayout
  children: (field: ControllerRenderProps<TFieldValues, TName>, fieldState: ControllerFieldState) => ReactNode
}

function Field<TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>>({
  control,
  name,
  label,
  description,
  rules,
  className,
  required,
  children,
  layout = 'vertical',
}: FieldProps<TFieldValues, TName>) {
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

export interface FormInputProps<TFieldValues extends FieldValues = FieldValues, TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>>
  extends FormFieldProps<TFieldValues, TName> {
  placeholder?: string
  type?: HTMLInputTypeAttribute
  disabled?: boolean
  autoComplete?: ComponentProps<'input'>['autoComplete']
  inputClassName?: string
}

export function FormInput<TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>>({
  placeholder,
  type = 'text',
  disabled,
  autoComplete,
  inputClassName,
  ...rest
}: FormInputProps<TFieldValues, TName>) {
  const tx = useTx()
  return (
    <Field {...rest}>
      {(field: FieldControl) => (
        <FormControl>
          <Input
            {...field}
            value={inputValue(field.value)}
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

export interface FormTextareaProps<TFieldValues extends FieldValues = FieldValues, TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>>
  extends FormFieldProps<TFieldValues, TName> {
  placeholder?: string
  /** Visible lines (default 3) */
  rows?: number
  disabled?: boolean
  inputClassName?: string
}

export function FormTextarea<TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>>({
  placeholder,
  rows = 3,
  disabled,
  inputClassName,
  ...rest
}: FormTextareaProps<TFieldValues, TName>) {
  const tx = useTx()
  return (
    <Field {...rest}>
      {(field: FieldControl) => (
        <FormControl>
          <Textarea
            {...field}
            value={inputValue(field.value)}
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
export interface FormNumberProps<TFieldValues extends FieldValues = FieldValues, TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>>
  extends FormFieldProps<TFieldValues, TName> {
  placeholder?: string
  min?: number | string
  max?: number | string
  step?: number | string
  disabled?: boolean
}

export function FormNumber<TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>>({
  placeholder,
  min,
  max,
  step,
  disabled,
  ...rest
}: FormNumberProps<TFieldValues, TName>) {
  const tx = useTx()
  return (
    <Field {...rest}>
      {(field: FieldControl) => (
        <FormControl>
          <Input
            name={field.name}
            ref={field.ref}
            onBlur={field.onBlur}
            type="number"
            inputMode="decimal"
            value={inputValue(field.value)}
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
export interface FormSelectProps<TFieldValues extends FieldValues = FieldValues, TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>>
  extends FormFieldProps<TFieldValues, TName> {
  options?: readonly SelectOption[]
  /** Chinese source text (translated here); also the label of the "none" item */
  placeholder?: string
  disabled?: boolean
  /** Adds a "none" item that sets null */
  clearable?: boolean
}

export function FormSelect<TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>>({
  options = [],
  placeholder = '请选择',
  disabled,
  clearable = false,
  ...rest
}: FormSelectProps<TFieldValues, TName>) {
  const tx = useTx()
  const NONE = '__none__'
  return (
    <Field {...rest}>
      {(field: FieldControl) => (
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

export interface FormMultiSelectProps<TFieldValues extends FieldValues = FieldValues, TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>>
  extends FormFieldProps<TFieldValues, TName> {
  options?: readonly MultiSelectOption[]
  placeholder?: string
  disabled?: boolean
}

export function FormMultiSelect<TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>>({
  options = [],
  placeholder,
  disabled,
  ...rest
}: FormMultiSelectProps<TFieldValues, TName>) {
  return (
    <Field {...rest}>
      {(field: FieldControl) => (
        <FormControl>
          <MultiSelect
            value={isKeyList(field.value) ? field.value : []}
            onChange={field.onChange}
            options={options}
            placeholder={placeholder}
            disabled={disabled}
          />
        </FormControl>
      )}
    </Field>
  )
}

/** Tree select (single pick): tree = [{ id, name, code?, children? }]; see TreeSelect for the other props */
export interface FormTreeSelectProps<TFieldValues extends FieldValues = FieldValues, TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>>
  extends FormFieldProps<TFieldValues, TName>,
    Pick<TreeSelectProps, 'tree' | 'placeholder' | 'disabled' | 'excludeId' | 'noneLabel' | 'searchPlaceholder' | 'emptyText'> {}

export function FormTreeSelect<TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>>({
  tree = [],
  placeholder,
  disabled,
  excludeId,
  noneLabel,
  searchPlaceholder,
  emptyText,
  ...rest
}: FormTreeSelectProps<TFieldValues, TName>) {
  return (
    <Field {...rest}>
      {(field: FieldControl) => (
        <FormControl>
          <TreeSelect
            value={isString(field.value) || typeof field.value === 'number' ? field.value : null}
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

/** File upload stored as file-center id(s): a single id (or null), or an array with `multiple` */
export interface FormFileUploadProps<TFieldValues extends FieldValues = FieldValues, TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>>
  extends FormFieldProps<TFieldValues, TName>,
    Pick<FileIdUploadProps, 'multiple' | 'accept' | 'maxSizeMB' | 'disabled' | 'variant'> {}

export function FormFileUpload<TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>>({
  multiple,
  accept,
  maxSizeMB,
  disabled,
  variant = 'file',
  ...rest
}: FormFileUploadProps<TFieldValues, TName>) {
  return (
    <Field {...rest}>
      {(field: FieldControl) => (
        <FileIdUpload
          value={isString(field.value) || isStringList(field.value) ? field.value : null}
          onChange={field.onChange}
          variant={variant}
          multiple={multiple}
          accept={accept}
          maxSizeMB={maxSizeMB}
          disabled={disabled}
        />
      )}
    </Field>
  )
}

export type FormImageUploadProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> = Omit<FormFileUploadProps<TFieldValues, TName>, 'variant'>

/** Image upload with thumbnails, stored as file-center id(s) */
export function FormImageUpload<TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>>(props: FormImageUploadProps<TFieldValues, TName>) {
  return <FormFileUpload variant="image" {...props} />
}

/** Avatar: value is the image URL (uploads become /api/admin/files/<id>); displayName feeds the fallback letter */
export interface FormAvatarUploadProps<TFieldValues extends FieldValues = FieldValues, TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>>
  extends FormFieldProps<TFieldValues, TName>,
    Pick<AvatarUploadProps, 'maxSizeMB' | 'disabled'> {
  /** Name the fallback letter comes from */
  displayName?: AvatarUploadProps['name']
}

export function FormAvatarUpload<TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>>({
  displayName,
  maxSizeMB,
  disabled,
  ...rest
}: FormAvatarUploadProps<TFieldValues, TName>) {
  return (
    <Field {...rest}>
      {(field: FieldControl) => (
        <FormControl>
          <AvatarUpload
            value={isString(field.value) ? field.value : null}
            onChange={field.onChange}
            name={displayName}
            maxSizeMB={maxSizeMB}
            disabled={disabled}
          />
        </FormControl>
      )}
    </Field>
  )
}

/** Switch: inline card layout by default (label left, switch right) */
export interface FormSwitchProps<TFieldValues extends FieldValues = FieldValues, TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>>
  extends FormFieldProps<TFieldValues, TName> {
  disabled?: boolean
  /** inline (default): label left, switch right, in a bordered row */
  layout?: FieldLayout
}

export function FormSwitch<TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>>({
  disabled,
  layout = 'inline',
  ...rest
}: FormSwitchProps<TFieldValues, TName>) {
  return (
    <Field layout={layout} {...rest}>
      {(field: FieldControl) => (
        <FormControl>
          <Switch checked={Boolean(field.value)} onCheckedChange={field.onChange} disabled={disabled} />
        </FormControl>
      )}
    </Field>
  )
}

export interface FormRadioGroupProps<TFieldValues extends FieldValues = FieldValues, TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>>
  extends FormFieldProps<TFieldValues, TName> {
  options?: readonly SelectOption[]
  disabled?: boolean
  direction?: 'horizontal' | 'vertical'
}

export function FormRadioGroup<TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>>({
  options = [],
  disabled,
  direction = 'horizontal',
  ...rest
}: FormRadioGroupProps<TFieldValues, TName>) {
  const tx = useTx()
  return (
    <Field {...rest}>
      {(field: FieldControl) => (
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

export interface FormCheckboxGroupProps<TFieldValues extends FieldValues = FieldValues, TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>>
  extends FormFieldProps<TFieldValues, TName> {
  options?: readonly SelectOption[]
  disabled?: boolean
  /** Grid columns (default 2) */
  columns?: number
}

export function FormCheckboxGroup<TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>>({
  options = [],
  disabled,
  columns = 2,
  ...rest
}: FormCheckboxGroupProps<TFieldValues, TName>) {
  const tx = useTx()
  return (
    <Field {...rest}>
      {(field: FieldControl) => {
        const value: unknown[] = Array.isArray(field.value) ? field.value : []
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

export interface FormDateProps<TFieldValues extends FieldValues = FieldValues, TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>>
  extends FormFieldProps<TFieldValues, TName> {
  placeholder?: string
  disabled?: boolean
}

export function FormDate<TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>>({
  placeholder,
  disabled,
  ...rest
}: FormDateProps<TFieldValues, TName>) {
  return (
    <Field {...rest}>
      {(field: FieldControl) => (
        <FormControl>
          <DatePicker value={isString(field.value) ? field.value : ''} onChange={field.onChange} placeholder={placeholder} disabled={disabled} />
        </FormControl>
      )}
    </Field>
  )
}

export interface FormDateTimeProps<TFieldValues extends FieldValues = FieldValues, TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>>
  extends FormFieldProps<TFieldValues, TName> {
  disabled?: boolean
}

export function FormDateTime<TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>>({
  disabled,
  ...rest
}: FormDateTimeProps<TFieldValues, TName>) {
  return (
    <Field {...rest}>
      {(field: FieldControl) => (
        <FormControl>
          <DateTimePicker value={isString(field.value) ? field.value : ''} onChange={field.onChange} disabled={disabled} />
        </FormControl>
      )}
    </Field>
  )
}

export interface FormTagsProps<TFieldValues extends FieldValues = FieldValues, TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>>
  extends FormFieldProps<TFieldValues, TName> {
  placeholder?: string
  disabled?: boolean
}

export function FormTags<TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>>({
  placeholder,
  disabled,
  ...rest
}: FormTagsProps<TFieldValues, TName>) {
  return (
    <Field {...rest}>
      {(field: FieldControl) => (
        <FormControl>
          <TagInput value={isStringList(field.value) ? field.value : []} onChange={field.onChange} placeholder={placeholder} disabled={disabled} />
        </FormControl>
      )}
    </Field>
  )
}

/** What FormCustom's render gets: the field typed from the form */
export interface FormCustomRenderProps<TFieldValues extends FieldValues = FieldValues, TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>> {
  value: FieldPathValue<TFieldValues, TName>
  onChange: ControllerRenderProps<TFieldValues, TName>['onChange']
  field: ControllerRenderProps<TFieldValues, TName>
  fieldState: ControllerFieldState
}

export interface FormCustomProps<TFieldValues extends FieldValues = FieldValues, TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>>
  extends FormFieldProps<TFieldValues, TName> {
  render: (props: FormCustomRenderProps<TFieldValues, TName>) => ReactNode
}

/** Custom control: render({ value, onChange, field, fieldState }) */
export function FormCustom<TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>>({ render, ...rest }: FormCustomProps<TFieldValues, TName>) {
  return <Field {...rest}>{(field, fieldState) => render({ value: field.value, onChange: field.onChange, field, fieldState })}</Field>
}

export interface FormGridProps {
  /** Columns from the sm breakpoint up (default 2) */
  columns?: 1 | 2 | 3
  className?: string
  children?: ReactNode
}

/** Two-column layout container (automatically single column on mobile) */
export function FormGrid({ columns = 2, className, children }: FormGridProps) {
  return (
    <div className={cn('grid gap-4', columns === 2 && 'sm:grid-cols-2', columns === 3 && 'sm:grid-cols-3', className)}>
      {children}
    </div>
  )
}
