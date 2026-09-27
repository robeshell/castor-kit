import { useMemo, useState } from 'react'
import type { ComponentProps } from 'react'
import { Check, ChevronsUpDown, CornerDownRight, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useTx } from '@/i18n'
import { cn } from '@/lib/utils'
import type { TreeKey } from '@/shared/components/TreeView'

/**
 * A TreeSelect node: `id` is what gets picked, `name` is shown; the code shown next to it is read from `codeKey`.
 * A type alias (not an interface) so a node reads as a record of its fields, which is how `codeKey` looks one up.
 */
export type TreeSelectNode<Id extends TreeKey = TreeKey> = {
  id: Id
  name: string
  code?: string | null
  disabled?: boolean
  children?: readonly TreeSelectNode<Id>[] | null
}

/** A row of the flattened, indented option list */
interface FlatOption<Id extends TreeKey> {
  id: Id
  name: string
  code: string | number | null
  depth: number
  path: string
  disabled: boolean | undefined
}

interface FlattenOptions<Id extends TreeKey> {
  excludeIds: Set<Id>
  codeKey: string
}

/** Flatten the tree depth-first for the indented list; nodes in excludeIds are skipped along with their whole subtree */
function flattenTree<Id extends TreeKey>(
  nodes: readonly TreeSelectNode<Id>[],
  { excludeIds, codeKey }: FlattenOptions<Id>,
  depth = 0,
  path: string[] = [],
  out: FlatOption<Id>[] = [],
) {
  for (const node of nodes) {
    if (excludeIds.has(node.id)) continue
    const nextPath = [...path, node.name]
    // codeKey names any field of the caller's node type (e.g. node_code)
    const fields: Partial<Record<string, unknown>> = node
    const code = fields[codeKey]
    out.push({
      id: node.id,
      name: node.name,
      code: typeof code === 'string' || typeof code === 'number' ? code : null,
      depth,
      path: nextPath.join(' / '),
      disabled: node.disabled,
    })
    if (node.children?.length) flattenTree(node.children, { excludeIds, codeKey }, depth + 1, nextPath, out)
  }
  return out
}

export interface TreeSelectProps<Id extends TreeKey = TreeKey>
  extends Omit<ComponentProps<typeof Button>, 'value' | 'onChange' | 'type' | 'placeholder' | 'disabled' | 'className'> {
  /** The picked node id; null / undefined / '' = nothing picked */
  value?: Id | '' | null
  onChange?: (id: Id | null) => void
  tree?: readonly TreeSelectNode<Id>[]
  /** Hides this node and its descendants */
  excludeId?: Id | null
  /** Node field shown as the code and matched by the search (default `code`) */
  codeKey?: string
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  /** When set, adds a first option that picks null */
  noneLabel?: string
  clearable?: boolean
  disabled?: boolean
  className?: string
}

/**
 * Single-pick tree select: searchable (name / code), indented by depth, clearable.
 * - tree: [{ id, name, code?, children? }]; value is a node id or null
 * - excludeId: hides a node and its descendants (e.g. picking a new parent while editing, to prevent cycles)
 * - noneLabel: when set, adds a first option that picks null (e.g. "(none) top level")
 * Extra props (id / aria-*) go to the trigger button, so it works inside FormControl.
 */
export default function TreeSelect<Id extends TreeKey>({
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
}: TreeSelectProps<Id>) {
  const tx = useTx()
  const [open, setOpen] = useState(false)
  const options = useMemo(
    () => flattenTree(tree, { excludeIds: new Set(excludeId ? [excludeId] : []), codeKey }),
    [tree, excludeId, codeKey],
  )
  const hasValue = value !== null && value !== undefined && value !== ''
  const current = hasValue ? options.find((o) => o.id === value) : undefined
  const pick = (id: Id | null) => {
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
