import { useId, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ChevronRight } from 'lucide-react'
import { useTx } from '@/i18n'
import { titleIfTruncated } from '@/lib/title-if-truncated'
import { cn } from '@/lib/utils'

export type TreeKey = string | number

/**
 * Node shape shared by TreeView and CheckableTree: key + label + children, plus any fields of your own.
 * Children have the same type as their parent (`this`), so callbacks see your extra fields at every depth:
 *   interface MenuNode extends TreeNode { key: number; label: string; code: string }
 */
export interface TreeNode {
  key: TreeKey
  label?: ReactNode
  children?: readonly this[]
}

export interface TreeViewProps<N extends TreeNode = TreeNode> {
  nodes?: readonly N[]
  /** Highlighted node */
  selectedKey?: N['key']
  /** Row click, or Enter / Space on the focused row */
  onSelect?: (node: N) => void
  /** Row content (default node.label) */
  renderLabel?: (node: N) => ReactNode
  /** Actions shown on hover (or while the row holds focus) at the end of the row */
  renderActions?: (node: N) => ReactNode
  /** Makes the rows checkable: their checked state (true / false / 'mixed'), announced instead of selection */
  checkedState?: (node: N) => boolean | 'mixed'
  /** Uncontrolled: start with every node expanded */
  defaultExpandAll?: boolean
  /** Controlled expanded keys (together with onExpandedChange) */
  expandedKeys?: readonly N['key'][]
  onExpandedChange?: (keys: N['key'][]) => void
  /** Accessible name of the tree (Chinese source text, translated here); or point aria-labelledby at a visible heading */
  'aria-label'?: string
  'aria-labelledby'?: string
  className?: string
}

/** A row that is currently visible (all of its ancestors are expanded) */
interface VisibleRow<N extends TreeNode> {
  node: N
  parentKey: N['key'] | null
}

/**
 * Tree list (ARIA tree pattern). nodes = [{ key, label, children?, …any other fields }]
 *   <TreeView nodes={tree} selectedKey={id} onSelect={(node) => …} aria-label="部门"
 *     renderLabel={(node) => …} renderActions={(node) => …} defaultExpandAll />
 * Keyboard: the tree is one Tab stop; ↑ ↓ move, → expands / enters, ← collapses / goes to the parent,
 * Home / End jump, Enter / Space select (or toggle the check in a checkable tree).
 */
export default function TreeView<N extends TreeNode>({
  nodes = [],
  selectedKey,
  onSelect,
  renderLabel,
  renderActions,
  checkedState,
  defaultExpandAll = false,
  expandedKeys: controlledExpanded,
  onExpandedChange,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  className,
}: TreeViewProps<N>) {
  const tx = useTx()
  const baseId = useId()
  const collectKeys = (list: readonly N[]): N['key'][] => list.flatMap((n) => [n.key, ...collectKeys(n.children || [])])
  const [innerExpanded, setInnerExpanded] = useState(() => new Set(defaultExpandAll ? collectKeys(nodes) : []))
  const expanded = controlledExpanded ? new Set(controlledExpanded) : innerExpanded
  const setExpanded = (next: Set<N['key']>) => {
    if (onExpandedChange) onExpandedChange([...next])
    else setInnerExpanded(next)
  }
  const setOpen = (key: N['key'], open: boolean) => {
    const next = new Set(expanded)
    if (open) next.add(key)
    else next.delete(key)
    setExpanded(next)
  }
  const toggle = (key: N['key']) => setOpen(key, !expanded.has(key))

  // Rows in reading order, for the arrow keys
  const visible: VisibleRow<N>[] = []
  const walk = (list: readonly N[], parentKey: N['key'] | null) =>
    list.forEach((node) => {
      visible.push({ node, parentKey })
      if (node.children?.length && expanded.has(node.key)) walk(node.children, node.key)
    })
  walk(nodes, null)

  // Roving tabindex: one row is tabbable (the last focused one, else the selected one, else the first)
  const [focusKey, setFocusKey] = useState<N['key'] | null>(null)
  const isVisible = (key: N['key'] | null | undefined) => key !== null && key !== undefined && visible.some((row) => row.node.key === key)
  const tabKey = isVisible(focusKey) ? focusKey : isVisible(selectedKey) ? selectedKey : visible[0]?.node.key
  const rowRefs = useRef(new Map<N['key'], HTMLDivElement>())
  const focusRow = (key: N['key'] | null | undefined) => {
    if (key === null || key === undefined) return
    setFocusKey(key)
    rowRefs.current.get(key)?.focus()
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>, node: N) => {
    // Keys typed into a control inside the row (an action button, an input) are that control's
    if (e.target !== e.currentTarget) return
    const index = visible.findIndex((row) => row.node.key === node.key)
    const hasChildren = Boolean(node.children?.length)
    const open = expanded.has(node.key)
    switch (e.key) {
      case 'ArrowDown':
        focusRow(visible[index + 1]?.node.key)
        break
      case 'ArrowUp':
        focusRow(visible[index - 1]?.node.key)
        break
      case 'Home':
        focusRow(visible[0]?.node.key)
        break
      case 'End':
        focusRow(visible.at(-1)?.node.key)
        break
      case 'ArrowRight':
        if (hasChildren && !open) setOpen(node.key, true)
        else if (hasChildren) focusRow(node.children?.[0]?.key)
        break
      case 'ArrowLeft':
        if (hasChildren && open) setOpen(node.key, false)
        else focusRow(visible[index]?.parentKey)
        break
      case 'Enter':
      case ' ':
        onSelect?.(node)
        break
      default:
        return
    }
    e.preventDefault()
  }

  const renderNodes = (list: readonly N[], depth: number): ReactNode =>
    list.map((node, index) => {
      const children = node.children ?? []
      const hasChildren = children.length > 0
      const open = expanded.has(node.key)
      const active = selectedKey !== undefined && node.key === selectedKey
      const labelId = `${baseId}-${String(node.key)}`
      return (
        <li key={node.key} role="none">
          <div
            ref={(el) => {
              if (el) rowRefs.current.set(node.key, el)
              else rowRefs.current.delete(node.key)
            }}
            role="treeitem"
            tabIndex={node.key === tabKey ? 0 : -1}
            aria-labelledby={labelId}
            aria-level={depth + 1}
            aria-setsize={list.length}
            aria-posinset={index + 1}
            aria-expanded={hasChildren ? open : undefined}
            aria-selected={checkedState ? undefined : active}
            aria-checked={checkedState ? checkedState(node) : undefined}
            onClick={() => {
              setFocusKey(node.key)
              onSelect?.(node)
            }}
            onFocus={(e) => {
              if (e.target === e.currentTarget) setFocusKey(node.key)
            }}
            onKeyDown={(e) => onKeyDown(e, node)}
            className={cn(
              'group/tree flex h-8 cursor-pointer items-center gap-1 rounded-md pr-2 text-[13px] transition-colors',
              'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring',
              active ? 'bg-brand-soft text-foreground' : 'hover:bg-muted/60',
            )}
            style={{ paddingLeft: depth * 16 + 4 }}
          >
            {/* Pointer shortcut for expanding; keyboard users use → / ← on the row */}
            <button
              type="button"
              tabIndex={-1}
              aria-hidden
              onClick={(e) => {
                e.stopPropagation()
                if (hasChildren) toggle(node.key)
              }}
              className={cn('text-muted-foreground flex size-5 shrink-0 items-center justify-center rounded', !hasChildren && 'invisible')}
            >
              <ChevronRight className={cn('size-3.5 transition-transform duration-200', open && 'rotate-90')} />
            </button>
            <div id={labelId} className="min-w-0 flex-1 truncate" onMouseEnter={titleIfTruncated}>
              {renderLabel ? renderLabel(node) : node.label}
            </div>
            {renderActions ? (
              <div
                className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover/tree:opacity-100 group-focus-within/tree:opacity-100"
                onClick={(e) => e.stopPropagation()}
              >
                {renderActions(node)}
              </div>
            ) : null}
          </div>
          <AnimatePresence initial={false}>
            {hasChildren && open ? (
              <motion.ul
                role="group"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
                className="overflow-hidden"
              >
                {renderNodes(children, depth + 1)}
              </motion.ul>
            ) : null}
          </AnimatePresence>
        </li>
      )
    })

  return (
    <ul
      role="tree"
      aria-label={ariaLabel ? tx(ariaLabel) : undefined}
      aria-labelledby={ariaLabelledBy}
      aria-multiselectable={checkedState ? true : undefined}
      className={cn('space-y-px', className)}
    >
      {renderNodes(nodes, 0)}
    </ul>
  )
}
