import { useState } from 'react'
import { format, isValid, parse } from 'date-fns'
import { CalendarDays, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { useTx } from '@/i18n'
import { dateLocale } from '@/i18n/date-locale'
import { useTranslation } from 'react-i18next'

function toDate(value) {
  if (!value || typeof value !== 'string') return undefined
  const d = parse(value.slice(0, 10), 'yyyy-MM-dd', new Date())
  return isValid(d) ? d : undefined
}

/** 日期选择：value / onChange 使用 'YYYY-MM-DD' 字符串（空为 ''） */
export function DatePicker({ value, onChange, placeholder = '选择日期', disabled, className, clearable = true }) {
  const { i18n } = useTranslation()
  const tx = useTx()
  const [open, setOpen] = useState(false)
  const selected = toDate(value)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            'h-9 w-full justify-start px-3 text-left font-normal',
            !selected && 'text-muted-foreground',
            className,
          )}
        >
          <CalendarDays className="text-muted-foreground" />
          <span className="flex-1 truncate">{selected ? format(selected, 'yyyy-MM-dd') : tx(placeholder)}</span>
          {clearable && selected && !disabled ? (
            <span
              role="button"
              tabIndex={-1}
              aria-label={tx('清空')}
              onClick={(e) => {
                e.stopPropagation()
                onChange?.('')
              }}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
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

/** 日期时间：value / onChange 使用 'YYYY-MM-DD HH:mm:ss'（也接受 ISO 'YYYY-MM-DDTHH:mm:ss'） */
export function DateTimePicker({ value, onChange, disabled, className }) {
  const text = typeof value === 'string' ? value.replace('T', ' ') : ''
  const datePart = text.slice(0, 10)
  const timePart = text.length >= 16 ? text.slice(11, 19).padEnd(8, ':00').slice(0, 8) : ''
  const emit = (d, t) => {
    if (!d) return onChange?.('')
    return onChange?.(`${d} ${t || '00:00:00'}`)
  }
  return (
    <div className={cn('flex gap-2', className)}>
      <DatePicker
        value={datePart}
        disabled={disabled}
        onChange={(d) => emit(d, timePart)}
        className="flex-1"
        clearable
      />
      <Input
        type="time"
        step={1}
        disabled={disabled || !datePart}
        value={timePart}
        onChange={(e) => emit(datePart, e.target.value.length === 5 ? `${e.target.value}:00` : e.target.value)}
        className="h-9 w-32 font-mono text-[13px]"
      />
    </div>
  )
}
