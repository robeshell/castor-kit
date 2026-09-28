import { useState, type ComponentProps, type Ref } from 'react'
import { format, isValid, parse } from 'date-fns'
import { CalendarDays, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { localParts, localToIso, parseApiTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useTx } from '@/i18n'
import { dateLocale } from '@/i18n/date-locale'
import { useTranslation } from 'react-i18next'

function toDate(value: string | null | undefined) {
  if (!value) return undefined
  const d = parse(value.slice(0, 10), 'yyyy-MM-dd', new Date())
  return isValid(d) ? d : undefined
}

/** Passed on to the trigger button, so the picker works inside FormControl (label, description, error, focus on error) */
type TriggerProps = Pick<ComponentProps<'button'>, 'id' | 'onBlur' | 'aria-describedby' | 'aria-invalid' | 'aria-label' | 'aria-labelledby'> & {
  ref?: Ref<HTMLButtonElement>
}

export interface DatePickerProps extends TriggerProps {
  /** 'YYYY-MM-DD' (a longer string is cut to its first 10 characters); '' / null = empty */
  value?: string | null
  /** 'YYYY-MM-DD', or '' when cleared */
  onChange?: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  clearable?: boolean
}

/** Date picker: value / onChange use a 'YYYY-MM-DD' string ('' when empty) */
export function DatePicker({ value, onChange, placeholder = '选择日期', disabled, className, clearable = true, ...triggerProps }: DatePickerProps) {
  const { i18n } = useTranslation()
  const tx = useTx()
  const [open, setOpen] = useState(false)
  const selected = toDate(value)
  const showClear = clearable && selected && !disabled
  return (
    <Popover open={open} onOpenChange={setOpen}>
      {/* The clear button is a sibling of the trigger: a control inside a button is unreachable by keyboard */}
      <div className={cn('relative w-full', className)}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-haspopup="dialog"
            aria-expanded={open}
            // A combobox isn't named by its content: standalone (no id for a <label>, no aria-*), the placeholder names it
            aria-label={triggerProps.id || triggerProps['aria-labelledby'] ? undefined : tx(placeholder)}
            disabled={disabled}
            {...triggerProps}
            className={cn('h-9 w-full justify-start px-3 text-left font-normal', showClear && 'pr-9', !selected && 'text-muted-foreground')}
          >
            <CalendarDays className="text-muted-foreground" />
            <span className="flex-1 truncate">{selected ? format(selected, 'yyyy-MM-dd') : tx(placeholder)}</span>
          </Button>
        </PopoverTrigger>
        {showClear ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={tx('清空')}
            onClick={() => onChange?.('')}
            className="text-muted-foreground hover:text-foreground absolute top-1/2 right-1.5 -translate-y-1/2"
          >
            <X />
          </Button>
        ) : null}
      </div>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          locale={dateLocale(i18n.language)}
          selected={selected}
          defaultMonth={selected}
          captionLayout="dropdown"
          onSelect={(d) => {
            onChange?.(d ? format(d, 'yyyy-MM-dd') : '')
            setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}

export interface DateTimePickerProps extends TriggerProps {
  /** API time (ISO 8601) or '' / null */
  value?: string | null
  /** ISO 8601 with the browser's offset, or '' when cleared */
  onChange?: (value: string) => void
  disabled?: boolean
  className?: string
}

/**
 * Date-time in the browser's time zone. value: an API time (ISO 8601, e.g. `2026-08-01T12:35:48.834152Z`) or '';
 * onChange: ISO 8601 with the browser's offset (`2026-08-01T20:35:48+08:00`), which the API converts to UTC, or ''.
 */
export function DateTimePicker({ value, onChange, disabled, className, ...triggerProps }: DateTimePickerProps) {
  const { t } = useTranslation()
  const ms = parseApiTime(value)
  const { date: datePart, time: timePart } = Number.isNaN(ms) ? { date: '', time: '' } : localParts(ms)
  const emit = (d: string, t: string) => {
    if (!d) return onChange?.('')
    return onChange?.(localToIso(d, t || '00:00:00'))
  }
  return (
    <div className={cn('flex gap-2', className)}>
      <DatePicker
        {...triggerProps}
        value={datePart}
        disabled={disabled}
        onChange={(d) => emit(d, timePart)}
        className="flex-1"
        clearable
      />
      <Input
        type="time"
        aria-label={t('时间')}
        aria-invalid={triggerProps['aria-invalid']}
        step={1}
        disabled={disabled || !datePart}
        value={timePart}
        onChange={(e) => emit(datePart, e.target.value.length === 5 ? `${e.target.value}:00` : e.target.value)}
        className="h-9 w-32 font-mono text-[13px]"
      />
    </div>
  )
}
