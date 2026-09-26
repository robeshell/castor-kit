import { useMemo } from 'react'
import { Check, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'
import TreeView from '@/shared/components/TreeView'

const collectDescendants = (node) => (node.children || []).flatMap((child) => [child.key, ...collectDescendants(child)])

/**
 * Cascading parent/child checks:
 * - the checked set holds every fully checked node (parents included); half-checked parents are not in it
 * - a parent in the set -> all of its descendants count as checked
 * - a parent is checked if and only if all of its children are checked
 */
function expandDown(nodes, set) {
  const walk = (list, parentChecked) =>
    list.forEach((node) => {
      const checked = parentChecked || set.has(node.key)
      if (checked) set.add(node.key)
      if (node.children) walk(node.children, checked)
    })
  walk(nodes, false)
  return set
}

function recomputeUp(nodes, set) {
  const walk = (node) => {
    if (!node.children?.length) return set.has(node.key)
    const all = node.children.map(walk).every(Boolean)
    if (all) set.add(node.key)
    else set.delete(node.key)
    return all
  }
  nodes.forEach(walk)
  return set
}

/** Display-only checkbox (the whole row toggles it): checked / indeterminate / unchecked */
export function CheckMark({ state }) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex size-4 shrink-0 items-center justify-center rounded-[4px] border shadow-xs transition-colors duration-150',
        state === 'unchecked' ? 'border-input dark:bg-input/30' : 'bg-primary border-primary text-primary-foreground',
      )}
    >
      {state === 'checked' ? <Check className="size-3.5" /> : null}
      {state === 'indeterminate' ? <Minus className="size-3.5" /> : null}
    </span>
  )
}

/**
 * Multi-select tree with cascading checkboxes.
 * - tree: TreeView nodes ({ key, label, children? }); value / onChange: the checked keys (fully checked parents included)
 * - renderText(node): label text (default node.label)
 */
export default function CheckableTree({ tree, value = [], onChange, renderText, className }) {
  const checked = useMemo(() => recomputeUp(tree, expandDown(tree, new Set(value))), [tree, value])
  const isIndeterminate = (node) => !checked.has(node.key) && collectDescendants(node).some((k) => checked.has(k))

  const toggle = (node) => {
    const next = new Set(checked)
    const keys = [node.key, ...collectDescendants(node)]
    if (checked.has(node.key)) keys.forEach((k) => next.delete(k))
    else keys.forEach((k) => next.add(k))
    onChange?.([...recomputeUp(tree, next)])
  }

  return (
    <TreeView
      nodes={tree}
      defaultExpandAll
      onSelect={toggle}
      className={className}
      renderLabel={(node) => (
        <span className="flex items-center gap-2" role="checkbox" aria-checked={checked.has(node.key) ? true : isIndeterminate(node) ? 'mixed' : false}>
          <CheckMark state={checked.has(node.key) ? 'checked' : isIndeterminate(node) ? 'indeterminate' : 'unchecked'} />
          <span className="truncate">{renderText ? renderText(node) : node.label}</span>
        </span>
      )}
    />
  )
}
