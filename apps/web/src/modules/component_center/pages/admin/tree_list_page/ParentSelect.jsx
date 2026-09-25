import { useMemo, useState } from 'react'
import { Check, ChevronsUpDown, CornerDownRight, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

/** 平铺树（深度优先），用于下拉缩进展示；excludeIds 命中的节点连同整棵子树一起跳过 */
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
 * 树形父节点选择：可搜索、按层级缩进、可清空（清空 = 作为根节点）。
 * value 为节点 id（number）或 null；excludeId 用于编辑时排除自身及其子孙，防止形成环。
 */
export default function ParentSelect({ value, onChange, tree = [], excludeId, placeholder = '不选则作为根节点', disabled }) {
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
          <span className="min-w-0 truncate">{hasValue ? current?.path || `节点 #${value}` : placeholder}</span>
          <span className="flex shrink-0 items-center gap-1">
            {hasValue && !disabled ? (
              <span
                role="button"
                tabIndex={-1}
                aria-label="清空"
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
          <CommandInput placeholder="搜索节点名称 / 编码" className="h-9 text-[13px]" />
          <CommandList className="max-h-64">
            <CommandEmpty>没有匹配的节点</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="__root__ 根节点"
                onSelect={() => {
                  onChange?.(null)
                  setOpen(false)
                }}
                className="text-[13px]"
              >
                <span className="text-muted-foreground flex-1">（无）作为根节点</span>
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
