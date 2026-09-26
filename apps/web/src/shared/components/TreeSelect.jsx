import { useMemo, useState } from 'react'
import { Check, ChevronsUpDown, CornerDownRight, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useTx } from '@/i18n'
import { cn } from '@/lib/utils'

/** Flatten the tree depth-first for the indented list; nodes in excludeIds are skipped along with their whole subtree */
function flattenTree(nodes, { excludeIds = new Set(), codeKey = 'code' } = {}, depth = 0, path = [], out = []) {
  for (const node of nodes || []) {
    if (excludeIds.has(node.id)) continue
    const nextPath = [...path, node.name]
    out.push({ id: node.id, name: node.name, code: node[codeKey], depth, path: nextPath.join(' / '), disabled: node.disabled })
    if (node.children?.length) flattenTree(node.children, { excludeIds, codeKey }, depth + 1, nextPath, out)
  }
  return out
}

/**
 * Single-pick tree select: searchable (name / code), indented by depth, clearable.
 * - tree: [{ id, name, code?, children? }]; value is a node id or null
 * - excludeId: hides a node and its descendants (e.g. picking a new parent while editing, to prevent cycles)
 * - noneLabel: when set, adds a first option that picks null (e.g. "(none) top level")
 * Extra props (id / aria-*) go to the trigger button, so it works inside FormControl.
 */
export default function TreeSelect({
  value,
  onChange,
  tree = [],
  excludeId,
  codeKey = 'code',
  placeholder = '请选择',
  searchPlaceholder = '搜索名称 / 编码',
  emptyText = '没有匹配的项',
  noneLabel,
  clearable = true,
  disabled,
  className,
  ...triggerProps
}) {
  const tx = useTx()
  const [open, setOpen] = useState(false)
  const options = useMemo(
    () => flattenTree(tree, { excludeIds: new Set(excludeId ? [excludeId] : []), codeKey }),
    [tree, excludeId, codeKey],
  )
  const hasValue = value !== null && value !== undefined && value !== ''
  const current = hasValue ? options.find((o) => o.id === value) : undefined
  const pick = (id) => {
    onChange?.(id)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          {...triggerProps}
          className={cn('h-9 w-full justify-between px-3 font-normal', !hasValue && 'text-muted-foreground', className)}
        >
          <span className="min-w-0 truncate">{hasValue ? current?.path || `#${value}` : tx(placeholder)}</span>
          <span className="flex shrink-0 items-center gap-1">
            {hasValue && clearable && !disabled ? (
              <span
                role="button"
                tabIndex={-1}
                aria-label={tx('清空')}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation()
                  onChange?.(null)
                }}
                className="text-muted-foreground hover:text-foreground rounded p-0.5"
              >
                <X className="size-3.5" />
              </span>
            ) : null}
            <ChevronsUpDown className="text-muted-foreground size-3.5" />
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) min-w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder={tx(searchPlaceholder)} className="h-9 text-[13px]" />
          <CommandList className="max-h-64">
            <CommandEmpty>{tx(emptyText)}</CommandEmpty>
            <CommandGroup>
              {noneLabel ? (
                <CommandItem value={`__none__ ${tx(noneLabel)}`} onSelect={() => pick(null)} className="text-[13px]">
                  <span className="text-muted-foreground flex-1">{tx(noneLabel)}</span>
                  {!hasValue ? <Check className="size-3.5" /> : null}
                </CommandItem>
              ) : null}
              {options.map((opt) => (
                <CommandItem
                  key={opt.id}
                  value={`${opt.id} ${opt.name} ${opt.code || ''}`}
                  disabled={opt.disabled}
                  onSelect={() => pick(opt.id)}
                  className="text-[13px]"
                >
                  <span className="flex min-w-0 flex-1 items-center gap-1.5" style={{ paddingLeft: opt.depth * 14 }}>
                    {opt.depth > 0 ? <CornerDownRight className="text-muted-foreground/70 size-3 shrink-0" /> : null}
                    <span className="truncate">{opt.name}</span>
                    {opt.code ? <span className="text-muted-foreground truncate font-mono text-[11px]">{opt.code}</span> : null}
                  </span>
                  {value === opt.id ? <Check className="size-3.5" /> : null}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
