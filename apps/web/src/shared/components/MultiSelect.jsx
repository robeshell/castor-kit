import { useState } from 'react'
import { Check, ChevronsUpDown, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { useTx } from '@/i18n'

/**
 * 多选（可搜索）：options = [{ label, value }]，value 为数组（保持原始类型，数字还是数字）。
 */
export default function MultiSelect({ value = [], onChange, options = [], placeholder = '请选择', disabled, className, maxShown = 3 }) {
  const tx = useTx()
  const [open, setOpen] = useState(false)
  const selected = options.filter((o) => value.some((v) => String(v) === String(o.value)))
  const toggle = (opt) => {
    const has = value.some((v) => String(v) === String(opt.value))
    onChange?.(has ? value.filter((v) => String(v) !== String(opt.value)) : [...value, opt.value])
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn('h-auto min-h-9 w-full justify-between px-2 py-1 font-normal', className)}
        >
          <span className="flex flex-1 flex-wrap items-center gap-1">
            {selected.length === 0 ? <span className="text-muted-foreground px-1">{tx(placeholder)}</span> : null}
            {selected.slice(0, maxShown).map((opt) => (
              <Badge key={String(opt.value)} variant="secondary" className="gap-1 rounded-md pr-1 font-normal">
                {tx(opt.label)}
                <span
                  role="button"
                  tabIndex={-1}
                  aria-label={tx('移除 {{name}}', { name: tx(opt.label) })}
                  onClick={(e) => {
                    e.stopPropagation()
                    toggle(opt)
                  }}
                  className="hover:text-foreground text-muted-foreground"
                >
                  <X className="size-3" />
                </span>
              </Badge>
            ))}
            {selected.length > maxShown ? (
              <Badge variant="secondary" className="rounded-md font-normal">
                +{selected.length - maxShown}
              </Badge>
            ) : null}
          </span>
          <ChevronsUpDown className="text-muted-foreground size-4 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
        <Command>
          <CommandInput placeholder={tx('搜索…')} />
          <CommandList>
            <CommandEmpty>{tx('没有匹配项')}</CommandEmpty>
            <CommandGroup>
              {options.map((opt) => {
                const active = value.some((v) => String(v) === String(opt.value))
                return (
                  <CommandItem key={String(opt.value)} value={`${opt.label} ${opt.value}`} onSelect={() => toggle(opt)}>
                    <span
                      className={cn(
                        'flex size-4 items-center justify-center rounded-[4px] border',
                        active ? 'bg-primary border-primary text-primary-foreground' : 'border-input',
                      )}
                    >
                      {active ? <Check className="size-3 text-current" /> : null}
                    </span>
                    {tx(opt.label)}
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
