import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, ChevronsUpDown, CornerDownRight, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

/** Flatten the tree depth-first for the indented dropdown; nodes in excludeIds are skipped along with their whole subtree */
function flatten(nodes, excludeIds, depth = 0, path = [], out = []) {
  for (const node of nodes || []) {
    if (excludeIds.has(node.id)) continue
    const nextPath = [...path, node.name]
    out.push({ id: node.id, name: node.name, code: node.node_code, depth, path: nextPath.join(' / ') })
    if (node.children?.length) flatten(node.children, excludeIds, depth + 1, nextPath, out)
  }
  return out
}

/**
 * Tree parent picker: searchable, indented by depth, clearable (cleared = root node).
 * value is a node id (number) or null; excludeId excludes a node and its descendants while editing, to prevent cycles.
 */
export default function ParentSelect({ value, onChange, tree = [], excludeId, placeholder = '不选则作为根节点', disabled }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const options = useMemo(() => flatten(tree, new Set(excludeId ? [excludeId] : [])), [tree, excludeId])
  const current = options.find((o) => o.id === value)
  const hasValue = value !== null && value !== undefined && value !== ''

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn('h-9 w-full justify-between px-3 font-normal', !hasValue && 'text-muted-foreground')}
        >
          <span className="min-w-0 truncate">{hasValue ? current?.path || t('节点 #{{id}}', { id: value }) : t(placeholder)}</span>
          <span className="flex shrink-0 items-center gap-1">
            {hasValue && !disabled ? (
              <span
                role="button"
                tabIndex={-1}
                aria-label={t('清空')}
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
          <CommandInput placeholder={t('搜索节点名称 / 编码')} className="h-9 text-[13px]" />
          <CommandList className="max-h-64">
            <CommandEmpty>{t('没有匹配的节点')}</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value={`__root__ ${t('根节点')}`}
                onSelect={() => {
                  onChange?.(null)
                  setOpen(false)
                }}
                className="text-[13px]"
              >
                <span className="text-muted-foreground flex-1">{t('（无）作为根节点')}</span>
                {!hasValue ? <Check className="size-3.5" /> : null}
              </CommandItem>
              {options.map((opt) => (
                <CommandItem
                  key={opt.id}
                  value={`${opt.id} ${opt.name} ${opt.code || ''}`}
                  onSelect={() => {
                    onChange?.(opt.id)
                    setOpen(false)
                  }}
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
