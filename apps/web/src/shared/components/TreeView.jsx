import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * 树形列表。nodes = [{ key, label, children?, …任意字段 }]
 *   <TreeView nodes={tree} selectedKey={id} onSelect={(node) => …}
 *     renderLabel={(node) => …} renderActions={(node) => …} defaultExpandAll />
 */
export default function TreeView({
  nodes = [],
  selectedKey,
  onSelect,
  renderLabel,
  renderActions,
  defaultExpandAll = false,
  expandedKeys: controlledExpanded,
  onExpandedChange,
  className,
}) {
  const collectKeys = (list) => list.flatMap((n) => [n.key, ...collectKeys(n.children || [])])
  const [innerExpanded, setInnerExpanded] = useState(() => new Set(defaultExpandAll ? collectKeys(nodes) : []))
  const expanded = controlledExpanded ? new Set(controlledExpanded) : innerExpanded
  const setExpanded = (next) => {
    if (onExpandedChange) onExpandedChange([...next])
    else setInnerExpanded(next)
  }
  const toggle = (key) => {
    const next = new Set(expanded)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    setExpanded(next)
  }

  const renderNodes = (list, depth) =>
    list.map((node) => {
      const hasChildren = Array.isArray(node.children) && node.children.length > 0
      const open = expanded.has(node.key)
      const active = selectedKey !== undefined && node.key === selectedKey
      return (
        <li key={node.key}>
          <div
            role="treeitem"
            aria-expanded={hasChildren ? open : undefined}
            aria-selected={active}
            onClick={() => onSelect?.(node)}
            className={cn(
              'group/tree flex h-8 cursor-pointer items-center gap-1 rounded-md pr-2 text-[13px] transition-colors',
              active ? 'bg-brand-soft text-foreground' : 'hover:bg-muted/60',
            )}
            style={{ paddingLeft: depth * 16 + 4 }}
          >
            <button
              type="button"
              aria-label={open ? '收起' : '展开'}
              onClick={(e) => {
                e.stopPropagation()
                if (hasChildren) toggle(node.key)
              }}
              className={cn('text-muted-foreground flex size-5 shrink-0 items-center justify-center rounded', !hasChildren && 'invisible')}
            >
              <ChevronRight className={cn('size-3.5 transition-transform duration-200', open && 'rotate-90')} />
            </button>
            <div className="min-w-0 flex-1 truncate">{renderLabel ? renderLabel(node) : node.label}</div>
            {renderActions ? (
              <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover/tree:opacity-100" onClick={(e) => e.stopPropagation()}>
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
                {renderNodes(node.children, depth + 1)}
              </motion.ul>
            ) : null}
          </AnimatePresence>
        </li>
      )
    })

  return (
    <ul role="tree" className={cn('space-y-px', className)}>
      {renderNodes(nodes, 0)}
    </ul>
  )
}
